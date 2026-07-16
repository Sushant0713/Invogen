import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Package, FileText, DollarSign, TrendingUp } from 'lucide-react';
import api from '@/api/client';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';
import { resolveInvoiceTotal } from '@/features/invoice-composer/invoice-totals';

export default function AdminDashboard() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => (await api.get('/admin/dashboard')).data.data,
  });
  if (isLoading) return <Loader />;
  const stats = data?.stats || {};
  
  const maxInvoices = data?.subscription?.planId?.maxInvoices;
  const totalUsedInvoices = data?.totalUsedInvoices || 0;
  const invoicesLeft = maxInvoices !== undefined ? Math.max(0, maxInvoices - totalUsedInvoices) : 'Unlimited';

  const employeeStats = data?.employeeInvoiceStats || [];
  const selectedEmployeeStat = employeeStats.find((s: any) => s.userId === selectedEmployeeId);
  const employeeInvoiceCount = selectedEmployeeId === 'all' 
    ? totalUsedInvoices 
    : (selectedEmployeeStat?.invoiceCount || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Used Invoices: {employeeInvoiceCount}</h3>
          <p className="text-sm text-gray-500">Sent + Paid invoices</p>
        </div>
        <div>
          <select 
            className="block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
          >
            <option value="all">All Employees</option>
            {employeeStats.map((emp: any) => (
              <option key={emp.userId} value={emp.userId}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          title="Invoices Left"
          value={invoicesLeft}
          icon={FileText}
          trend={maxInvoices !== undefined ? `Out of ${maxInvoices} max` : 'No limit on plan'}
        />
        <StatCard title="Customers" value={stats.customers || 0} icon={Users} />
        <StatCard title="Products" value={stats.products || 0} icon={Package} />
        <StatCard title="Invoices" value={stats.invoices || 0} icon={FileText} />
        <StatCard
          title="Actual revenue"
          value={formatCurrency(stats.actualRevenue || 0)}
          icon={DollarSign}
          trend="Collected from paid invoices"
        />
        <StatCard
          title="Expected revenue"
          value={formatCurrency(stats.expectedRevenue || 0)}
          icon={TrendingUp}
          trend="Outstanding on sent invoices"
        />
      </div>
      <Card>
        <CardHeader><CardTitle>Recent Invoices</CardTitle></CardHeader>
        <DataTable
          columns={[
            { key: 'invoiceNumber', label: 'Invoice' },
            { key: 'customerId', label: 'Customer', render: (r) => (r.customerId as { name?: string })?.name || '-' },
            { key: 'status', label: 'Status' },
            {
              key: 'total',
              label: 'Total',
              render: (r) =>
                formatCurrency(
                  resolveInvoiceTotal({
                    totals: r.totals as { total?: number },
                    customerSnapshot: r.customerSnapshot as { placeholders?: Record<string, unknown> },
                  })
                ),
            },
            { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
          ]}
          data={data?.recentInvoices || []}
          keyField="_id"
        />
      </Card>
    </div>
  );
}
