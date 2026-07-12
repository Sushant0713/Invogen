import { Navigate } from 'react-router-dom';
import { Loader } from '@/components/ui/Loader';
import { useSubscriptionStatus } from '@/hooks/useAdminSubscription';

export default function SubscriptionIndex() {
  const { data, isLoading } = useSubscriptionStatus();

  if (isLoading) return <Loader fullScreen />;

  return <Navigate to={data?.active ? '/admin/subscription/my-plan' : '/admin/subscription/plans'} replace />;
}
