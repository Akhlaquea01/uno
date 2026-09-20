import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { SOCKET_EVENTS } from '@uno/shared';
import { GameModel } from '../../src/models/Game';
import { UserModel } from '../../src/models/User';
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

describe('finishing a round updates User.stats in MongoDB', () => {
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

  it('increments the winner totalScore and both players gamesPlayed once the match ends', async () => {
    const hostUserId = await createUser(server.baseUrl, 'Host', 'host@example.com');
    const guestUserId = await createUser(server.baseUrl, 'Guest', 'guest@example.com');

    const { roomCode, playerId: hostPlayerId } = await createRoom(server.baseUrl, {
      userId: hostUserId,
      hostDisplayName: 'Host',
    });
    const hostSocket = await connectClient(server.baseUrl);
    const guestSocket = await connectClient(server.baseUrl);

    await emitAck(hostSocket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: hostUserId, playerId: hostPlayerId, displayName: 'Host' });
    const guestAck = await emitAck<{ playerId: string }>(guestSocket, SOCKET_EVENTS.ROOM_JOIN, {
      roomCode,
      userId: guestUserId,
      displayName: 'Guest',
    });
    const guestPlayerId = guestAck.playerId;

    hostSocket.emit(SOCKET_EVENTS.ROOM_START, { roomCode });
    await once(hostSocket, SOCKET_EVENTS.GAME_STATE);

    // Rig a low target score so this single round also ends the match.
    const { RoomModel } = await import('../../src/models/Room');
    await RoomModel.findOneAndUpdate({ code: roomCode }, { $set: { 'settings.targetScore': 1 } });

    await GameModel.findOneAndUpdate(
      { roomCode },
      {
        $set: {
          turnOrder: [hostPlayerId, guestPlayerId],
          turnIndex: 0,
          activeColor: 'red',
          discardPile: [{ id: 'top', color: 'red', type: { kind: 'number', value: 5 } }],
          hands: {
            [hostPlayerId]: [{ id: 'winning-card', color: 'red', type: { kind: 'number', value: 5 } }],
            [guestPlayerId]: [{ id: 'g1', color: 'blue', type: { kind: 'number', value: 7 } }],
          },
        },
      },
    );

    const matchEndedPromise = once(hostSocket, SOCKET_EVENTS.GAME_MATCH_ENDED);
    hostSocket.emit(SOCKET_EVENTS.GAME_PLAY_CARD, { roomCode, cardId: 'winning-card' });
    await matchEndedPromise;

    const hostUser = await UserModel.findById(hostUserId);
    const guestUser = await UserModel.findById(guestUserId);
    expect(hostUser?.stats.totalScore).toBe(7);
    expect(hostUser?.stats.gamesPlayed).toBe(1);
    expect(hostUser?.stats.gamesWon).toBe(1);
    expect(guestUser?.stats.gamesPlayed).toBe(1);
    expect(guestUser?.stats.gamesWon).toBe(0);

    hostSocket.close();
    guestSocket.close();
  });
});
