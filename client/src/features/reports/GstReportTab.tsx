import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheck,
  Building2,
  CircleDollarSign,
  Clock3,
  Download,
  FileText,
  Loader2,
  Search,
  TrendingUp,
} from 'lucide-react';
import api from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { toDateInputValue } from '@/lib/revenue-chart';
import { GstTrendChart } from '@/features/reports/GstTrendChart';
import { formatTrendLabel } from '@/features/reports/report-filters';
import { useReportCompany } from '@/features/reports/use-report-company';
import {
  ReportDateRangeFilters,
  useReportDateRangeState,
} from '@/features/reports/ReportDateRangeFilters';

type GstReportResponse = {
  companyName: string;
  from: string;
  to: string;
  groupBy: 'day' | 'month';
  summary: {
    totalGst: number;
    totalGstChange: number | null;
    totalInvoices: number;
    totalInvoicesChange: number | null;
    taxableValue: number;
    taxableValueChange: number | null;
    cgst: number;
    sgst: number;
    igst: number;
  };
  trend: Array<{ period: string; totalGst: number }>;
  register: Array<{
    invoiceId: string;
    invoiceNumber: string;
    customerName: string;
    issueDate: string;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
    totalAmount: number;
  }>;
  registerMeta: {
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
  subtitle?: string;
  icon: React.ReactNode;
  accent: string;
};

function KpiCard({ title, value, trend, subtitle, icon, accent }: KpiCardProps) {
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
          {subtitle ? <p className="mt-1 text-xs text-gray-400">{subtitle}</p> : null}
        </div>
        <div className="rounded-xl bg-gray-50 p-2.5 text-gray-700">{icon}</div>
      </div>
    </Card>
  );
}

const selectClassName =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

