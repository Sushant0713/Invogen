import { useEffect, useRef } from 'react';
import { rehydrateUserLocalPreferences } from './user-preferences';

/** Keep browser-local recent/favourites in sync when the signed-in account changes. */
export function useRehydrateUserPreferences(userId: string | undefined | null): void {
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const nextUserId = userId ?? null;
    if (previousUserId.current === nextUserId && previousUserId.current !== undefined) {
      return;
    }
    previousUserId.current = nextUserId;
    rehydrateUserLocalPreferences();
  }, [userId]);
}
