import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  CalendarRange,
  CircleDollarSign,
  Clock3,
  Download,
  Eye,
  FileText,
  Loader2,
  Search,
  UserRound,
} from 'lucide-react';
import api from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { toDateInputValue } from '@/lib/revenue-chart';
import { CustomerRevenueTrendChart } from '@/features/reports/CustomerRevenueTrendChart';
import { CustomerRevenueDonut } from '@/features/reports/CustomerRevenueDonut';
import {
  formatTrendLabel,
  getReportPresetRange,
  REPORT_DATE_PRESETS,
  type ReportDatePreset,
} from '@/features/reports/report-filters';

type ClientsReportResponse = {
  from: string;
  to: string;
  groupBy: 'day' | 'month';
  summary: {
    totalClients: number;
    newClientsInPeriod: number;
    totalInvoices: number;
    totalInvoicesChange: number | null;
    revenueCollected: number;
    revenueCollectedChange: number | null;
    outstanding: number;
    outstandingChange: number | null;
  };
  trend: Array<{ period: string; revenueCollected: number }>;
  distribution: {
    top5: number;
    next10: number;
    others: number;
    total: number;
    top5Percent: number;
  };
  ledger: Array<{
    clientKey: string;
    clientId: string | null;
    name: string;
    email: string;
    totalInvoices: number;
    totalBilled: number;
    revenueCollected: number;
    outstanding: number;
    lastInvoiceDate: string | null;
    lifetimeCollected: number;
  }>;
  ledgerMeta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type KpiCardProps = {
  title: string;
  value: string;
  trend?: string;
  trendPositive?: boolean;
  subtitle?: string;
  icon: React.ReactNode;
  accent: string;
};

function KpiCard({ title, value, trend, trendPositive, subtitle, icon, accent }: KpiCardProps) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className={cn('absolute inset-y-0 left-0 w-1', accent)} />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 sm:text-3xl">{value}</p>
          {trend ? (
            <p
              className={cn(
                'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                trendPositive === false
                  ? 'bg-red-50 text-red-700'
                  : trendPositive === true
                    ? 'bg-green-50 text-green-700'
                    : 'text-green-600',
              )}
            >
              {trendPositive === true ? <ArrowUp className="h-3 w-3" /> : null}
              {trendPositive === false ? <ArrowDown className="h-3 w-3" /> : null}
              {trend}
            </p>
          ) : null}
          {subtitle ? <p className="mt-1 text-xs text-gray-400">{subtitle}</p> : null}
        </div>
        <div className="rounded-xl bg-gray-50 p-2.5 text-gray-700">{icon}</div>
      </div>
    </Card>
  );
}

const selectClassName =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

function formatNewClientsLabel(count: number) {
  if (count <= 0) return undefined;
  return `+${count} New this month`;
}

