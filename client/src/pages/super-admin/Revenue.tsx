import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarRange, CreditCard, DollarSign, Loader2, TrendingUp } from 'lucide-react';
import api from '@/api/client';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { formatCompactCurrency, formatCurrency } from '@/lib/utils';
import {
  buildRevenueChartData,
  fillRevenueSeriesGaps,
  formatRevenueRangeLabel,
  getPresetRange,
  getRevenueGroupLabel,
  type RevenueGroupBy,
  type RevenuePreset,
  type RevenueSeriesPoint,
} from '@/lib/revenue-chart';

const PRESETS: { id: RevenuePreset; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '3m', label: '3 months' },
  { id: '12m', label: '12 months' },
  { id: 'all', label: 'All time' },
];

type RevenueResponse = {
  series: RevenueSeriesPoint[];
  groupBy: RevenueGroupBy;
  total: number;
  paymentCount: number;
  from: string | null;
  to: string | null;
};

export default function SuperAdminRevenue() {
  const initialRange = getPresetRange('12m');
  const [preset, setPreset] = useState<RevenuePreset | null>('12m');
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [groupBy, setGroupBy] = useState<RevenueGroupBy | 'auto'>('auto');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['super-admin-revenue', fromDate, toDate, groupBy],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (groupBy !== 'auto') params.groupBy = groupBy;
      return (await api.get('/super-admin/revenue', { params })).data.data as RevenueResponse;
    },
  });

  const chartData = useMemo(() => {
    if (!data) return [];

    const filled = fillRevenueSeriesGaps(
      data.series,
      fromDate,
      toDate,
      data.groupBy,
    );

    return buildRevenueChartData(filled, data.groupBy);
  }, [fromDate, toDate, data]);

  const averagePayment = data && data.paymentCount > 0
    ? data.total / data.paymentCount
    : 0;

  const handlePreset = (nextPreset: RevenuePreset) => {
    const range = getPresetRange(nextPreset);
    setPreset(nextPreset);
    setFromDate(range.from);
    setToDate(range.to);
  };

  const rangeLabel = formatRevenueRangeLabel(fromDate, toDate);
  const subtitle = data
    ? `${getRevenueGroupLabel(data.groupBy)} view · ${rangeLabel} · oldest to newest`
    : 'Revenue overview';

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Overview for</p>
          <p className="text-lg font-semibold text-gray-900">{rangeLabel}</p>
        </div>
        {isFetching ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-medium text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Updating chart
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Revenue in range"
          value={formatCurrency(data?.total || 0)}
          icon={DollarSign}
        />
        <StatCard
          title="Payments"
          value={data?.paymentCount || 0}
          icon={CreditCard}
        />
        <StatCard
          title="Average payment"
          value={formatCurrency(averagePayment)}
          icon={TrendingUp}
        />
      </div>

      <Card glass={false} className="border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-gray-900">Choose date range</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((item) => (
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
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-3xl lg:grid-cols-3">
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
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">View by</label>
              <select
                value={groupBy}
                onChange={(event) => setGroupBy(event.target.value as RevenueGroupBy | 'auto')}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="auto">Auto</option>
                <option value="day">Daily</option>
                <option value="month">Monthly</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      <ChartCard
        title="Revenue trend"
        subtitle={subtitle}
        data={chartData.length ? chartData : [{ name: 'No data', value: 0 }]}
        valueFormatter={formatCurrency}
        axisValueFormatter={formatCompactCurrency}
        variant="bar"
        height={420}
      />
    </div>
  );
}
