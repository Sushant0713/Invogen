import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';
import { Plus, X } from 'lucide-react';
import { InvoiceRowActions } from '@/features/invoice-composer/InvoiceRowActions';
import { InvoiceListStatusToggle } from '@/features/invoice-composer/InvoiceListStatusToggle';
import { resolveInvoiceTotal } from '@/features/invoice-composer/invoice-totals';

const PAGE_SIZE = 10;

export default function AdminInvoices() {
  const [searchParams, setSearchParams] = useSearchParams();
  const customerId = searchParams.get('customerId') ?? undefined;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [customerId]);

  const listQueryKey = ['admin-invoices', customerId, page] as const;

  const { data, isLoading } = useQuery({
    queryKey: listQueryKey,
    queryFn: async () =>
      (
        await api.get('/admin/invoices', {
          params: {
            page,
            limit: PAGE_SIZE,
            ...(customerId ? { customerId } : {}),
          },
        })
      ).data,
  });

  if (isLoading) return <Loader />;

  const meta = data?.meta as { page: number; totalPages: number; total: number } | undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Invoices</h1>
          <p className="mt-1 text-sm text-gray-500">Create, view, and share customer invoices.</p>
        </div>
        <Link to="/admin/invoices/new">
          <Button>
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </Link>
      </div>
      {customerId ? (
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-gray-700">
          <span>Showing invoices for selected customer</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            onClick={() => {
              searchParams.delete('customerId');
              setSearchParams(searchParams, { replace: true });
            }}
          >
            <X className="h-3.5 w-3.5" />
            Clear filter
          </button>
        </div>
      ) : null}
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
          {
            key: 'status',
            label: 'Status',
            render: (r) => {
              const snap = r.customerSnapshot as { platformInvoice?: boolean } | undefined;
              if (snap?.platformInvoice) {
                return <Badge>{String(r.status)}</Badge>;
              }
              return (
                <InvoiceListStatusToggle
                  invoiceId={String(r._id)}
                  status={String(r.status)}
                  invoicesApi="/admin/invoices"
                  listQueryKey={[...listQueryKey]}
                />
              );
            },
          },
          {
            key: 'totals',
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
                  status={String(r.status)}
                  invoicesApi="/admin/invoices"
                  listQueryKey={[...listQueryKey]}
                  editPathPrefix="/admin/invoices"
                  viewPathPrefix="/admin/invoices"
                  sharesQueryKey={['admin-invoice-shares']}
                  customerName={snap?.name || populated?.name}
                  customerEmail={snap?.email || populated?.email}
                />
              );
            },
          },
        ]}
        data={data?.data || []}
        keyField="_id"
        pagination={
          meta && meta.totalPages > 1
            ? {
                page: meta.page,
                totalPages: meta.totalPages,
                onPageChange: setPage,
              }
            : undefined
        }
      />
    </div>
  );
}