function formatOutstandingTrend(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return undefined;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}% pending payments`;
}

function exportLedgerCsv(rows: ClientsReportResponse['ledger'], from: string, to: string) {
  const headers = [
    'Client',
    'Email',
    'Total Invoices',
    'Total Billed',
    'Revenue Collected',
    'Outstanding',
    'Last Invoice Date',
  ];
  const lines = rows.map((row) => [
    row.name,
    row.email,
    row.totalInvoices,
    row.totalBilled,
    row.revenueCollected,
    row.outstanding,
    row.lastInvoiceDate ? formatDate(row.lastInvoiceDate) : '',
  ]);
  const csv = [headers, ...lines]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `client-revenue-ledger-${from}-to-${to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const SORT_COLUMNS = [
  { key: 'name', label: 'Client / Company' },
  { key: 'invoices', label: 'Total Invoices' },
  { key: 'billed', label: 'Total Billed' },
  { key: 'collected', label: 'Revenue Collected' },
  { key: 'outstanding', label: 'Outstanding' },
  { key: 'lastInvoice', label: 'Last Invoice Date' },
] as const;

export function ClientsReportTab() {
  const [datePreset, setDatePreset] = useState<ReportDatePreset>('this_month');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('collected');

  const range = useMemo(() => getReportPresetRange(datePreset), [datePreset]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['super-admin-reports-clients', datePreset, range.from, range.to, search, page, sort],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        preset: datePreset,
        from: range.from,
        to: range.to,
        search,
        page,
        limit: 8,
        sort,
      };
      return (await api.get('/super-admin/reports/clients', { params })).data.data as ClientsReportResponse;
    },
  });

  const fromDate = data?.from ? toDateInputValue(new Date(data.from)) : range.from;
  const toDate = data?.to ? toDateInputValue(new Date(data.to)) : range.to;

  if (isLoading && !data) return <Loader />;

  const summary = data?.summary;
  const ledger = data?.ledger ?? [];
  const meta = data?.ledgerMeta;
  const outstandingChange = summary?.outstandingChange;

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

          <label className="block min-w-[260px] flex-[2]">
            <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              <Search className="h-3.5 w-3.5" />
              Search Client
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search by name, email or ID..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    setSearch(searchInput.trim());
                    setPage(1);
                  }
                }}
              />
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Clients"
          value={String(summary?.totalClients ?? 0)}
          trend={formatNewClientsLabel(summary?.newClientsInPeriod ?? 0)}
          trendPositive={(summary?.newClientsInPeriod ?? 0) > 0}
          icon={<UserRound className="h-5 w-5 text-violet-600" />}
          accent="bg-violet-500"
        />
        <KpiCard
          title="Total Invoices Generated"
          value={String(summary?.totalInvoices ?? 0)}
          trend={formatTrendLabel(summary?.totalInvoicesChange, 'vs last month')}
          trendPositive={summary?.totalInvoicesChange == null || summary.totalInvoicesChange >= 0}
          icon={<FileText className="h-5 w-5 text-blue-600" />}
          accent="bg-blue-500"
        />
        <KpiCard
          title="Total Revenue Collected"
          value={formatCurrency(summary?.revenueCollected ?? 0)}
          trend={formatTrendLabel(summary?.revenueCollectedChange, 'vs last month')}
          trendPositive={summary?.revenueCollectedChange == null || summary.revenueCollectedChange >= 0}
          icon={<CircleDollarSign className="h-5 w-5 text-green-600" />}
          accent="bg-green-500"
        />
        <KpiCard
          title="Outstanding Receivables"
          value={formatCurrency(summary?.outstanding ?? 0)}
          trend={formatOutstandingTrend(outstandingChange)}
          trendPositive={outstandingChange != null ? outstandingChange <= 0 : undefined}
          icon={<Clock3 className="h-5 w-5 text-amber-500" />}
          accent="bg-amber-400"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CustomerRevenueTrendChart
          data={data?.trend ?? []}
          groupBy={data?.groupBy ?? 'month'}
          from={fromDate}
          to={toDate}
        />
        <CustomerRevenueDonut distribution={data?.distribution ?? { top5: 0, next10: 0, others: 0, total: 0, top5Percent: 0 }} />
      </div>

      <Card glass={false} className="overflow-hidden border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Client Revenue Ledger</h2>
            <p className="text-sm text-gray-500">Billed, collected, and outstanding amounts by client</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => exportLedgerCsv(ledger, fromDate, toDate)}
            disabled={!ledger.length}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left">
                {SORT_COLUMNS.map((column) => (
                  <th key={column.key} className="px-4 py-3 font-medium text-gray-600">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-gray-900"
                      onClick={() => setSort(column.key)}
                    >
                      {column.label}
                      {sort === column.key ? <span className="text-primary">↓</span> : null}
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    No clients found for these filters.
                  </td>
                </tr>
              ) : (
                ledger.map((row) => {
                  const initial = row.name.trim().charAt(0).toUpperCase() || '?';
                  return (
                    <tr key={row.clientKey} className="border-b border-gray-50 hover:bg-primary-50/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {initial}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{row.name}</p>
                            {row.email ? <p className="text-xs text-gray-500">{row.email}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.totalInvoices}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {formatCurrency(row.totalBilled)}
                      </td>
                      <td className="px-4 py-3 font-medium text-green-600">
                        {formatCurrency(row.revenueCollected)}
                      </td>
                      <td className="px-4 py-3 font-medium text-amber-600">
                        {formatCurrency(row.outstanding)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.lastInvoiceDate ? formatDate(row.lastInvoiceDate) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {row.clientId ? (
                          <Link
                            to={`/super-admin/clients/${row.clientId}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {meta && meta.total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
            <p className="text-sm text-gray-500">
              Showing {(meta.page - 1) * meta.limit + 1} to{' '}
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} clients
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={meta.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, index) => index + 1).map(
                (pageNumber) => (
                  <Button
                    key={pageNumber}
                    type="button"
                    size="sm"
                    variant={pageNumber === meta.page ? 'primary' : 'outline'}
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </Button>
                ),
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage((current) => current + 1)}
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
