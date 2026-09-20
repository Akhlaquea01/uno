import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import type { GameView, RoomView } from '@uno/shared';
import { SOCKET_EVENTS } from '@uno/shared';
import { clearDatabase, connectClient, createRoom, emitAck, once, startTestServer } from './helpers';

describe('room join and game start', () => {
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

  it('two players join a room and each receive a correctly-scoped game:state after start', async () => {
    const { roomCode, playerId: hostPlayerId } = await createRoom(server.baseUrl, {
      userId: 'u-host',
      hostDisplayName: 'Host',
    });

    const hostSocket = await connectClient(server.baseUrl);
    const guestSocket = await connectClient(server.baseUrl);

    await emitAck(hostSocket, SOCKET_EVENTS.ROOM_JOIN, {
      roomCode,
      userId: 'u-host',
      playerId: hostPlayerId,
      displayName: 'Host',
    });
    const guestAck = await emitAck<{ ok: boolean; playerId: string }>(guestSocket, SOCKET_EVENTS.ROOM_JOIN, {
      roomCode,
      userId: 'u-guest',
      displayName: 'Guest',
    });
    expect(guestAck.ok).toBe(true);
    const guestPlayerId = guestAck.playerId;

    const roomStatePromise = once<RoomView>(hostSocket, SOCKET_EVENTS.ROOM_STATE);
    const hostGamePromise = once<GameView>(hostSocket, SOCKET_EVENTS.GAME_STATE);
    const guestGamePromise = once<GameView>(guestSocket, SOCKET_EVENTS.GAME_STATE);

    hostSocket.emit(SOCKET_EVENTS.ROOM_START, { roomCode });

    const [roomState, hostGame, guestGame] = await Promise.all([roomStatePromise, hostGamePromise, guestGamePromise]);

    expect(roomState.status).toBe('in_progress');
    expect(roomState.players).toHaveLength(2);

    // Each client only ever sees their own hand's card details.
    expect(hostGame.hand.length).toBeGreaterThan(0);
    expect(hostGame.handCounts[guestPlayerId]).toBeGreaterThan(0);
    expect(guestGame.hand.length).toBeGreaterThan(0);
    expect(guestGame.handCounts[hostPlayerId]).toBeGreaterThan(0);

    // Conservation invariant: every card in the 108-card deck is accounted for
    // somewhere (hands + draw pile + discard top), regardless of which first-card
    // rule fired during setup.
    const total =
      hostGame.hand.length + hostGame.handCounts[guestPlayerId] + hostGame.drawPileCount + (hostGame.discardTop ? 1 : 0);
    expect(total).toBe(108);

    hostSocket.close();
    guestSocket.close();
  });

  it('rejects joining a room that does not exist', async () => {
    const socket = await connectClient(server.baseUrl);
    const errorPromise = once(socket, SOCKET_EVENTS.GAME_ERROR);
    socket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomCode: 'NOPE99', userId: 'u1', displayName: 'X' });
    const error = await errorPromise;
    expect(error).toMatchObject({ code: 'room_not_found' });
    socket.close();
  });
});
