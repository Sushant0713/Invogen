import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarRange,
  CircleDollarSign,
  Download,
  Hexagon,
  Loader2,
  Search,
  Star,
  TrendingUp,
} from 'lucide-react';
import api from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { cn, formatCurrency } from '@/lib/utils';
import { toDateInputValue } from '@/lib/revenue-chart';
import { ProductSalesTrendChart } from '@/features/reports/ProductSalesTrendChart';
import { ProductRevenueDonut } from '@/features/reports/ProductRevenueDonut';
import { ProductVolumeBarChart } from '@/features/reports/ProductVolumeBarChart';
import {
  formatGrowthPercent,
  formatTrendLabel,
  getReportPresetRange,
  REPORT_DATE_PRESETS,
  type ReportDatePreset,
} from '@/features/reports/report-filters';

type ProductsReportResponse = {
  from: string;
  to: string;
  groupBy: 'day' | 'month';
  summary: {
    totalRevenue: number;
    totalRevenueChange: number | null;
    totalUnitsSold: number;
    totalUnitsSoldChange: number | null;
    mostPopularPlan: string;
    mostPopularUnits: number;
    highestGrossingPlan: string;
    highestGrossingRevenue: number;
    avgRevenuePerProduct: number;
  };
  trend: Array<{ period: string; unitsSold: number }>;
  distribution: {
    segments: Array<{ key: string; name: string; revenue: number; color: string }>;
    total: number;
    topProductName: string;
    topProductPercent: number;
  };
  volume: Array<{ name: string; unitsSold: number }>;
  ledger: Array<{
    productKey: string;
    productId: string | null;
    name: string;
    category?: string;
    unitsSold: number;
    totalRevenue: number;
    sharePercent: number;
    growthPercent: number | null;
  }>;
  ledgerMeta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const PLAN_COLORS = ['text-orange-600', 'text-violet-600', 'text-blue-600', 'text-gray-900'];

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
          <p className="mt-2 text-xl font-bold text-gray-900 sm:text-2xl">{value}</p>
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

function exportLedgerCsv(rows: ProductsReportResponse['ledger'], from: string, to: string) {
  const headers = ['Product', 'Units Sold', 'Total Revenue', '% of Total Sales', 'Growth %'];
  const lines = rows.map((row) => [
    row.name,
    row.unitsSold,
    row.totalRevenue,
    `${row.sharePercent.toFixed(1)}%`,
    formatGrowthPercent(row.growthPercent),
  ]);
  const csv = [headers, ...lines]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `product-plan-ledger-${from}-to-${to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const SORT_COLUMNS = [
  { key: 'name', label: 'Product / Plan' },
  { key: 'units', label: 'Units Sold' },
  { key: 'revenue', label: 'Total Revenue' },
  { key: 'share', label: '% of Total Sales' },
  { key: 'growth', label: 'Growth' },
] as const;

export function ProductsReportTab() {
  const [datePreset, setDatePreset] = useState<ReportDatePreset>('this_quarter');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('revenue');

  const range = useMemo(() => getReportPresetRange(datePreset), [datePreset]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-reports-products', datePreset, range.from, range.to, search, page, sort],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        preset: datePreset,
        from: range.from,
        to: range.to,
        status: 'paid',
        search,
        page,
        limit: 8,
        sort,
      };
      return (await api.get('/admin/reports/products', { params })).data.data as ProductsReportResponse;
    },
  });

  const fromDate = data?.from ? toDateInputValue(new Date(data.from)) : range.from;
  const toDate = data?.to ? toDateInputValue(new Date(data.to)) : range.to;

  if (isLoading && !data) return <Loader />;

  const summary = data?.summary;
  const ledger = data?.ledger ?? [];
  const meta = data?.ledgerMeta;

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
              Search Product
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search product or plan name..."
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Total Revenue from Products"
          value={formatCurrency(summary?.totalRevenue ?? 0)}
          trend={formatTrendLabel(summary?.totalRevenueChange, 'vs last period')}
          trendPositive={summary?.totalRevenueChange == null || summary.totalRevenueChange >= 0}
          subtitle="From paid invoices only"
          icon={<CircleDollarSign className="h-5 w-5 text-green-600" />}
          accent="bg-green-500"
        />
        <KpiCard
          title="Total Products Sold"
          value={`${summary?.totalUnitsSold ?? 0} units`}
          trend={formatTrendLabel(summary?.totalUnitsSoldChange, 'vs last period')}
          trendPositive={summary?.totalUnitsSoldChange == null || summary.totalUnitsSoldChange >= 0}
          subtitle="Paid orders only"
          icon={<Hexagon className="h-5 w-5 text-blue-600" />}
          accent="bg-blue-500"
        />
        <KpiCard
          title="Most Popular Product"
          value={summary?.mostPopularPlan ?? '—'}
          subtitle={`${summary?.mostPopularUnits ?? 0} units sold (paid)`}
          icon={<Star className="h-5 w-5 text-violet-600" />}
          accent="bg-violet-500"
        />
        <KpiCard
          title="Highest Grossing Product"
          value={summary?.highestGrossingPlan ?? '—'}
          subtitle={`${formatCurrency(summary?.highestGrossingRevenue ?? 0)} collected`}
          icon={<Star className="h-5 w-5 text-primary" />}
          accent="bg-primary"
        />
        <KpiCard
          title="Average Revenue/Product"
          value={formatCurrency(summary?.avgRevenuePerProduct ?? 0)}
          subtitle="Based on paid revenue"
          icon={<TrendingUp className="h-5 w-5 text-amber-500" />}
          accent="bg-amber-400"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProductSalesTrendChart
          data={data?.trend ?? []}
          groupBy={data?.groupBy ?? 'month'}
          from={fromDate}
          to={toDate}
        />
        <ProductRevenueDonut
          distribution={
            data?.distribution ?? {
              segments: [],
              total: 0,
              topProductName: '—',
              topProductPercent: 0,
            }
          }
        />
      </div>

      <ProductVolumeBarChart data={data?.volume ?? []} />

      <Card glass={false} className="overflow-hidden border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Product / Plan Ledger</h2>
            <p className="text-sm text-gray-500">
              Units and revenue from paid invoices only (actual revenue collected)
            </p>
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
          <table className="w-full min-w-[980px] text-sm">
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
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    No product sales found for these filters.
                  </td>
                </tr>
              ) : (
                ledger.map((row, index) => {
                  const growth = row.growthPercent;
                  const growthPositive = growth != null && growth >= 0;
                  return (
                    <tr key={row.productKey} className="border-b border-gray-50 hover:bg-primary-50/20">
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'font-semibold',
                            PLAN_COLORS[index % PLAN_COLORS.length],
                          )}
                        >
                          {row.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.unitsSold}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {formatCurrency(row.totalRevenue)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.sharePercent.toFixed(1)}%</td>
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
                      <td className="px-4 py-3">
                        <Link
                          to="/admin/products"
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          View
                          <ArrowRight className="h-4 w-4" />
                        </Link>
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
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} products
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
