import { useQuery } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import api from '@/api/client';
import { Loader } from '@/components/ui/Loader';
import { isSubscriptionCheckoutPath } from '@/lib/subscription-routes';

interface SubscriptionStatusResponse {
  active: boolean;
}

export function AdminSubscriptionGate() {
  const location = useLocation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-subscription-status'],
    queryFn: async () => {
      const { data } = await api.get<{ data: SubscriptionStatusResponse }>('/admin/subscription/status');
      return data.data;
    },
    staleTime: 0,
    retry: false,
  });

  if (isLoading) return <Loader fullScreen />;

  if (isError) {
    return <Navigate to="/admin/login" replace />;
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
