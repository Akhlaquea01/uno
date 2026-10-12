import { useEffect } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface UnoOrientationPlugin {
  lockLandscape(): Promise<void>;
  unlock(): Promise<void>;
}

// App-local Android plugin (UnoOrientationPlugin.java). Capacitor's stock plugin only
// offers a fixed landscape, which would show the table upside-down for half the players.
const UnoOrientation = registerPlugin<UnoOrientationPlugin>('UnoOrientation');

/** Locks the Android app to landscape (either way up) while the game table is shown, so
 * the rotate prompt is never a dead end when auto-rotate is off. No-op in the browser,
 * which keeps the soft rotate prompt (Constitution Principle VI). */
export function useLandscapeLock(): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    UnoOrientation.lockLandscape().catch(() => undefined);
    return () => {
      UnoOrientation.unlock().catch(() => undefined);
    };
  }, []);
}
