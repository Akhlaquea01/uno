import type { ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { useOrientation } from '../hooks/useOrientation';

const SMALL_SCREEN_WIDTH = 900; // only nag phones, not a narrowed desktop window

/** Soft rotate-device prompt for small-screen portrait viewports (research.md
 * landscape-first decision) — never a hard orientation lock in the browser. The
 * Android app locks landscape itself (useLandscapeLock), so it skips the prompt
 * instead of flashing it while the screen rotates. */
export default function OrientationGate({ children }: { children: ReactNode }) {
  const orientation = useOrientation();
  const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < SMALL_SCREEN_WIDTH;

  if (orientation === 'portrait' && isSmallScreen && !Capacitor.isNativePlatform()) {
    return (
      <div className="rotate-prompt">
        <div className="rotate-icon" aria-hidden="true">
          ⟳
        </div>
        <p>Rotate your device to play Uno in landscape.</p>
      </div>
    );
  }

  return <>{children}</>;
}
