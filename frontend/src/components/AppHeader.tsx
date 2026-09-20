import type { ReactNode } from 'react';

export interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
}

/** Shared brand header used across every screen (game board included) so the
 * app reads as one product instead of a stitched-together set of pages. */
export default function AppHeader({ title, subtitle, right }: AppHeaderProps) {
  return (
    <header className="app-topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          U
        </span>
        <strong>
          UNO<span className="brand-dot">.</span>
        </strong>
      </div>
      {(title || subtitle) && (
        <div className="topbar-title">
          {title && <span>{title}</span>}
          {subtitle && <b>{subtitle}</b>}
        </div>
      )}
      {right && <div className="topbar-actions">{right}</div>}
    </header>
  );
}
