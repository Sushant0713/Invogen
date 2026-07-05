const ANONYMOUS_SCOPE = 'anonymous';

/** Stable per-account scope for browser-local preferences (recent, favourites). */
export function getStorageUserScope(): string {
  const token = localStorage.getItem('accessToken');
  if (!token) return ANONYMOUS_SCOPE;

  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { userId?: string };
    if (payload.userId) return payload.userId;
  } catch {
    // ignore malformed token
  }

  return ANONYMOUS_SCOPE;
}

export function scopedStorageKey(baseKey: string): string {
  return `${baseKey}:${getStorageUserScope()}`;
}

export function readScopedJson<T>(baseKey: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(scopedStorageKey(baseKey));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeScopedJson(baseKey: string, value: unknown): void {
  localStorage.setItem(scopedStorageKey(baseKey), JSON.stringify(value));
}
