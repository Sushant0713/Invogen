import { Link, useSearchParams } from 'react-router-dom';
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
import { useAppSelector } from '@/hooks/useAppDispatch';
import { PERMISSIONS } from '@invogen/shared';

export default function EmployeeInvoices() {
  const [searchParams, setSearchParams] = useSearchParams();
  const customerId = searchParams.get('customerId') ?? undefined;
  const permissions = useAppSelector((s) => s.auth.user?.permissions ?? []);
  const canCreate = permissions.includes(PERMISSIONS.INVOICE_CREATE);
  const canEdit = permissions.includes(PERMISSIONS.INVOICE_EDIT);
  const canStartInvoice = canCreate || canEdit;
  const { data, isLoading } = useQuery({
    queryKey: ['employee-invoices', customerId],
    queryFn: async () =>
      (await api.get('/employee/invoices', { params: customerId ? { customerId } : undefined })).data,
  });
  if (isLoading) return <Loader />;

  const subtitle = canEdit
    ? 'View and edit company invoices — same editor as admin.'
    : customerId
      ? 'Invoices for the selected customer.'
      : 'Create invoices from your company templates.';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {canEdit ? 'All Invoices' : 'Invoices'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>
        {canStartInvoice && (
          <Link to="/employee/invoices/new">
            <Button>
              <Plus className="h-4 w-4" />
              New Invoice
            </Button>
          </Link>
        )}
      </div>
      {customerId && (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <span>Showing invoices for this customer.</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              searchParams.delete('customerId');
              setSearchParams(searchParams, { replace: true });
            }}
          >
            <X className="h-3.5 w-3.5" />
            Clear filter
          </Button>
        </div>
      )}
      <DataTable
        columns={[
          { key: 'invoiceNumber', label: 'Invoice' },
          ...(canEdit
            ? [
                {
                  key: 'customerId',
                  label: 'Customer',
                  render: (r: Record<string, unknown>) => {
                    const snap = r.customerSnapshot as { name?: string; email?: string } | undefined;
                    const populated = r.customerId as { name?: string } | undefined;
                    return snap?.name || populated?.name || '-';
                  },
                },
              ]
            : []),
          {
            key: 'status',
            label: 'Status',
            render: (r: Record<string, unknown>) => {
              if (!canEdit) return String(r.status);
              const snap = r.customerSnapshot as { platformInvoice?: boolean } | undefined;
              if (snap?.platformInvoice) {
                return <Badge>{String(r.status)}</Badge>;
              }
              return (
                <InvoiceListStatusToggle
                  invoiceId={String(r._id)}
                  status={String(r.status)}
                  invoicesApi="/employee/invoices"
                  listQueryKey={['employee-invoices', customerId]}
                />
              );
            },
          },
          ...(canEdit
            ? [
                {
                  key: 'totals',
                  label: 'Total',
                  render: (r: Record<string, unknown>) =>
                    formatCurrency(
                      resolveInvoiceTotal({
                        totals: r.totals as { total?: number },
                        customerSnapshot: r.customerSnapshot as {
                          placeholders?: Record<string, unknown>;
                        },
                      })
                    ),
                },
              ]
            : []),
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
                  invoicesApi="/employee/invoices"
                  listQueryKey={['employee-invoices', customerId]}
                  editPathPrefix="/employee/invoices"
                  viewPathPrefix="/employee/invoices"
                  sharesQueryKey={['employee-invoice-shares']}
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
