import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import type { GameView } from '@uno/shared';
import { SOCKET_EVENTS } from '@uno/shared';
import { GameModel } from '../../src/models/Game';
import { clearDatabase, connectClient, createRoom, emitAck, once, startTestServer } from './helpers';

describe('Wild Draw Four accept/decline', () => {
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

  it('lets the target accept the draw and unblocks the rest of the game', async () => {
    const { roomCode, playerId: hostPlayerId } = await createRoom(server.baseUrl, {
      userId: 'u-host',
      hostDisplayName: 'Host',
    });
    const hostSocket = await connectClient(server.baseUrl);
    const guestSocket = await connectClient(server.baseUrl);

    await emitAck(hostSocket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: 'u-host', playerId: hostPlayerId, displayName: 'Host' });
    const guestAck = await emitAck<{ playerId: string }>(guestSocket, SOCKET_EVENTS.ROOM_JOIN, {
      roomCode,
      userId: 'u-guest',
      displayName: 'Guest',
    });
    const guestPlayerId = guestAck.playerId;

    hostSocket.emit(SOCKET_EVENTS.ROOM_START, { roomCode });
    await once(hostSocket, SOCKET_EVENTS.GAME_STATE);

    // Rig a deterministic Wild Draw Four setup: host plays it on guest, who
    // has no matching-color alternative (so a challenge would fail anyway) —
    // the point here is exercising accept, not the guilty/not-guilty math.
    await GameModel.findOneAndUpdate(
      { roomCode },
      {
        $set: {
          turnOrder: [hostPlayerId, guestPlayerId],
          turnIndex: 0,
          direction: 1,
          activeColor: 'red',
          discardPile: [{ id: 'top', color: 'red', type: { kind: 'number', value: 5 } }],
          deck: Array.from({ length: 10 }, (_, i) => ({
            id: `deck-${i}`,
            color: 'green',
            type: { kind: 'number', value: 1 },
          })),
          hands: {
            [hostPlayerId]: [
              { id: 'wd4', color: 'wild', type: { kind: 'wild_draw_four' } },
              { id: 'h-spare', color: 'red', type: { kind: 'number', value: 1 } },
            ],
            [guestPlayerId]: [{ id: 'g1', color: 'blue', type: { kind: 'number', value: 7 } }],
          },
          pendingUnoCall: null,
          pendingChallenge: null,
          pendingDrawDecision: null,
        },
      },
    );

    const hostSeesChallengeOpen = once<GameView>(hostSocket, SOCKET_EVENTS.GAME_STATE);
    hostSocket.emit(SOCKET_EVENTS.GAME_PLAY_CARD, { roomCode, cardId: 'wd4', chosenColor: 'blue' });
    const afterPlay = await hostSeesChallengeOpen;
    expect(afterPlay.pendingChallenge?.targetPlayerId).toBe(guestPlayerId);

    // Before accepting: play/draw should be blocked for everyone by the
    // pending challenge (this is expected — not the deadlock bug, which was
    // the absence of any way to ever clear it).
    const blockedError = once(hostSocket, SOCKET_EVENTS.GAME_ERROR);
    hostSocket.emit(SOCKET_EVENTS.GAME_DRAW_CARD, { roomCode });
    expect((await blockedError as { code: string }).code).toBe('challenge_pending');

    const bothSeeResolved = Promise.all([
      once<GameView>(hostSocket, SOCKET_EVENTS.GAME_STATE),
      once<GameView>(guestSocket, SOCKET_EVENTS.GAME_STATE),
    ]);
    guestSocket.emit(SOCKET_EVENTS.GAME_DECLINE_CHALLENGE, { roomCode });
    const [hostView] = await bothSeeResolved;
    expect(hostView.pendingChallenge).toBeNull();

    // Play resumes normally afterward (2-player Draw Four wraps the turn back
    // to the host, who can now draw without hitting challenge_pending).
    const drawResolved = once<GameView>(hostSocket, SOCKET_EVENTS.GAME_STATE);
    hostSocket.emit(SOCKET_EVENTS.GAME_DRAW_CARD, { roomCode });
    const afterDraw = await drawResolved;
    expect(afterDraw.pendingChallenge).toBeNull();

    hostSocket.close();
    guestSocket.close();
  });
});
