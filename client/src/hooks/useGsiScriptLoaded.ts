import { useEffect, useState } from 'react';
import { loadGsiScript } from '@/lib/google-gsi';

/** Returns true once the Google Identity script has loaded. */
export function useGsiScriptLoaded(enabled = true): boolean {
  const [loaded, setLoaded] = useState(
    () => typeof window !== 'undefined' && Boolean(window.google?.accounts?.id)
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadGsiScript()
      .then(() => {
        if (!cancelled) setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return loaded;
}
