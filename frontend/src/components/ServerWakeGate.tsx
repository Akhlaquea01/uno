import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../services/api';

/** Render's free tier spins the container down after ~15 min idle; this pings
 * /api/health and shows a "waking up" indicator until it responds, before
 * anything that needs the backend (identity capture, room actions) renders. */
export default function ServerWakeGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    const tryHealth = async () => {
      attempt += 1;
      if (attempt > 1 && !cancelled) setWaiting(true);
      try {
        await api.health();
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setTimeout(tryHealth, 2000);
      }
    };

    tryHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  if (ready) return <>{children}</>;

  return (
    <div className="wake-gate">
      {waiting ? (
        <>
          <div className="rotate-icon" aria-hidden="true">
            ⏳
          </div>
          <p>Waking up the server… this can take up to a minute on the free tier.</p>
        </>
      ) : (
        <p>Loading…</p>
      )}
    </div>
  );
}
