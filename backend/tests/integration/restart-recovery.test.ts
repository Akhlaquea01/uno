import { afterAll, beforeEach, describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SOCKET_EVENTS, type GameView } from '@uno/shared';
import { createApp } from '../../src/server';
import { clearDatabase, connectClient, createRoom, emitAck, once } from './helpers';

// Simulates a backend process restart (e.g. a Render redeploy) by tearing down
// and recreating the HTTP/Socket.IO server while keeping the same MongoDB
// connection — exactly what carries over on a real restart, since MongoDB is
// the only copy of game state (FR-012, Constitution Principle I).
describe('surviving a backend process restart mid-round', () => {
  let mongod: MongoMemoryServer;

  beforeEach(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await clearDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod?.stop();
  });

  it('continues an in-progress room after the server process is recreated', async () => {
    const first = createApp();
    await new Promise<void>((resolve) => first.httpServer.listen(0, resolve));
    const firstPort = (first.httpServer.address() as any).port;
    const firstUrl = `http://localhost:${firstPort}`;

    const { roomCode, playerId: hostPlayerId } = await createRoom(firstUrl, { userId: 'u-host', hostDisplayName: 'Host' });
    const hostSocket = await connectClient(firstUrl);
    const guestSocket = await connectClient(firstUrl);
    await emitAck(hostSocket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: 'u-host', playerId: hostPlayerId, displayName: 'Host' });
    await emitAck(guestSocket, SOCKET_EVENTS.ROOM_JOIN, { roomCode, userId: 'u-guest', displayName: 'Guest' });
    hostSocket.emit(SOCKET_EVENTS.ROOM_START, { roomCode });
    const beforeRestart = await once<GameView>(hostSocket, SOCKET_EVENTS.GAME_STATE);

    hostSocket.close();
    guestSocket.close();
    await new Promise<void>((resolve) => first.httpServer.close(() => resolve()));

    // "Restart": a brand new server instance, same Mongo connection.
    const second = createApp();
    await new Promise<void>((resolve) => second.httpServer.listen(0, resolve));
    const secondPort = (second.httpServer.address() as any).port;
    const secondUrl = `http://localhost:${secondPort}`;

    const reconnectSocket = await connectClient(secondUrl);
    const afterRestartPromise = once<GameView>(reconnectSocket, SOCKET_EVENTS.GAME_STATE);
    await emitAck(reconnectSocket, SOCKET_EVENTS.ROOM_JOIN, {
      roomCode,
      userId: 'u-host',
      playerId: hostPlayerId,
      displayName: 'Host',
    });
    const afterRestart = await afterRestartPromise;

    expect(afterRestart.hand.map((c) => c.id).sort()).toEqual(beforeRestart.hand.map((c) => c.id).sort());
    expect(afterRestart.version).toBe(beforeRestart.version);

    reconnectSocket.close();
    await new Promise<void>((resolve) => second.httpServer.close(() => resolve()));
  });
});
