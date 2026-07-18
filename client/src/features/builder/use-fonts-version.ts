import { useSyncExternalStore } from 'react';
import { getFontsVersion, subscribeFontsChange } from './text-measure';

/**
 * Re-render (and re-run layout memos) when a web font finishes loading.
 * Text measured against a fallback font before the real font arrived would
 * otherwise leave the preview laid out with stale metrics.
 */
export function useFontsVersion(): number {
  return useSyncExternalStore(subscribeFontsChange, getFontsVersion, () => 0);
}
