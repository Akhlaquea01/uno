import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { SOCKET_EVENTS, type GameView } from '@uno/shared';
import { clearDatabase, connectClient, createRoom, emitAck, once, startTestServer } from './helpers';

describe('reconnecting within the grace period', () => {
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

  it('resumes the same seat with the same hand after a disconnect', async () => {
    const { roomCode, playerId: hostPlayerId } = await createRoom(server.baseUrl, {
      userId: 'u-host',
      hostDisplayName: 'Host',
    });
    let hostSocket = await connectClient(server.baseUrl);
    const guestSocket = await connectClient(server.baseUrl);

    await emitAck(hostSocket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: 'u-host', playerId: hostPlayerId, displayName: 'Host' });
    await emitAck(guestSocket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: 'u-guest', displayName: 'Guest' });

    hostSocket.emit(SOCKET_EVENTS.ROOM_START, { roomCode });
    const originalState = await once<GameView>(hostSocket, SOCKET_EVENTS.GAME_STATE);

    hostSocket.close();
    await new Promise((r) => setTimeout(r, 100));

    hostSocket = await connectClient(server.baseUrl);
    const resumedStatePromise = once<GameView>(hostSocket, SOCKET_EVENTS.GAME_STATE);
    await emitAck(hostSocket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: 'u-host', playerId: hostPlayerId, displayName: 'Host' });
    const resumedState = await resumedStatePromise;

    expect(resumedState.hand.map((c) => c.id).sort()).toEqual(originalState.hand.map((c) => c.id).sort());
    expect(resumedState.turnPlayerId).toBe(originalState.turnPlayerId);

    hostSocket.close();
    guestSocket.close();
  });
});
