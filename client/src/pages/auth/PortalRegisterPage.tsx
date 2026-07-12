import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthShell } from '@/components/auth/AuthShell';
import RegisterPage from '@/pages/auth/RegisterPage';
import { EmployeeRegisterForm } from '@/pages/auth/EmployeeRegister';
import { parseWorkspacePortal, type WorkspacePortal } from '@/lib/workspace-portal';

export default function PortalRegisterPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const portal = parseWorkspacePortal(searchParams.get('portal'));

  const setPortal = useCallback(
    (nextPortal: WorkspacePortal) => {
      const next = new URLSearchParams(searchParams);
      next.set('portal', nextPortal);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <AuthShell
      portal={portal}
      onPortalChange={setPortal}
      contentMaxWidth={portal === 'admin' ? 'xl' : 'md'}
      wrapInGlass={portal === 'employee'}
    >
      {portal === 'admin' ? <RegisterPage embedded /> : <EmployeeRegisterForm />}
    </AuthShell>
  );
}
