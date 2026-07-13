import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';
import { Plus, Trash2, X } from 'lucide-react';
import { InvoiceRowActions } from '@/features/invoice-composer/InvoiceRowActions';
import { InvoiceListStatusToggle } from '@/features/invoice-composer/InvoiceListStatusToggle';
import { resolveInvoiceTotal } from '@/features/invoice-composer/invoice-totals';
import { deleteInvoicesApi } from '@/features/invoice-composer/invoice-share';
import { confirmToast } from '@/lib/confirm-toast';
import { toast } from 'sonner';

const PAGE_SIZE = 10;

type InvoiceRow = Record<string, unknown> & {
  _id: string;
  invoiceNumber?: string;
  status?: string;
  createdAt?: string;
};

function isDeletableInvoice(row: InvoiceRow): boolean {
  const snap = row.customerSnapshot as { platformInvoice?: boolean } | undefined;
  if (snap?.platformInvoice) return false;
  return String(row.status) === 'draft';
}

export default function AdminInvoices() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const customerId = searchParams.get('customerId') ?? undefined;
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
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

  const rows = (data?.data || []) as InvoiceRow[];
  const meta = data?.meta as { page: number; totalPages: number; total: number } | undefined;

  const selectableIds = useMemo(
    () => rows.filter(isDeletableInvoice).map((row) => String(row._id)),
    [rows]
  );

  const allVisibleSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => selectableIds.includes(id)));
  }, [selectableIds]);

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteInvoicesApi('/admin/invoices', ids),
    onSuccess: (result) => {
      const skippedNote =
        result.skipped > 0 ? ` (${result.skipped} skipped — only drafts can be deleted)` : '';
      toast.success(
        `Permanently deleted ${result.deleted} invoice${result.deleted === 1 ? '' : 's'}${skippedNote}`
      );
      setSelectedIds([]);
      void queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-invoice-shares'] });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to delete invoices');
    },
  });

  const toggleRow = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !selectableIds.includes(id)));
      return;
    }
    setSelectedIds((current) => [...new Set([...current, ...selectableIds])]);
  };

  const handleDeleteSelected = async () => {
    if (!selectedIds.length) return;
    const confirmed = await confirmToast(
      `Permanently delete ${selectedIds.length} selected invoice${selectedIds.length === 1 ? '' : 's'}?`,
      {
        variant: 'danger',
        confirmLabel: 'Delete permanently',
        description: 'This action cannot be undone. Only draft invoices will be removed.',
      }
    );
    if (!confirmed) return;
    deleteMutation.mutate(selectedIds);
  };

  if (isLoading) return <Loader />;

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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          {selectedIds.length > 0 ? (
            <span>{selectedIds.length} selected</span>
          ) : (
            <span>Select draft invoices to delete</span>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="danger"
          disabled={!selectedIds.length || deleteMutation.isPending}
          onClick={() => void handleDeleteSelected()}
        >
          <Trash2 className="h-4 w-4" />
          Delete selected
        </Button>
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
          { key: 'createdAt', label: 'Created', render: (r) => formatDate(r.createdAt as string) },
          {
            key: 'issueDate',
            label: 'Invoice date',
            render: (r) => formatDate((r.issueDate as string) || (r.createdAt as string)),
          },
          {
            key: 'dueDate',
            label: 'Due date',
            render: (r) => (r.dueDate ? formatDate(r.dueDate as string) : '—'),
          },
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
        data={rows}
        keyField="_id"
        selection={{
          selectedIds,
          onToggleRow: toggleRow,
          onToggleAllVisible: toggleSelectAllVisible,
          isRowSelectable: (row) => isDeletableInvoice(row as InvoiceRow),
          selectAllLabel: 'Select all draft invoices on page',
        }}
        pagination={
          meta && meta.totalPages > 1
            ? {
                page: meta.page,
                totalPages: meta.totalPages,
                onPageChange: (nextPage) => {
                  setPage(nextPage);
                  setSelectedIds([]);
                },
              }
            : undefined
        }
      />
    </div>
  );
}
