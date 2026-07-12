import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthShell } from '@/components/auth/AuthShell';
import { LoginForm } from '@/components/auth/LoginForm';
import { AuthWelcomeNotice } from '@/components/auth/AuthWelcomeNotice';
import { parseWorkspacePortal, type WorkspacePortal } from '@/lib/workspace-portal';

export default function PortalLoginPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const portal = parseWorkspacePortal(searchParams.get('portal'));
  const registeredNotice = searchParams.get('registered') === '1';
  const verifiedNotice = searchParams.get('verified') === '1';
  const pendingEmail = searchParams.get('email')?.trim() || '';

  const setPortal = useCallback(
    (nextPortal: WorkspacePortal) => {
      const next = new URLSearchParams(searchParams);
      next.set('portal', nextPortal);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const title = portal === 'admin' ? 'Welcome back' : 'Employee sign in';
  const subtitle =
    portal === 'admin'
      ? 'Sign in to your business workspace'
      : 'Sign in with your employee account';

  const sidebarNotice =
    portal === 'admin' && (registeredNotice || verifiedNotice) ? (
      <AuthWelcomeNotice
        variant={verifiedNotice ? 'verified' : 'registered'}
        email={pendingEmail || undefined}
      />
    ) : null;

  return (
    <AuthShell
      portal={portal}
      onPortalChange={setPortal}
      sidebarNotice={sidebarNotice}
    >
      {portal === 'admin' && (registeredNotice || verifiedNotice) && (
        <div className="mb-4 lg:hidden">
          <AuthWelcomeNotice
            variant={verifiedNotice ? 'verified' : 'registered'}
            email={pendingEmail || undefined}
            compact
          />
        </div>
      )}
      <LoginForm portal={portal} title={title} subtitle={subtitle} embedded />
    </AuthShell>
  );
}
