import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import type { GameErrorEvent, GameView, RoomView, RoundResultView } from '@uno/shared';
import { SOCKET_EVENTS } from '@uno/shared';
import { GameModel } from '../../src/models/Game';
import { clearDatabase, connectClient, createRoom, emitAck, once, startTestServer } from './helpers';

async function createUser(baseUrl: string, name: string, email: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email }),
  });
  const body = await res.json();
  return body.userId;
}

describe('Team Mode (2v2 and 3v2)', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it('seats teams alternately, and both teammates score together when either one wins', async () => {
    const hostUserId = await createUser(server.baseUrl, 'Host', 'team-host@example.com');
    const u2 = await createUser(server.baseUrl, 'P2', 'team-p2@example.com');
    const u3 = await createUser(server.baseUrl, 'P3', 'team-p3@example.com');
    const u4 = await createUser(server.baseUrl, 'P4', 'team-p4@example.com');

    const { roomCode, playerId: hostId } = await createRoom(server.baseUrl, {
      userId: hostUserId,
      hostDisplayName: 'Host',
    });
    const hostSocket = await connectClient(server.baseUrl);
    const p2Socket = await connectClient(server.baseUrl);
    const p3Socket = await connectClient(server.baseUrl);
    const p4Socket = await connectClient(server.baseUrl);

    await emitAck(hostSocket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: hostUserId, playerId: hostId, displayName: 'Host' });
    const p2Id = (await emitAck<{ playerId: string }>(p2Socket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: u2, displayName: 'P2' })).playerId;
    const p3Id = (await emitAck<{ playerId: string }>(p3Socket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: u3, displayName: 'P3' })).playerId;
    const p4Id = (await emitAck<{ playerId: string }>(p4Socket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: u4, displayName: 'P4' })).playerId;

    // Host + p3 on team 0 (host is seated first), p2 + p4 on team 1. Assigned
    // one at a time (each round-tripped) since assignTeam does a read-then-
    // save with no transaction — firing all four at once would race.
    hostSocket.emit(SOCKET_EVENTS.ROOM_UPDATE_SETTINGS, { roomCode, settings: { teamMode: true } });
    await once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);

    hostSocket.emit(SOCKET_EVENTS.ROOM_ASSIGN_TEAM, { roomCode, teamId: 0 });
    await once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);
    p2Socket.emit(SOCKET_EVENTS.ROOM_ASSIGN_TEAM, { roomCode, teamId: 1 });
    await once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);
    p3Socket.emit(SOCKET_EVENTS.ROOM_ASSIGN_TEAM, { roomCode, teamId: 0 });
    await once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);
    p4Socket.emit(SOCKET_EVENTS.ROOM_ASSIGN_TEAM, { roomCode, teamId: 1 });
    const finalRoomState = await once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);
    expect(finalRoomState.players.find((p) => p.id === hostId)?.teamId).toBe(0);
    expect(finalRoomState.players.find((p) => p.id === p3Id)?.teamId).toBe(0);
    expect(finalRoomState.players.find((p) => p.id === p2Id)?.teamId).toBe(1);
    expect(finalRoomState.players.find((p) => p.id === p4Id)?.teamId).toBe(1);

    const hostGamePromise = once<GameView>(hostSocket, SOCKET_EVENTS.GAME_STATE);
    hostSocket.emit(SOCKET_EVENTS.ROOM_START, { roomCode });
    await hostGamePromise;

    // Turn order must alternate by team: [team0, team1, team0, team1] —
    // regardless of which seat's first-card rule set the initial turnIndex.
    const gameDocAfterStart = await GameModel.findOne({ roomCode });
    const turnOrder = gameDocAfterStart!.turnOrder;
    const roomAfterStart = finalRoomState.players; // team assignments don't change on start
    const teamById = new Map(roomAfterStart.map((p) => [p.id, p.teamId]));
    expect(turnOrder.map((id: string) => teamById.get(id))).toEqual([0, 1, 0, 1]);

    // Rig a deterministic win: turnOrder[0]'s turn (a team-0 player, either
    // host or p3 depending on seat order); give them a winning play.
    const winnerId: string = turnOrder[0];
    const opp1 = turnOrder[1];
    const teammate = turnOrder[2];
    const opp2 = turnOrder[3];
    expect(teamById.get(winnerId)).toBe(0);
    expect(teamById.get(teammate)).toBe(0);
    expect(teamById.get(opp1)).toBe(1);
    expect(teamById.get(opp2)).toBe(1);

    await GameModel.findOneAndUpdate(
      { roomCode },
      {
        $set: {
          turnIndex: 0,
          direction: 1,
          activeColor: 'red',
          discardPile: [{ id: 'top', color: 'red', type: { kind: 'number', value: 5 } }],
          hands: {
            [winnerId]: [{ id: 'winning-card', color: 'red', type: { kind: 'number', value: 5 } }],
            [opp1]: [{ id: 'opp1-a', color: 'blue', type: { kind: 'number', value: 7 } }],
            [teammate]: [{ id: 'teammate-a', color: 'green', type: { kind: 'number', value: 9 } }], // must NOT count
            [opp2]: [{ id: 'opp2-a', color: 'yellow', type: { kind: 'skip' } }],
          },
          pendingUnoCall: null,
          pendingChallenge: null,
          pendingDrawDecision: null,
        },
      },
    );

    const winnerSocket = [hostSocket, p2Socket, p3Socket, p4Socket][[hostId, p2Id, p3Id, p4Id].indexOf(winnerId)];
    // Both events fire synchronously back-to-back on the server side, so both
    // listeners must be attached before the triggering emit.
    const roundEndedPromise = once<RoundResultView>(hostSocket, SOCKET_EVENTS.GAME_ROUND_ENDED);
    const roomStatePromise = once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);
    winnerSocket.emit(SOCKET_EVENTS.GAME_PLAY_CARD, { roomCode, cardId: 'winning-card' });
    const [roundResult, roomView] = await Promise.all([roundEndedPromise, roomStatePromise]);

    expect(roundResult.winnerId).toBe(winnerId);
    expect(roundResult.winningTeamId).toBe(0);
    // Opposing team's cards count (7 + 20 for Skip); teammate's hand doesn't.
    const opp1Score = roundResult.scores.find((s) => s.playerId === opp1)?.cardsLeftValue;
    const opp2Score = roundResult.scores.find((s) => s.playerId === opp2)?.cardsLeftValue;
    expect(opp1Score).toBe(7);
    expect(opp2Score).toBe(20);
    const winnerScore = roomView.players.find((p) => p.id === winnerId)?.matchScore;
    const teammateScore = roomView.players.find((p) => p.id === teammate)?.matchScore;
    const oppScore = roomView.players.find((p) => p.id === opp1)?.matchScore;
    expect(winnerScore).toBe(27); // 7 + 20 from the opposing team
    expect(teammateScore).toBe(27); // both teammates score together
    expect(oppScore).toBe(0);

    hostSocket.close();
    p2Socket.close();
    p3Socket.close();
    p4Socket.close();
  });

  it('seats a 5-player 3-2 split alternately, wrapping the larger team\'s extra player', async () => {
    const hostUserId = await createUser(server.baseUrl, 'Host', 'team5-host@example.com');
    const u2 = await createUser(server.baseUrl, 'P2', 'team5-p2@example.com');
    const u3 = await createUser(server.baseUrl, 'P3', 'team5-p3@example.com');
    const u4 = await createUser(server.baseUrl, 'P4', 'team5-p4@example.com');
    const u5 = await createUser(server.baseUrl, 'P5', 'team5-p5@example.com');

    const { roomCode, playerId: hostId } = await createRoom(server.baseUrl, {
      userId: hostUserId,
      hostDisplayName: 'Host',
    });
    const hostSocket = await connectClient(server.baseUrl);
    const p2Socket = await connectClient(server.baseUrl);
    const p3Socket = await connectClient(server.baseUrl);
    const p4Socket = await connectClient(server.baseUrl);
    const p5Socket = await connectClient(server.baseUrl);

    await emitAck(hostSocket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: hostUserId, playerId: hostId, displayName: 'Host' });
    await emitAck(p2Socket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: u2, displayName: 'P2' });
    await emitAck(p3Socket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: u3, displayName: 'P3' });
    await emitAck(p4Socket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: u4, displayName: 'P4' });
    await emitAck(p5Socket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: u5, displayName: 'P5' });

    hostSocket.emit(SOCKET_EVENTS.ROOM_UPDATE_SETTINGS, { roomCode, settings: { teamMode: true } });
    await once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);

    // Host, P3, P5 on team 0 (3 players); P2, P4 on team 1 (2 players).
    hostSocket.emit(SOCKET_EVENTS.ROOM_ASSIGN_TEAM, { roomCode, teamId: 0 });
    await once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);
    p2Socket.emit(SOCKET_EVENTS.ROOM_ASSIGN_TEAM, { roomCode, teamId: 1 });
    await once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);
    p3Socket.emit(SOCKET_EVENTS.ROOM_ASSIGN_TEAM, { roomCode, teamId: 0 });
    await once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);
    p4Socket.emit(SOCKET_EVENTS.ROOM_ASSIGN_TEAM, { roomCode, teamId: 1 });
    await once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);
    p5Socket.emit(SOCKET_EVENTS.ROOM_ASSIGN_TEAM, { roomCode, teamId: 0 });
    const finalRoomState = await once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);

    const hostGamePromise = once<GameView>(hostSocket, SOCKET_EVENTS.GAME_STATE);
    hostSocket.emit(SOCKET_EVENTS.ROOM_START, { roomCode });
    await hostGamePromise;

    // Interleaved seating puts the larger team's extra (3rd) player last, so
    // turn order alternates [0,1,0,1] then wraps to a second team-0 turn.
    const gameDocAfterStart = await GameModel.findOne({ roomCode });
    const turnOrder = gameDocAfterStart!.turnOrder;
    const teamById = new Map(finalRoomState.players.map((p) => [p.id, p.teamId]));
    expect(turnOrder.map((id: string) => teamById.get(id))).toEqual([0, 1, 0, 1, 0]);

    hostSocket.close();
    p2Socket.close();
    p3Socket.close();
    p4Socket.close();
    p5Socket.close();
  });

  it('rejects starting Team Mode at 5 players with an invalid split (4-1)', async () => {
    const hostUserId = await createUser(server.baseUrl, 'Host', 'team5-bad-host@example.com');
    const u2 = await createUser(server.baseUrl, 'P2', 'team5-bad-p2@example.com');
    const u3 = await createUser(server.baseUrl, 'P3', 'team5-bad-p3@example.com');
    const u4 = await createUser(server.baseUrl, 'P4', 'team5-bad-p4@example.com');
    const u5 = await createUser(server.baseUrl, 'P5', 'team5-bad-p5@example.com');

    const { roomCode, playerId: hostId } = await createRoom(server.baseUrl, {
      userId: hostUserId,
      hostDisplayName: 'Host',
    });
    const hostSocket = await connectClient(server.baseUrl);
    const p2Socket = await connectClient(server.baseUrl);
    const p3Socket = await connectClient(server.baseUrl);
    const p4Socket = await connectClient(server.baseUrl);
    const p5Socket = await connectClient(server.baseUrl);

    await emitAck(hostSocket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: hostUserId, playerId: hostId, displayName: 'Host' });
    await emitAck(p2Socket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: u2, displayName: 'P2' });
    await emitAck(p3Socket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: u3, displayName: 'P3' });
    await emitAck(p4Socket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: u4, displayName: 'P4' });
    await emitAck(p5Socket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: u5, displayName: 'P5' });

    hostSocket.emit(SOCKET_EVENTS.ROOM_UPDATE_SETTINGS, { roomCode, settings: { teamMode: true } });
    await once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);

    // 4 players on team 0, only 1 on team 1 — not a valid 3-2 split.
    hostSocket.emit(SOCKET_EVENTS.ROOM_ASSIGN_TEAM, { roomCode, teamId: 0 });
    await once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);
    p2Socket.emit(SOCKET_EVENTS.ROOM_ASSIGN_TEAM, { roomCode, teamId: 0 });
    await once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);
    p3Socket.emit(SOCKET_EVENTS.ROOM_ASSIGN_TEAM, { roomCode, teamId: 0 });
    await once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);
    p4Socket.emit(SOCKET_EVENTS.ROOM_ASSIGN_TEAM, { roomCode, teamId: 0 });
    await once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);
    p5Socket.emit(SOCKET_EVENTS.ROOM_ASSIGN_TEAM, { roomCode, teamId: 1 });
    await once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);

    const errorPromise = once<GameErrorEvent>(hostSocket, SOCKET_EVENTS.GAME_ERROR);
    hostSocket.emit(SOCKET_EVENTS.ROOM_START, { roomCode });
    const error = await errorPromise;
    expect(error.code).toBe('invalid_teams');

    hostSocket.close();
    p2Socket.close();
    p3Socket.close();
    p4Socket.close();
    p5Socket.close();
  });
});
