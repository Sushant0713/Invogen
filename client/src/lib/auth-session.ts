import { getLoginPathForPathname } from '@/config/navigation';
import { queryClient } from '@/lib/query-client';

const REFRESH_TOKEN_KEY = 'refreshToken';

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string) {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  queryClient.clear();
}

export function isAccessTokenExpired(token: string, bufferSeconds = 30): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { exp?: number };
    if (!payload.exp) return true;
    return payload.exp * 1000 <= Date.now() + bufferSeconds * 1000;
  } catch {
    return true;
  }
}

export function redirectToLogin(expired = false) {
  const loginPath = getLoginPathForPathname(window.location.pathname);
  const returnTo = encodeURIComponent(
    window.location.pathname + window.location.search + window.location.hash
  );
  const suffix = expired ? `?expired=1&returnTo=${returnTo}` : `?returnTo=${returnTo}`;
  window.location.href = `${loginPath}${suffix}`;
}

export function getReturnPath(search: string, fallback: string): string {
  const params = new URLSearchParams(search);
  const returnTo = params.get('returnTo');
  if (!returnTo || !returnTo.startsWith('/')) return fallback;
  return returnTo;
}
