import { useId, useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCompactCurrency } from '@/lib/utils';
import { getChartYAxisScale } from '@/lib/chart-scale';
import {
  fillRevenueSeriesGaps,
  formatRevenuePeriodLabel,
  formatRevenuePeriodTooltip,
  type RevenueGroupBy,
} from '@/lib/revenue-chart';

export type SalesTrendPoint = {
  period: string;
  actualRevenue: number;
  expectedRevenue: number;
  /** @deprecated Prefer actualRevenue */
  totalSales?: number;
  /** @deprecated Prefer actualRevenue */
  paidSales?: number;
  invoiceCount?: number;
};

interface SalesTrendChartProps {
  title?: string;
  data: SalesTrendPoint[];
  groupBy: RevenueGroupBy;
  from: string;
  to: string;
  height?: number;
}

function resolveActual(point: SalesTrendPoint): number {
  return point.actualRevenue ?? point.paidSales ?? 0;
}

function resolveExpected(point: SalesTrendPoint): number {
  if (point.expectedRevenue != null) return point.expectedRevenue;
  // Legacy payloads used totalSales = all + paidSales = paid
  if (point.totalSales != null) {
    return Math.max(0, point.totalSales - (point.paidSales ?? 0));
  }
  return 0;
}

export function SalesTrendChart({
  title = 'Sales Value Trend',
  data,
  groupBy,
  from,
  to,
  height = 320,
}: SalesTrendChartProps) {
  const actualGradientId = useId().replace(/:/g, '');

  const chartData = useMemo(() => {
    const filledActual = fillRevenueSeriesGaps(
      data.map((point) => ({
        period: point.period,
        total: resolveActual(point),
        count: point.invoiceCount ?? 0,
      })),
      from,
      to,
      groupBy,
    );

    const filledExpected = fillRevenueSeriesGaps(
      data.map((point) => ({
        period: point.period,
        total: resolveExpected(point),
        count: point.invoiceCount ?? 0,
      })),
      from,
      to,
      groupBy,
    );
    const expectedMap = new Map(filledExpected.map((point) => [point.period, point.total]));

    return filledActual.map((point) => ({
      name: formatRevenuePeriodLabel(point.period, groupBy),
      label: formatRevenuePeriodTooltip(point.period, groupBy),
      actualRevenue: point.total,
      expectedRevenue: expectedMap.get(point.period) ?? 0,
      invoiceCount: point.count,
    }));
  }, [data, from, to, groupBy]);

  const yScale = useMemo(
    () =>
      getChartYAxisScale(
        chartData.flatMap((point) => [point.actualRevenue, point.expectedRevenue]),
      ),
    [chartData],
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <div className="px-2 pb-5">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 12, right: 20, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id={actualGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              minTickGap={18}
            />
            <YAxis
              domain={[0, yScale.max]}
              ticks={yScale.ticks}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(value: number) => formatCompactCurrency(value)}
              width={72}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value: number, name) => [
                formatCompactCurrency(value),
                name === 'actualRevenue' ? 'Actual Revenue (₹)' : 'Expected Revenue (₹)',
              ]}
              labelFormatter={(_label, payload) => {
                const point = payload?.[0]?.payload as { label?: string; name?: string } | undefined;
                return point?.label ?? point?.name ?? _label;
              }}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #f3f4f6',
                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={28}
              iconType="circle"
              formatter={(value) =>
                value === 'actualRevenue' ? 'Actual Revenue (₹)' : 'Expected Revenue (₹)'
              }
            />
            <Line
              type="monotone"
              dataKey="actualRevenue"
              stroke="#22c55e"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="expectedRevenue"
              stroke="#FF7700"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={{ r: 3, fill: '#FF7700', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
