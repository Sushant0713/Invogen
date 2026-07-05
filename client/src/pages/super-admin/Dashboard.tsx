import { useQuery } from '@tanstack/react-query';
import { Users, CreditCard, DollarSign, FileText } from 'lucide-react';
import api from '@/api/client';
import { StatCard } from '@/components/dashboard/StatCard';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';
import { ActivityListItem } from '@/components/dashboard/ActivityListItem';
import type { ActivityUserRef } from '@/lib/activity';

export default function SuperAdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-dashboard'],
    queryFn: async () => {
      const res = await api.get('/super-admin/dashboard');
      return res.data.data;
    },
  });

  if (isLoading) return <Loader />;

  const stats = data?.stats || {};
  const chartData = (data?.recentPayments || []).map((p: { createdAt: string; amount: number }, i: number) => ({
    name: `P${i + 1}`,
    value: p.amount,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Clients" value={stats.clients || 0} icon={Users} />
        <StatCard title="Active Subscriptions" value={stats.activeSubscriptions || 0} icon={CreditCard} />
        <StatCard title="Total Revenue" value={formatCurrency(stats.totalRevenue || 0)} icon={DollarSign} />
        <StatCard title="Total Invoices" value={stats.totalInvoices || 0} icon={FileText} />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Recent Revenue" data={chartData.length ? chartData : [{ name: 'N/A', value: 0 }]} />
        <Card>
          <CardHeader><CardTitle>Recent Activities</CardTitle></CardHeader>
          <div className="space-y-3 max-h-64 overflow-auto">
            {(data?.recentActivities || []).map((a: {
              _id: string;
              description: string;
              createdAt: string;
              userId?: ActivityUserRef;
            }) => (
              <ActivityListItem
                key={a._id}
                description={a.description}
                createdAt={a.createdAt}
                userId={a.userId}
              />
            ))}
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Latest Invoices</CardTitle></CardHeader>
        <DataTable
          columns={[
            { key: 'invoiceNumber', label: 'Invoice' },
            { key: 'companyId', label: 'Company', render: (r) => (r.companyId as { name?: string })?.name || '-' },
            { key: 'status', label: 'Status' },
            { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
          ]}
          data={data?.recentInvoices || []}
          keyField="_id"
        />
      </Card>
    </div>
  );
}
