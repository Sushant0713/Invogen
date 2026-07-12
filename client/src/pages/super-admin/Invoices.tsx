import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownWideNarrow, ArrowUpWideNarrow, CalendarRange, Eye, Loader2 } from 'lucide-react';
import api from '@/api/client';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { formatRevenueRangeLabel, getPresetRange, type RevenuePreset } from '@/lib/revenue-chart';
import { resolveInvoiceTotal } from '@/features/invoice-composer/invoice-totals';

type InvoiceRow = {
  _id: string;
  invoiceNumber: string;
  status: string;
  createdAt: string;
  totals?: { total?: number };
  customerSnapshot?: { placeholders?: Record<string, unknown> };
  companyId?: { name?: string; invoiceCode?: string } | string;
};

type InvoiceSort = 'newest' | 'oldest';

const DATE_PRESETS: { id: RevenuePreset; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '3m', label: '3 months' },
  { id: '12m', label: '12 months' },
  { id: 'all', label: 'All time' },
];

function getCompanyName(companyId: InvoiceRow['companyId']): string {
  if (!companyId) return '-';
  if (typeof companyId === 'string') return companyId;
  return companyId.name || '-';
}

function getCompanyCode(companyId: InvoiceRow['companyId']): string | null {
  if (!companyId || typeof companyId === 'string') return null;
  return companyId.invoiceCode || null;
}

export default function SuperAdminInvoices() {
  const initialRange = getPresetRange('all');
  const [page, setPage] = useState(1);
  const [preset, setPreset] = useState<RevenuePreset | null>('all');
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [sort, setSort] = useState<InvoiceSort>('newest');

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['super-admin-platform-invoices', page, fromDate, toDate, sort],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 20, sort };
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      return (await api.get('/super-admin/invoices', { params })).data;
    },
  });

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, sort]);

  const handlePreset = (nextPreset: RevenuePreset) => {
    const range = getPresetRange(nextPreset);
    setPreset(nextPreset);
    setFromDate(range.from);
    setToDate(range.to);
  };

  const invoices = (data?.data || []) as InvoiceRow[];
  const meta = data?.meta;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform invoices</h1>
        <p className="mt-1 text-sm text-gray-500">
          Subscription billing invoices issued to your clients. Customer invoices created by admins and
          employees are not shown here.
        </p>
      </div>

      <Card glass={false} className="border border-gray-100 bg-white shadow-sm">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Filter invoices</p>
                <p className="text-xs text-muted-foreground">
                  {formatRevenueRangeLabel(fromDate, toDate)} · changes apply instantly
                </p>
              </div>
            </div>
            {isFetching ? (
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating…
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={preset === item.id ? 'primary' : 'outline'}
                onClick={() => handlePreset(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input
              label="From"
              type="date"
              value={fromDate}
              onChange={(event) => {
                setPreset(null);
                setFromDate(event.target.value);
              }}
            />
            <Input
              label="To"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => {
                setPreset(null);
                setToDate(event.target.value);
              }}
            />
            <div className="md:col-span-2 xl:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Sort by date</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={sort === 'newest' ? 'primary' : 'outline'}
                  onClick={() => setSort('newest')}
                >
                  <ArrowDownWideNarrow className="h-4 w-4" />
                  Newest first
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={sort === 'oldest' ? 'primary' : 'outline'}
                  onClick={() => setSort('oldest')}
                >
                  <ArrowUpWideNarrow className="h-4 w-4" />
                  Oldest first
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {isError ? (
        <Card glass={false} className="border border-red-100 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-800">Could not load platform invoices.</p>
          <p className="mt-1 text-xs text-red-700">
            {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
              'Please check your connection and try again.'}
          </p>
          <Button type="button" size="sm" className="mt-4" onClick={() => void refetch()}>
            Retry
          </Button>
        </Card>
      ) : null}

      <DataTable
        columns={[
          {
            key: 'invoiceNumber',
            label: 'Invoice',
            render: (row) => {
              const invoice = row as InvoiceRow;
              const code = getCompanyCode(invoice.companyId);
              return (
                <div>
                  <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                  {code ? (
                    <p className="text-xs text-muted-foreground">
                      {getCompanyName(invoice.companyId)} · {code}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{getCompanyName(invoice.companyId)}</p>
                  )}
                </div>
              );
            },
          },
          {
            key: 'companyId',
            label: 'Client',
            render: (row) => getCompanyName((row as InvoiceRow).companyId),
          },
          {
            key: 'amount',
            label: 'Amount',
            render: (row) =>
              formatCurrency(
                resolveInvoiceTotal({
                  totals: (row as InvoiceRow).totals,
                  customerSnapshot: (row as InvoiceRow).customerSnapshot,
                })
              ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) => <Badge>{String((row as InvoiceRow).status)}</Badge>,
          },
          {
            key: 'createdAt',
            label: 'Date',
            render: (row) => formatDate((row as InvoiceRow).createdAt),
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => {
              const invoice = row as InvoiceRow;
              return (
                <Link to={`/super-admin/invoices/${invoice._id}/view`}>
                  <Button type="button" variant="outline" size="sm">
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                </Link>
              );
            },
          },
        ]}
        data={invoices}
        keyField="_id"
        loading={isPending || isFetching}
        pagination={
          meta && meta.totalPages > 1
            ? { page: meta.page, totalPages: meta.totalPages, onPageChange: setPage }
            : undefined
        }
      />
    </div>
  );
}
