import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { SOCKET_EVENTS, type GameView } from '@uno/shared';
import { GameModel } from '../../src/models/Game';
import { RoomModel } from '../../src/models/Room';
import { clearDatabase, connectClient, createRoom, emitAck, once, startTestServer } from './helpers';

describe('grace period elapsing without reconnection', () => {
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

  it('auto-skips the disconnected player once the grace period elapses', async () => {
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

    await RoomModel.findOneAndUpdate({ code: roomCode }, { $set: { 'settings.reconnectGraceSeconds': 1 } });
    await GameModel.findOneAndUpdate(
      { roomCode },
      {
        $set: {
          turnOrder: [hostPlayerId, guestPlayerId],
          turnIndex: 0,
          activeColor: 'red',
          discardPile: [{ id: 'top', color: 'red', type: { kind: 'number', value: 5 } }],
          // Next draw (blue 2) does not match red/5 — the auto-skip draw ends the turn immediately.
          deck: [{ id: 'auto-drawn', color: 'blue', type: { kind: 'number', value: 2 } }],
          hands: {
            [hostPlayerId]: [{ id: 'h1', color: 'green', type: { kind: 'number', value: 9 } }],
            [guestPlayerId]: [{ id: 'g1', color: 'blue', type: { kind: 'number', value: 7 } }],
          },
        },
      },
    );

    const nextGuestState = once<GameView>(guestSocket, SOCKET_EVENTS.GAME_STATE);
    hostSocket.close(); // triggers the grace-period timer server-side

    const state = await nextGuestState; // fires once the auto-skip broadcasts
    expect(state.turnPlayerId).toBe(guestPlayerId);
    expect(state.handCounts[hostPlayerId]).toBe(2); // original card + the auto-draw

    guestSocket.close();
  }, 10000);
});
