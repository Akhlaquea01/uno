import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { userService } from '../../src/services/UserService';
import { UserModel } from '../../src/models/User';

// NOTE: requires mongodb-memory-server to download a mongod binary on first
// run (fastdl.mongodb.org) — see tasks.md's Phase 3 note for the sandbox
// this was authored in, where that download is blocked by network policy.
describe('UserService', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await UserModel.deleteMany({});
  });

  it('creates a new User on first sight of an email', async () => {
    const user = await userService.upsertByEmail('Alice', 'alice@example.com');
    expect(user.name).toBe('Alice');
    expect(user.email).toBe('alice@example.com');
    expect(user.stats).toMatchObject({ gamesPlayed: 0, gamesWon: 0, totalScore: 0 });
  });

  it('matches an existing User by email (case-insensitive) and refreshes the name', async () => {
    const first = await userService.upsertByEmail('Alice', 'alice@example.com');
    const second = await userService.upsertByEmail('Alice Updated', 'Alice@Example.com');
    expect(second._id.toString()).toBe(first._id.toString());
    expect(second.name).toBe('Alice Updated');

    const count = await UserModel.countDocuments();
    expect(count).toBe(1);
  });

  it('validates email format', () => {
    expect(userService.isValidEmail('a@b.com')).toBe(true);
    expect(userService.isValidEmail('not-an-email')).toBe(false);
  });

  it('addRoundScore accumulates lifetime totalScore', async () => {
    const user = await userService.upsertByEmail('Bob', 'bob@example.com');
    await userService.addRoundScore(user._id.toString(), 42);
    await userService.addRoundScore(user._id.toString(), 8);
    const updated = await userService.getById(user._id.toString());
    expect(updated?.stats.totalScore).toBe(50);
  });

  it('recordMatchCompletion increments gamesPlayed for all, gamesWon only for the winner', async () => {
    const a = await userService.upsertByEmail('A', 'a@example.com');
    const b = await userService.upsertByEmail('B', 'b@example.com');
    await userService.recordMatchCompletion([a._id.toString(), b._id.toString()], a._id.toString());

    const updatedA = await userService.getById(a._id.toString());
    const updatedB = await userService.getById(b._id.toString());
    expect(updatedA?.stats).toMatchObject({ gamesPlayed: 1, gamesWon: 1 });
    expect(updatedB?.stats).toMatchObject({ gamesPlayed: 1, gamesWon: 0 });
  });
});
