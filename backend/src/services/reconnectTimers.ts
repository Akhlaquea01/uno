/**
 * In-process grace-period timers for disconnected players (FR-013). This is
 * scheduling state, not game state — MongoDB stays the only source of truth
 * for the game itself (Constitution Principle I); if the process restarts
 * mid-grace-period, the timer is simply gone and the player just gets to
 * reconnect without a pending auto-skip, which is a safe default.
 */
const timers = new Map<string, NodeJS.Timeout>();

function key(roomCode: string, playerId: string): string {
  return `${roomCode}:${playerId}`;
}

export function scheduleAutoSkip(
  roomCode: string,
  playerId: string,
  graceSeconds: number,
  onTimeout: () => Promise<void>,
): void {
  clearAutoSkip(roomCode, playerId);
  const handle = setTimeout(() => {
    timers.delete(key(roomCode, playerId));
    onTimeout().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('auto-skip failed', err);
    });
  }, graceSeconds * 1000);
  timers.set(key(roomCode, playerId), handle);
}

export function clearAutoSkip(roomCode: string, playerId: string): void {
  const k = key(roomCode, playerId);
  const handle = timers.get(k);
  if (handle) {
    clearTimeout(handle);
    timers.delete(k);
  }
}
