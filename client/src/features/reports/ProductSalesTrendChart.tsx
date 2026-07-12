import { useId, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { getChartYAxisScale } from '@/lib/chart-scale';
import {
  fillRevenueSeriesGaps,
  formatRevenuePeriodLabel,
  formatRevenuePeriodTooltip,
  type RevenueGroupBy,
} from '@/lib/revenue-chart';

export type ProductSalesTrendPoint = {
  period: string;
  unitsSold: number;
};

interface ProductSalesTrendChartProps {
  title?: string;
  data: ProductSalesTrendPoint[];
  groupBy: RevenueGroupBy;
  from: string;
  to: string;
  height?: number;
}

export function ProductSalesTrendChart({
  title = 'Product Sales Growth Trend',
  data,
  groupBy,
  from,
  to,
  height = 300,
}: ProductSalesTrendChartProps) {
  const gradientId = useId().replace(/:/g, '');

  const chartData = useMemo(() => {
    const filled = fillRevenueSeriesGaps(
      data.map((point) => ({ period: point.period, total: point.unitsSold, count: 0 })),
      from,
      to,
      groupBy,
    );

    return filled.map((point) => ({
      name: formatRevenuePeriodLabel(point.period, groupBy),
      label: formatRevenuePeriodTooltip(point.period, groupBy),
      unitsSold: point.total,
    }));
  }, [data, from, to, groupBy]);

  const yScale = useMemo(
    () => getChartYAxisScale(chartData.map((point) => point.unitsSold)),
    [chartData],
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <div className="px-2 pb-5">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 12, right: 20, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
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
              width={48}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value: number) => [value, 'Total Units Sold']}
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
              formatter={() => 'Total Units Sold'}
            />
            <Area
              type="monotone"
              dataKey="unitsSold"
              stroke="#8b5cf6"
              strokeWidth={2.5}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
