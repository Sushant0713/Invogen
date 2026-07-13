import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader } from '@/components/ui/Loader';
import { isSubscriptionCheckoutPath } from '@/lib/subscription-routes';
import { useSubscriptionStatus } from '@/hooks/useAdminSubscription';
import { MAINTENANCE_QUERY_KEY } from '@/lib/maintenance-status-cache';
import type { MaintenanceStatus } from '@/lib/maintenance-status-cache';

export function AdminSubscriptionGate() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useSubscriptionStatus();

  if (isLoading) return <Loader fullScreen />;

  if (isError) {
    const maintenance = queryClient.getQueryData<MaintenanceStatus>(MAINTENANCE_QUERY_KEY);
    if (maintenance?.enabled) {
      return <Navigate to="/maintenance" replace />;
    }
    return <Navigate to="/login?portal=admin" replace />;
  }

  const onCheckoutFlow = isSubscriptionCheckoutPath(location.pathname);

  if (!data?.active && !onCheckoutFlow) {
    if (location.pathname.startsWith('/admin/subscription')) {
      return <Navigate to="/admin/subscription/plans" replace />;
    }
    return <Navigate to="/admin/subscription/plans" replace />;
  }

  return <Outlet />;
}
