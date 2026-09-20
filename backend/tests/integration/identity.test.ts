import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { clearDatabase, startTestServer } from './helpers';

describe('POST /api/users (first-login identity capture)', () => {
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

  it('creates a user and returns the same userId on a repeat submission with the same email', async () => {
    const first = await fetch(`${server.baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sam', email: 'sam@example.com' }),
    }).then((r) => r.json());
    expect(first.userId).toBeTruthy();

    const second = await fetch(`${server.baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sam', email: 'sam@example.com' }),
    }).then((r) => r.json());
    expect(second.userId).toBe(first.userId);
  });

  it('rejects a malformed email with 400', async () => {
    const res = await fetch(`${server.baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sam', email: 'not-an-email' }),
    });
    expect(res.status).toBe(400);
  });
});
