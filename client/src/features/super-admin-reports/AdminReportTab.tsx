import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  CalendarRange,
  CheckCircle2,
  FileEdit,
  FileText,
  IndianRupee,
  Loader2,
  Send,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import api from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Badge } from '@/components/ui/Badge';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { cn, formatCompactCurrency, formatCurrency } from '@/lib/utils';
import {
  buildRevenueChartData,
  fillRevenueSeriesGaps,
  formatRevenueRangeLabel,
  getPresetRange,
  getRevenueGroupLabel,
  type RevenueGroupBy,
  type RevenuePreset,
} from '@/lib/revenue-chart';
import {
  formatTrendLabel,
  INVOICE_STATUS_FILTERS,
} from '@/features/reports/report-filters';
import { SalesTrendChart } from '@/features/reports/SalesTrendChart';

const DATE_PRESETS: { id: RevenuePreset; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '3m', label: '3 months' },
  { id: '12m', label: '12 months' },
  { id: 'all', label: 'All time' },
];

const STATUS_COLORS = {
  Paid: '#16a34a',
  Sent: '#2563eb',
  Draft: '#d97706',
} as const;

function StatusMixChart({
  data,
  subtitle,
}: {
  data: Array<{ name: string; value: number }>;
  subtitle: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card glass={false} className="border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-gray-900">Invoice status mix</h3>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data.length ? data : [{ name: 'Empty', value: 1 }]}
              dataKey="value"
              nameKey="name"
              innerRadius={72}
              outerRadius={108}
              paddingAngle={3}
            >
              {(data.length ? data : [{ name: 'Empty', value: 1 }]).map((entry) => (
                <Cell
                  key={entry.name}
                  fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS] ?? '#d1d5db'}
                />
              ))}
            </Pie>
            <Tooltip formatter={(value: number, name: string) => [value, name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-gray-900">{total}</p>
          <p className="text-xs text-gray-500">invoices</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-gray-600">
        {data.map((item) => (
          <span key={item.name} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: STATUS_COLORS[item.name as keyof typeof STATUS_COLORS] ?? '#d1d5db',
              }}
            />
            {item.name}: {item.value}
          </span>
        ))}
      </div>
    </Card>
  );
}

const selectClassName =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

