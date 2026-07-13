import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { UserRole } from '@invogen/shared';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import { useMaintenanceStatus } from '@/hooks/useMaintenanceStatus';
import { clearSession } from '@/lib/auth-session';
import { logout as logoutAction } from '@/store/slices/authSlice';
import {
  isTenantPortalPath,
  shouldEnforceMaintenance,
} from '@/lib/maintenance-routes';
import { cn } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';

const linkButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200';

function isTenantUser(role?: UserRole) {
  return role === UserRole.ADMIN || role === UserRole.EMPLOYEE;
}

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { data: maintenance, isLoading } = useMaintenanceStatus();
  const enforcePath = shouldEnforceMaintenance(location.pathname);

  useEffect(() => {
    if (!maintenance?.enabled || !isTenantUser(user?.role)) return;
    if (!enforcePath && !isTenantPortalPath(location.pathname)) return;

    clearSession();
    dispatch(logoutAction());
  }, [dispatch, enforcePath, location.pathname, maintenance?.enabled, user?.role]);

  if (isLoading && enforcePath) {
    return <Loader fullScreen />;
  }

  if (!maintenance?.enabled) return <>{children}</>;

  if (user?.role === UserRole.SUPER_ADMIN) return <>{children}</>;

  if (enforcePath && location.pathname !== '/maintenance') {
    return <Navigate to="/maintenance" replace />;
  }

  return <>{children}</>;
}

export default function MaintenancePage() {
  const { data: maintenance, isLoading, refetch, isFetching } = useMaintenanceStatus();

  if (!isLoading && maintenance && !maintenance.enabled) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-orange-50 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Construction className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Under maintenance</h1>
        <p className="mt-2 text-sm text-gray-500">
          {maintenance?.companyName || 'Invogen'} is temporarily unavailable
        </p>
        <p className="mt-6 text-sm leading-relaxed text-gray-700">
          {maintenance?.message ||
            'We are currently performing scheduled maintenance. Please check back soon.'}
        </p>
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className={cn(
              linkButtonClass,
              'border-2 border-primary text-primary hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60'
            )}
          >
            {isFetching ? 'Checking…' : 'Retry'}
          </button>
        </div>
      </div>
    </div>
  );
}
