import { useEffect, useState } from 'react';

/** Landscape-first design (Constitution Principle VI): detects a portrait
 * viewport so small screens can be prompted to rotate, without ever locking orientation. */
export function useOrientation(): 'portrait' | 'landscape' {
  const query = '(orientation: portrait)';
  const [isPortrait, setIsPortrait] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setIsPortrait(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isPortrait ? 'portrait' : 'landscape';
}
