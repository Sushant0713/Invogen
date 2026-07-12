import { useGsiScriptLoaded } from '@/hooks/useGsiScriptLoaded';

/** Preload the Google Identity script for sign-in buttons. */
export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  useGsiScriptLoaded(true);
  return <>{children}</>;
}
