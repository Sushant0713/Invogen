import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { StatCard } from '@/components/dashboard/StatCard';
import { DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';

export default function SuperAdminRevenue() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-revenue'],
    queryFn: async () => (await api.get('/super-admin/revenue')).data.data,
  });
  if (isLoading) return <Loader />;
  const chartData = (data?.monthly || []).map((m: { _id: string; total: number }) => ({
    name: m._id,
    value: m.total,
  }));
  return (
    <div className="space-y-6">
      <StatCard title="Total Revenue" value={formatCurrency(data?.total || 0)} icon={DollarSign} />
      <ChartCard title="Monthly Revenue" data={chartData.length ? chartData : [{ name: 'N/A', value: 0 }]} />
    </div>
  );
}
