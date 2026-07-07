import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';
import { Plus } from 'lucide-react';
import { InvoiceRowActions } from '@/features/invoice-composer/InvoiceRowActions';

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
          <h1 className="text-2xl font-bold text-gray-900">All Invoices</h1>
          <p className="mt-1 text-sm text-gray-500">Create, view, share, and delete customer invoices.</p>
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
          {
            key: 'customerId',
            label: 'Customer',
            render: (r) => {
              const snap = r.customerSnapshot as { name?: string; email?: string } | undefined;
              const populated = r.customerId as { name?: string } | undefined;
              return snap?.name || populated?.name || '-';
            },
          },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status as string}</Badge> },
          { key: 'totals', label: 'Total', render: (r) => (r.totals as { total?: number })?.total || 0 },
          { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
          {
            key: 'actions',
            label: 'Actions',
            render: (r) => {
              const snap = r.customerSnapshot as { name?: string; email?: string } | undefined;
              const populated = r.customerId as { name?: string; email?: string } | undefined;
              return (
                <InvoiceRowActions
                  invoiceId={String(r._id)}
                  invoiceNumber={String(r.invoiceNumber)}
                  invoicesApi="/admin/invoices"
                  listQueryKey={['admin-invoices']}
                  editPathPrefix="/admin/invoices"
                  viewPathPrefix="/admin/invoices"
                  customerName={snap?.name || populated?.name}
                  customerEmail={snap?.email || populated?.email}
                />
              );
            },
          },
        ]}
        data={data?.data || []}
        keyField="_id"
      />
    </div>
  );
}