function exportGstCsv(rows: GstReportResponse['register'], companyName: string) {
  const headers = [
    'Date',
    'Invoice No.',
    'Customer',
    'Taxable Value',
    'CGST',
    'SGST',
    'IGST',
    'Total GST',
    'Total Amount',
  ];
  const lines = rows.map((row) => [
    formatDate(row.issueDate),
    row.invoiceNumber,
    row.customerName,
    row.taxable,
    row.cgst,
    row.sgst,
    row.igst,
    row.totalGst,
    row.totalAmount,
  ]);
  const csv = [headers, ...lines]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${companyName.replace(/\s+/g, '-').toLowerCase()}-gst-register.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function GstReportTab() {
  const { datePreset, fromDate, toDate, applyPreset, changeFrom, changeTo } =
    useReportDateRangeState('this_month');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  const { data: company } = useReportCompany();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-reports-gst', datePreset, fromDate, toDate, search, page],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        from: fromDate,
        to: toDate,
        status: 'paid',
        search,
        page,
        limit: 10,
      };
      if (datePreset !== 'custom') params.preset = datePreset;
      return (await api.get('/admin/reports/gst', { params })).data.data as GstReportResponse;
    },
    enabled: Boolean(fromDate && toDate),
  });

  const chartFrom = data?.from ? toDateInputValue(new Date(data.from)) : fromDate;
  const chartTo = data?.to ? toDateInputValue(new Date(data.to)) : toDate;

  if (isLoading && !data) return <Loader />;

  const summary = data?.summary;
  const register = data?.register ?? [];
  const meta = data?.registerMeta;
  const companyId = company?._id ?? 'company';
  const companyName = company?.name ?? data?.companyName ?? 'Your company';

  return (
    <div className="space-y-5">
      <Card glass={false} className="border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-4">
          <ReportDateRangeFilters
            datePreset={datePreset}
            fromDate={fromDate}
            toDate={toDate}
            onPresetChange={(preset) => {
              applyPreset(preset);
              setPage(1);
            }}
            onFromChange={(next) => {
              changeFrom(next);
              setPage(1);
            }}
            onToChange={(next) => {
              changeTo(next);
              setPage(1);
            }}
          />

          <label className="block min-w-[180px] flex-1">
            <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              <Building2 className="h-3.5 w-3.5" />
              Company
            </span>
            <select className={selectClassName} value={companyId}>
              <option value={companyId}>{companyName}</option>
            </select>
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
        <KpiCard
          title="Total GST Collected"
          value={formatCurrency(summary?.totalGst ?? 0)}
          trend={formatTrendLabel(summary?.totalGstChange)}
          subtitle="From paid invoices only"
          icon={<CircleDollarSign className="h-5 w-5 text-primary" />}
          accent="bg-primary"
        />
        <KpiCard
          title="Paid Invoices"
          value={String(summary?.totalInvoices ?? 0)}
          trend={formatTrendLabel(summary?.totalInvoicesChange)}
          subtitle="Actual revenue basis"
          icon={<FileText className="h-5 w-5 text-violet-600" />}
          accent="bg-violet-500"
        />
        <KpiCard
          title="Total Taxable Value"
          value={formatCurrency(summary?.taxableValue ?? 0)}
          trend={formatTrendLabel(summary?.taxableValueChange)}
          subtitle="From collected revenue"
          icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
          accent="bg-blue-500"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          title="CGST Collected"
          value={formatCurrency(summary?.cgst ?? 0)}
          subtitle="Central Tax"
          icon={<BadgeCheck className="h-5 w-5 text-teal-600" />}
          accent="bg-teal-500"
        />
        <KpiCard
          title="SGST Collected"
          value={formatCurrency(summary?.sgst ?? 0)}
          subtitle="State Tax"
          icon={<BadgeCheck className="h-5 w-5 text-green-600" />}
          accent="bg-green-500"
        />
        <KpiCard
          title="IGST Collected"
          value={formatCurrency(summary?.igst ?? 0)}
          subtitle="Integrated Tax"
          icon={<Clock3 className="h-5 w-5 text-amber-600" />}
          accent="bg-amber-400"
        />
      </div>

      <GstTrendChart
        data={data?.trend ?? []}
        groupBy={data?.groupBy ?? 'month'}
        from={chartFrom}
        to={chartTo}
      />

      <Card glass={false} className="overflow-hidden border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">GST Invoice Register</h2>
            <p className="text-sm text-gray-500">
              GST breakdown for paid invoices only (actual revenue collected)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search invoices…"
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
              onClick={() => exportGstCsv(register, companyName)}
              disabled={!register.length}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left">
                {[
                  'Date',
                  'Invoice No.',
                  'Customer',
                  'Taxable Value',
                  'CGST',
                  'SGST',
                  'IGST',
                  'Total GST',
                  'Total Amount',
                ].map((label) => (
                  <th key={label} className="px-4 py-3 font-medium text-gray-600">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {register.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                    No GST invoices found for these filters.
                  </td>
                </tr>
              ) : (
                register.map((row) => {
                  const initial = row.customerName.trim().charAt(0).toUpperCase() || '?';
                  return (
                    <tr key={row.invoiceId} className="border-b border-gray-50 hover:bg-primary-50/20">
                      <td className="px-4 py-3 text-gray-700">{formatDate(row.issueDate)}</td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/invoices/${row.invoiceId}/view`}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-xs font-semibold text-gray-600">
                            {initial}
                          </div>
                          <span className="font-medium text-gray-900">{row.customerName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{formatCurrency(row.taxable)}</td>
                      <td className="px-4 py-3 font-medium text-green-600">
                        {row.cgst > 0 ? formatCurrency(row.cgst) : '₹0'}
                      </td>
                      <td className="px-4 py-3 font-medium text-green-600">
                        {row.sgst > 0 ? formatCurrency(row.sgst) : '₹0'}
                      </td>
                      <td className="px-4 py-3 font-medium text-primary">
                        {row.igst > 0 ? formatCurrency(row.igst) : '₹0'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {formatCurrency(row.totalGst)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-primary">
                        {formatCurrency(row.totalAmount)}
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
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} invoices
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
