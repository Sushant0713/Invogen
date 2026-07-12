import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader } from '@/components/ui/Loader';
import { isSubscriptionCheckoutPath } from '@/lib/subscription-routes';
import { useSubscriptionStatus } from '@/hooks/useAdminSubscription';

export function AdminSubscriptionGate() {
  const location = useLocation();
  const { data, isLoading, isError } = useSubscriptionStatus();

  if (isLoading) return <Loader fullScreen />;

  if (isError) {
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
