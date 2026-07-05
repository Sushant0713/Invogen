import { useQuery } from '@tanstack/react-query';
import { Users, Package, FileText, DollarSign } from 'lucide-react';
import api from '@/api/client';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => (await api.get('/admin/dashboard')).data.data,
  });
  if (isLoading) return <Loader />;
  const stats = data?.stats || {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Customers" value={stats.customers || 0} icon={Users} />
        <StatCard title="Products" value={stats.products || 0} icon={Package} />
        <StatCard title="Invoices" value={stats.invoices || 0} icon={FileText} />
        <StatCard title="Revenue" value={formatCurrency(stats.revenue || 0)} icon={DollarSign} />
      </div>
      <Card>
        <CardHeader><CardTitle>Recent Invoices</CardTitle></CardHeader>
        <DataTable
          columns={[
            { key: 'invoiceNumber', label: 'Invoice' },
            { key: 'customerId', label: 'Customer', render: (r) => (r.customerId as { name?: string })?.name || '-' },
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
