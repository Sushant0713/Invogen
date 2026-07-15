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
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (
      path.startsWith('/view/invoice') ||
      path.startsWith('/platform-invoice') ||
      path === '/plans' ||
      path.startsWith('/plans/')
    ) {
      return;
    }
  }

  const pathname = window.location.pathname;
  const loginPath = getLoginPathForPathname(pathname);
  // Don't bounce back to auth pages after a successful login.
  if (isAuthPath(pathname + window.location.search)) {
    window.location.href = expired ? `${loginPath}?expired=1` : loginPath;
    return;
  }

  const returnTo = encodeURIComponent(
    pathname + window.location.search + window.location.hash
  );
  const suffix = expired ? `?expired=1&returnTo=${returnTo}` : `?returnTo=${returnTo}`;
  window.location.href = `${loginPath}${suffix}`;
}

function isAuthPath(pathWithSearch: string): boolean {
  const path = (pathWithSearch.split('?')[0] || '').trim();
  return (
    path === '/login' ||
    path.startsWith('/login/') ||
    path === '/super-admin/login' ||
    path === '/register' ||
    path.startsWith('/register/') ||
    path === '/forgot-password' ||
    path === '/reset-password' ||
    path === '/verify-email' ||
    path === '/403' ||
    path === '/maintenance'
  );
}

export function getSafePostLoginPath(
  candidate: string | undefined | null,
  fallback: string
): string {
  if (!candidate || !candidate.startsWith('/')) return fallback;
  if (isAuthPath(candidate)) return fallback;
  return candidate;
}

export function getReturnPath(search: string, fallback: string): string {
  const params = new URLSearchParams(search);
  const returnTo = params.get('returnTo');
  if (!returnTo || !returnTo.startsWith('/')) return fallback;
  if (isAuthPath(returnTo)) return fallback;
  return returnTo;
}
