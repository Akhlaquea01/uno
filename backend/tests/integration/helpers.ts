import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../../src/server';

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

let mongod: MongoMemoryServer | null = null;

export async function startTestServer(): Promise<TestServer> {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const { httpServer } = createApp();
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://localhost:${port}`;

  return {
    baseUrl,
    close: async () => {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      await mongoose.disconnect();
      await mongod?.stop();
      mongod = null;
    },
  };
}

export async function clearDatabase(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

export function connectClient(baseUrl: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, { transports: ['websocket'], forceNew: true });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

export function once<T = unknown>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

export function emitAck<T = unknown>(socket: ClientSocket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

export async function createRoom(
  baseUrl: string,
  body: { userId: string; hostDisplayName: string },
): Promise<{ roomCode: string; playerId: string; joinUrl: string }> {
  const res = await fetch(`${baseUrl}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`createRoom failed: ${res.status} ${await res.text()}`);
  return res.json();
}
