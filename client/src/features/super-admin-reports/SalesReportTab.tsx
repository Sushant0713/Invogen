import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  CalendarRange,
  Download,
  FileText,
  IndianRupee,
  Loader2,
  MapPin,
  Search,
  Timer,
} from 'lucide-react';
import api from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { cn, formatCurrency } from '@/lib/utils';
import { toDateInputValue } from '@/lib/revenue-chart';
import { SalesTrendChart } from '@/features/reports/SalesTrendChart';
import {
  CURRENCY_FILTERS,
  formatGrowthPercent,
  formatTrendLabel,
  getReportPresetRange,
  INVOICE_STATUS_FILTERS,
  REPORT_DATE_PRESETS,
  type ReportDatePreset,
} from '@/features/reports/report-filters';
import { ReportStateFilter } from '@/features/reports/ReportStateFilter';

type SalesReportResponse = {
  platformName: string;
  from: string;
  to: string;
  groupBy: 'day' | 'month';
  summary: {
    totalSales: number;
    totalSalesChange: number | null;
    totalInvoices: number;
    totalInvoicesChange: number | null;
    actualRevenue: number;
    actualRevenueChange: number | null;
    paidSales: number;
  };
  trend: Array<{
    period: string;
    totalSales: number;
    paidSales: number;
    invoiceCount: number;
  }>;
  clients: Array<{
    clientKey: string;
    name: string;
    totalInvoices: number;
    totalSales: number;
    paidAmount: number;
    outstanding: number;
    avgInvoice: number;
    growthPercent: number | null;
  }>;
  clientsMeta: {
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
  icon: React.ReactNode;
  accent: string;
};

function KpiCard({ title, value, trend, icon, accent }: KpiCardProps) {
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
                'mt-2 text-xs font-medium',
                trend.includes('↘') ? 'text-red-600' : 'text-green-600',
              )}
            >
              {trend}
            </p>
          ) : null}
        </div>
        <div className="rounded-xl bg-gray-50 p-2.5 text-gray-700">{icon}</div>
      </div>
    </Card>
  );
}

function FilterField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-[150px] flex-1">
      <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

const selectClassName =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

function exportClientsCsv(rows: SalesReportResponse['clients'], platformName: string) {
  const headers = [
    'Client',
    'Total Invoices',
    'Total Sales Value',
    'Paid Amount',
    'Outstanding',
    'Avg Invoice',
    'Growth %',
  ];
  const lines = rows.map((row) => [
    row.name,
    row.totalInvoices,
    row.totalSales,
    row.paidAmount,
    row.outstanding,
    Math.round(row.avgInvoice),
    formatGrowthPercent(row.growthPercent),
  ]);
  const csv = [headers, ...lines]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${platformName.replace(/\s+/g, '-').toLowerCase()}-sales-report.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function SalesReportTab() {
  const [datePreset, setDatePreset] = useState<ReportDatePreset>('this_month');
  const [status, setStatus] = useState('all');
  const [state, setState] = useState('all');
  const [currency] = useState('INR');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('sales');

  const range = useMemo(() => getReportPresetRange(datePreset), [datePreset]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['super-admin-reports-sales', datePreset, range.from, range.to, status, state, search, page, sort],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        preset: datePreset,
        from: range.from,
        to: range.to,
        status,
        state,
        search,
        page,
        limit: 5,
        sort,
      };
      return (await api.get('/super-admin/reports/sales', { params })).data.data as SalesReportResponse;
    },
  });

  const fromDate = data?.from ? toDateInputValue(new Date(data.from)) : range.from;
  const toDate = data?.to ? toDateInputValue(new Date(data.to)) : range.to;

  if (isLoading && !data) return <Loader />;

  const summary = data?.summary;
  const clients = data?.clients ?? [];
  const meta = data?.clientsMeta;
  const platformName = data?.platformName ?? 'Invogen Platform';

  return (
    <div className="space-y-5">
      <Card glass={false} className="border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-4">
          <FilterField label="Date Range" icon={<CalendarRange className="h-3.5 w-3.5" />}>
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
          </FilterField>

          <FilterField label="Platform" icon={<Building2 className="h-3.5 w-3.5" />}>
            <select className={selectClassName} value="platform">
              <option value="platform">{platformName}</option>
            </select>
          </FilterField>

          <FilterField label="Invoice Status" icon={<Timer className="h-3.5 w-3.5" />}>
            <select
              className={selectClassName}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              {INVOICE_STATUS_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Currency" icon={<IndianRupee className="h-3.5 w-3.5" />}>
            <select className={selectClassName} value={currency} disabled>
              {CURRENCY_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="State" icon={<MapPin className="h-3.5 w-3.5" />}>
            <ReportStateFilter
              value={state}
              onChange={(nextState) => {
                setState(nextState);
                setPage(1);
              }}
            />
          </FilterField>
        </div>

        {isFetching ? (
          <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Updating report…
          </p>
        ) : null}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          title="Actual revenue"
          value={formatCurrency(summary?.actualRevenue ?? 0)}
          trend={formatTrendLabel(summary?.actualRevenueChange, 'vs previous period')}
          icon={<IndianRupee className="h-5 w-5 text-green-600" />}
          accent="bg-green-500"
        />
        <KpiCard
          title="Total Invoices"
          value={String(summary?.totalInvoices ?? 0)}
          trend={formatTrendLabel(summary?.totalInvoicesChange)}
          icon={<FileText className="h-5 w-5 text-violet-600" />}
          accent="bg-violet-500"
        />
      </div>

      <SalesTrendChart
        data={data?.trend ?? []}
        groupBy={data?.groupBy ?? 'month'}
        from={fromDate}
        to={toDate}
      />

      <Card glass={false} className="overflow-hidden border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Client Sales Analytics</h2>
            <p className="text-sm text-gray-500">Subscription sales performance by client for the selected period</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search clients…"
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch(searchInput.trim());
                setPage(1);
              }}
            >
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => exportClientsCsv(clients, platformName)}
              disabled={!clients.length}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left">
                {[
                  { key: 'sales', label: 'Client' },
                  { key: 'invoices', label: 'Total Invoices' },
                  { key: 'sales', label: 'Total Sales Value' },
                  { key: 'paid', label: 'Paid Amount' },
                  { key: 'outstanding', label: 'Outstanding' },
                  { key: 'avg', label: 'Avg Invoice' },
                  { key: 'growth', label: 'Growth %' },
                ].map((column) => (
                  <th key={column.label} className="px-4 py-3 font-medium text-gray-600">
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
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    No client sales found for these filters.
                  </td>
                </tr>
              ) : (
                clients.map((row) => {
                  const growth = row.growthPercent;
                  const growthPositive = growth != null && growth >= 0;
                  const initial = row.name.trim().charAt(0).toUpperCase() || '?';
                  return (
                    <tr key={row.clientKey} className="border-b border-gray-50 hover:bg-primary-50/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                            {initial}
                          </div>
                          <span className="font-medium text-gray-900">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.totalInvoices}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {formatCurrency(row.totalSales)}
                      </td>
                      <td className="px-4 py-3 font-medium text-green-600">
                        {formatCurrency(row.paidAmount)}
                      </td>
                      <td className="px-4 py-3 font-medium text-amber-600">
                        {formatCurrency(row.outstanding)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{formatCurrency(row.avgInvoice)}</td>
                      <td className="px-4 py-3">
                        {growth == null ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                              growthPositive
                                ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-700',
                            )}
                          >
                            {growthPositive ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            )}
                            {formatGrowthPercent(growth)}
                          </span>
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
