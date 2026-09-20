import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import type { RoundResultView } from '@uno/shared';
import { SOCKET_EVENTS } from '@uno/shared';
import { GameModel } from '../../src/models/Game';
import { clearDatabase, connectClient, createRoom, emitAck, once, startTestServer } from './helpers';

describe('a full round played to completion', () => {
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

  it('ends the round and reports correct scores when a player empties their hand', async () => {
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

    // Rig the persisted game state to a deterministic, winnable position so the
    // round outcome (and its score math) is fully predictable — this still
    // exercises the real socket handler + GameService + Mongo persistence path.
    await GameModel.findOneAndUpdate(
      { roomCode },
      {
        $set: {
          turnOrder: [hostPlayerId, guestPlayerId],
          turnIndex: 0,
          direction: 1,
          activeColor: 'red',
          discardPile: [{ id: 'top', color: 'red', type: { kind: 'number', value: 5 } }],
          hands: {
            [hostPlayerId]: [{ id: 'winning-card', color: 'red', type: { kind: 'number', value: 5 } }],
            [guestPlayerId]: [
              { id: 'g1', color: 'blue', type: { kind: 'number', value: 7 } },
              { id: 'g2', color: 'red', type: { kind: 'skip' } },
            ],
          },
          pendingUnoCall: null,
          pendingChallenge: null,
          pendingDrawDecision: null,
        },
      },
    );

    const roundEndedPromise = once<RoundResultView>(hostSocket, SOCKET_EVENTS.GAME_ROUND_ENDED);
    hostSocket.emit(SOCKET_EVENTS.GAME_PLAY_CARD, { roomCode, cardId: 'winning-card' });

    const roundResult = await roundEndedPromise;
    expect(roundResult.winnerId).toBe(hostPlayerId);
    const guestScore = roundResult.scores.find((s) => s.playerId === guestPlayerId);
    expect(guestScore?.cardsLeftValue).toBe(7 + 20); // number 7 + Skip(20)
    const hostScore = roundResult.scores.find((s) => s.playerId === hostPlayerId);
    expect(hostScore?.cardsLeftValue).toBe(0);

    hostSocket.close();
    guestSocket.close();
  });
});
