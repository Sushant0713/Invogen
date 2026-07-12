import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarRange, Clock3, FileText, Loader2, Search } from 'lucide-react';
import api from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import {
  getReportPresetRange,
  REPORT_DATE_PRESETS,
  type ReportDatePreset,
} from '@/features/reports/report-filters';

type OutstandingReportResponse = {
  from: string;
  to: string;
  summary: {
    totalOutstanding: number;
    invoiceOutstanding: number;
    paymentOutstanding: number;
    totalItems: number;
  };
  rows: Array<{
    id: string;
    type: 'invoice' | 'payment';
    reference: string;
    clientName: string;
    amount: number;
    status: string;
    dueDate: string | null;
    createdAt: string;
  }>;
  rowsMeta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const selectClassName =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

export function OutstandingReportTab() {
  const [datePreset, setDatePreset] = useState<ReportDatePreset>('this_month');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  const range = useMemo(() => getReportPresetRange(datePreset), [datePreset]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['super-admin-reports-outstanding', datePreset, range.from, range.to, search, page],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        preset: datePreset,
        from: range.from,
        to: range.to,
        search,
        page,
        limit: 10,
      };
      return (await api.get('/super-admin/reports/outstanding', { params })).data
        .data as OutstandingReportResponse;
    },
  });

  if (isLoading && !data) return <Loader />;

  const summary = data?.summary;
  const rows = data?.rows ?? [];
  const meta = data?.rowsMeta;

  return (
    <div className="space-y-5">
      <Card glass={false} className="border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-4">
          <label className="block min-w-[180px] flex-1">
            <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              <CalendarRange className="h-3.5 w-3.5" />
              Date Range
            </span>
            <select
              className={selectClassName}
              value={datePreset}
              onChange={(event) => {
                setDatePreset(event.target.value as ReportDatePreset);
                setPage(1);
              }}
            >
              {REPORT_DATE_PRESETS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-[220px] flex-1">
            <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              <Search className="h-3.5 w-3.5" />
              Search
            </span>
            <div className="flex gap-2">
              <Input
                placeholder="Client, reference…"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    setSearch(searchInput.trim());
                    setPage(1);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch(searchInput.trim());
                  setPage(1);
                }}
              >
                Search
              </Button>
            </div>
          </label>
        </div>

        {isFetching ? (
          <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Updating report…
          </p>
        ) : null}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden p-5">
          <div className="absolute inset-y-0 left-0 w-1 bg-amber-400" />
          <div className="pl-2">
            <p className="text-sm font-medium text-gray-500">Total Outstanding</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatCurrency(summary?.totalOutstanding ?? 0)}
            </p>
          </div>
        </Card>
        <Card className="relative overflow-hidden p-5">
          <div className="absolute inset-y-0 left-0 w-1 bg-violet-500" />
          <div className="pl-2">
            <p className="text-sm font-medium text-gray-500">Sent Invoices</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatCurrency(summary?.invoiceOutstanding ?? 0)}
            </p>
          </div>
        </Card>
        <Card className="relative overflow-hidden p-5">
          <div className="absolute inset-y-0 left-0 w-1 bg-orange-500" />
          <div className="pl-2">
            <p className="text-sm font-medium text-gray-500">Pending Payments</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatCurrency(summary?.paymentOutstanding ?? 0)}
            </p>
          </div>
        </Card>
      </div>

      <Card glass={false} className="overflow-hidden border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Outstanding Items</h2>
          <p className="text-sm text-gray-500">
            Sent platform invoices and pending subscription payments awaiting collection
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="px-4 py-3 font-medium text-gray-600">Reference</th>
                <th className="px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Due Date</th>
                <th className="px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="px-4 py-3 font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                    No outstanding items found for these filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={`${row.type}-${row.id}`} className="border-b border-gray-50 hover:bg-primary-50/20">
                    <td className="px-4 py-3 capitalize text-gray-700">{row.type}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.reference}</td>
                    <td className="px-4 py-3 text-gray-700">{row.clientName}</td>
                    <td className="px-4 py-3 font-medium text-amber-600">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize',
                          row.status === 'pending'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-blue-50 text-blue-700',
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.dueDate ? formatDate(row.dueDate) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-3">
                      {row.type === 'invoice' ? (
                        <Link
                          to={`/super-admin/invoices/${row.id}/view`}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <FileText className="h-4 w-4" />
                          View
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <Clock3 className="h-4 w-4" />
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta && meta.total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
            <p className="text-sm text-gray-500">
              Showing {(meta.page - 1) * meta.limit + 1} to{' '}
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} items
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={meta.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
