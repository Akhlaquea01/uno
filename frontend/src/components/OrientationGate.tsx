import type { ReactNode } from 'react';
import { useOrientation } from '../hooks/useOrientation';

const SMALL_SCREEN_WIDTH = 900; // only nag phones, not a narrowed desktop window

/** Soft rotate-device prompt for small-screen portrait viewports (research.md
 * landscape-first decision) — never a hard orientation lock. */
export default function OrientationGate({ children }: { children: ReactNode }) {
  const orientation = useOrientation();
  const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < SMALL_SCREEN_WIDTH;

  if (orientation === 'portrait' && isSmallScreen) {
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
