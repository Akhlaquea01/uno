const IDENTITY_KEY = 'uno:identity';

export interface StoredIdentity {
  userId: string;
  name: string;
  email: string;
}

export function getStoredIdentity(): StoredIdentity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as StoredIdentity) : null;
  } catch {
    return null;
  }
}

export function setStoredIdentity(identity: StoredIdentity): void {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // localStorage unavailable (private mode, storage full) — identity just won't persist.
  }
}

export function getStoredPlayerId(roomCode: string): string | undefined {
  try {
    return localStorage.getItem(`uno:playerId:${roomCode}`) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setStoredPlayerId(roomCode: string, playerId: string): void {
  try {
    localStorage.setItem(`uno:playerId:${roomCode}`, playerId);
  } catch {
    // ignore
  }
}
