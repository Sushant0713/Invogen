import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { StatCard } from '@/components/dashboard/StatCard';
import { FileText } from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';
import { useAppSelector } from '@/hooks/useAppDispatch';
import { PERMISSIONS } from '@invogen/shared';

export default function EmployeeDashboard() {
  const permissions = useAppSelector((s) => s.auth.user?.permissions ?? []);
  const canEditInvoices = permissions.includes(PERMISSIONS.INVOICE_EDIT);
  const { data, isLoading } = useQuery({
    queryKey: ['employee-dashboard'],
    queryFn: async () => (await api.get('/employee/dashboard')).data.data,
  });
  if (isLoading) return <Loader />;
  return (
    <div className="space-y-6">
      <StatCard
        title={canEditInvoices ? 'All Invoices' : 'My Invoices'}
        value={data?.totalInvoices || 0}
        icon={FileText}
      />
      <DataTable
        columns={[
          { key: 'invoiceNumber', label: 'Invoice' },
          { key: 'status', label: 'Status' },
          { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
        ]}
        data={data?.recentInvoices || []}
        keyField="_id"
      />
    </div>
  );
}