type AdminReportResponse = {
  from: string;
  to: string;
  groupBy: RevenueGroupBy;
  summary: {
    totalInvoices: number;
    paidCount: number;
    sentCount: number;
    draftCount: number;
    cancelledCount: number;
    paidRevenue: number;
    sentValue: number;
    draftValue: number;
    paidRevenueChange: number | null;
    paidCountChange: number | null;
    sentCountChange: number | null;
    draftCountChange: number | null;
    totalInvoicesChange: number | null;
  };
  trend: Array<{
    period: string;
    paidRevenue: number;
    paidCount: number;
    sentCount: number;
    draftCount: number;
    totalInvoices: number;
  }>;
  companies: Array<{ _id: string; name: string }>;
};

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
    <label className="block min-w-[140px] flex-1">
      <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function KpiCard({
  title,
  value,
  subValue,
  trend,
  icon,
  accent,
  badge,
}: {
  title: string;
  value: string;
  subValue?: string;
  trend?: string;
  icon: React.ReactNode;
  accent: string;
  badge?: string;
}) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className={cn('absolute inset-y-0 left-0 w-1', accent)} />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            {badge ? (
              <Badge variant="default" className="text-[10px] uppercase tracking-wide">
                {badge}
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 sm:text-3xl">{value}</p>
          {subValue ? <p className="mt-1 text-sm text-gray-600">{subValue}</p> : null}
          {trend ? (
            <p
              className={cn(
                'mt-2 text-xs font-medium',
                trend.includes('↘') ? 'text-red-600' : 'text-green-600'
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

export function AdminReportTab() {
  const initialRange = getPresetRange('30d');
  const [preset, setPreset] = useState<RevenuePreset | null>('30d');
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [groupBy, setGroupBy] = useState<RevenueGroupBy | 'auto'>('auto');
  const [companyId, setCompanyId] = useState('');
  const [status, setStatus] = useState('all');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'super-admin-reports-admin',
      fromDate,
      toDate,
      groupBy,
      companyId,
      status,
    ],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (groupBy !== 'auto') params.groupBy = groupBy;
      if (companyId) params.companyId = companyId;
      if (status !== 'all') params.status = status;
      return (await api.get('/super-admin/reports/admin', { params })).data
        .data as AdminReportResponse;
    },
  });

  const statusChartData = useMemo(() => {
    if (!data) return [];
    const { paidCount, sentCount, draftCount } = data.summary;
    return [
      { name: 'Paid', value: paidCount },
      { name: 'Sent', value: sentCount },
      { name: 'Draft', value: draftCount },
    ].filter((item) => item.value > 0);
  }, [data]);

  const revenueChartData = useMemo(() => {
    if (!data) return [];
    const filled = fillRevenueSeriesGaps(
      data.trend.map((point) => ({
        period: point.period,
        total: point.paidRevenue,
        count: point.paidCount,
      })),
      fromDate,
      toDate,
      data.groupBy
    );
    return buildRevenueChartData(filled, data.groupBy);
  }, [data, fromDate, toDate]);

  const salesTrendData = useMemo(
    () =>
      (data?.trend ?? []).map((point) => ({
        period: point.period,
        totalSales: point.paidRevenue,
        paidSales: point.paidRevenue,
        invoiceCount: point.totalInvoices,
      })),
    [data?.trend]
  );

  const handlePreset = (next: RevenuePreset) => {
    const range = getPresetRange(next);
    setPreset(next);
    setFromDate(range.from);
    setToDate(range.to);
  };

  if (isLoading && !data) return <Loader />;

  const summary = data?.summary;
  const rangeLabel = formatRevenueRangeLabel(fromDate, toDate);
  const chartSubtitle = data
    ? `${getRevenueGroupLabel(data.groupBy)} · ${rangeLabel}`
    : 'Client invoice activity';

  return (
    <div className="space-y-5">
      <Card className="border-primary/10 bg-gradient-to-r from-primary-50/50 to-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Admin invoice analytics</h2>
        <p className="mt-1 text-sm text-gray-500">
          Invoices created by your clients (admins) for their customers — counts, revenue, and trends.
        </p>
      </Card>

      <Card glass={false} className="space-y-4 border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={preset === item.id ? 'primary' : 'outline'}
              className="rounded-full"
              onClick={() => handlePreset(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-4">
          <FilterField label="From" icon={<CalendarRange className="h-3.5 w-3.5" />}>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setPreset(null);
                setFromDate(e.target.value);
              }}
            />
          </FilterField>
          <FilterField label="To" icon={<CalendarRange className="h-3.5 w-3.5" />}>
            <Input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => {
                setPreset(null);
                setToDate(e.target.value);
              }}
            />
          </FilterField>
          <FilterField label="Client" icon={<Building2 className="h-3.5 w-3.5" />}>
            <select
              className={selectClassName}
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
              }}
            >
              <option value="">All clients</option>
              {(data?.companies ?? []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="View by" icon={<CalendarRange className="h-3.5 w-3.5" />}>
            <select
              className={selectClassName}
              value={groupBy}
              onChange={(e) => {
                setGroupBy(e.target.value as RevenueGroupBy | 'auto');
              }}
            >
              <option value="auto">Auto (daily / monthly)</option>
              <option value="day">Daily</option>
              <option value="month">Monthly</option>
            </select>
          </FilterField>
          <FilterField label="Status" icon={<FileText className="h-3.5 w-3.5" />}>
            <select
              className={selectClassName}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
              }}
            >
              {INVOICE_STATUS_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </FilterField>
        </div>

        {isFetching ? (
          <p className="inline-flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Updating report…
          </p>
        ) : null}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Paid revenue"
          value={formatCurrency(summary?.paidRevenue ?? 0)}
          trend={formatTrendLabel(summary?.paidRevenueChange, 'vs previous period')}
          icon={<IndianRupee className="h-5 w-5 text-emerald-600" />}
          accent="bg-emerald-500"
        />
        <KpiCard
          title="Paid invoices"
          value={String(summary?.paidCount ?? 0)}
          trend={formatTrendLabel(summary?.paidCountChange)}
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          accent="bg-green-500"
        />
        <KpiCard
          title="Sent invoices"
          value={String(summary?.sentCount ?? 0)}
          subValue={formatCurrency(summary?.sentValue ?? 0)}
          trend={formatTrendLabel(summary?.sentCountChange)}
          icon={<Send className="h-5 w-5 text-blue-600" />}
          accent="bg-blue-500"
        />
        <KpiCard
          title="Draft invoices"
          value={String(summary?.draftCount ?? 0)}
          subValue={formatCurrency(summary?.draftValue ?? 0)}
          trend={formatTrendLabel(summary?.draftCountChange)}
          icon={<FileEdit className="h-5 w-5 text-amber-600" />}
          accent="bg-amber-500"
        />
        <KpiCard
          title="Total invoices"
          value={String(summary?.totalInvoices ?? 0)}
          trend={formatTrendLabel(summary?.totalInvoicesChange)}
          icon={<FileText className="h-5 w-5 text-violet-600" />}
          accent="bg-violet-500"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesTrendChart
            title="Paid revenue trend"
            data={salesTrendData}
            groupBy={data?.groupBy ?? 'month'}
            from={fromDate}
            to={toDate}
          />
        </div>
        <StatusMixChart data={statusChartData} subtitle={chartSubtitle} />
      </div>

      <ChartCard
        title="Paid revenue over time"
        subtitle={chartSubtitle}
        data={revenueChartData.length ? revenueChartData : [{ name: 'No revenue', value: 0 }]}
        valueFormatter={formatCurrency}
        axisValueFormatter={formatCompactCurrency}
        variant="bar"
        height={300}
      />
    </div>
  );
}
