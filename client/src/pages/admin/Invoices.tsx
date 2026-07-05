import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';
import { Plus } from 'lucide-react';

export default function AdminInvoices() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-invoices'],
    queryFn: async () => (await api.get('/admin/invoices')).data,
  });
  if (isLoading) return <Loader />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="mt-1 text-sm text-gray-500">Create, manage, and share customer invoices.</p>
        </div>
        <Link to="/admin/invoices/new">
          <Button>
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </Link>
      </div>
      <DataTable
        columns={[
          { key: 'invoiceNumber', label: 'Invoice' },
          { key: 'customerId', label: 'Customer', render: (r) => (r.customerId as { name?: string })?.name || '-' },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status as string}</Badge> },
          { key: 'totals', label: 'Total', render: (r) => (r.totals as { total?: number })?.total || 0 },
          { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
        ]}
        data={data?.data || []}
        keyField="_id"
      />
    </div>
  );
}
