import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import api from '@/api/client';
import { Loader } from '@/components/ui/Loader';

export default function SubscriptionIndex() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-subscription-status'],
    queryFn: async () => (await api.get('/admin/subscription/status')).data.data as { active: boolean },
    staleTime: 0,
  });

  if (isLoading) return <Loader fullScreen />;

  return <Navigate to={data?.active ? '/admin/subscription/my-plan' : '/admin/subscription/plans'} replace />;
}
