/** Paths for admin / employee apps (blocked during platform maintenance). */
export function isTenantPortalPath(pathname: string): boolean {
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/employee' ||
    pathname.startsWith('/employee/')
  );
}

/** Login/register entry points that should show the maintenance page when enabled. */
export function isPortalAuthPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/register' ||
    pathname.startsWith('/register/') ||
    pathname === '/admin/login' ||
    pathname.startsWith('/admin/login/') ||
    pathname === '/employee/login' ||
    pathname.startsWith('/employee/login/') ||
    pathname === '/employee/register' ||
    pathname.startsWith('/employee/register/')
  );
}

export function isMaintenanceExemptPath(pathname: string): boolean {
  const exemptPrefixes = [
    '/super-admin',
    '/maintenance',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
    '/legal',
    '/view/invoice',
    '/platform-invoice',
  ];

  return exemptPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function shouldEnforceMaintenance(pathname: string): boolean {
  if (isMaintenanceExemptPath(pathname)) return false;
  if (isTenantPortalPath(pathname)) return true;
  if (isPortalAuthPath(pathname)) return true;
  if (pathname === '/' || pathname === '/plans' || pathname.startsWith('/plans/')) return true;
  return false;
}

export function redirectToMaintenancePage() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/maintenance')) return;
  window.location.assign('/maintenance');
}
