import { useId, useMemo, type ReactNode } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { getChartYAxisScale } from '@/lib/chart-scale';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export interface ChartDataPoint {
  name: string;
  value: number;
  label?: string;
  count?: number;
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  data: ChartDataPoint[];
  valueFormatter?: (value: number) => string;
  axisValueFormatter?: (value: number) => string;
  valueLabel?: string;
  /** Noun used with optional point.count in the tooltip (default: payment). */
  countNoun?: string;
  /** Optional control rendered opposite the title (e.g. a filter toggle). */
  headerActions?: ReactNode;
  height?: number;
  variant?: 'area' | 'bar';
}

export function ChartCard({
  title,
  subtitle,
  data,
  valueFormatter,
  axisValueFormatter,
  valueLabel = 'Revenue',
  countNoun = 'payment',
  headerActions,
  height = 250,
  variant = 'area',
}: ChartCardProps) {
  const gradientId = `chart-gradient-${useId().replace(/:/g, '')}`;

  const formatValue = valueFormatter ?? ((value: number) => String(value));
  const formatAxisValue = axisValueFormatter ?? formatValue;

  const yScale = useMemo(
    () => getChartYAxisScale(data.map((point) => point.value)),
    [data],
  );

  const tooltip = (
    <Tooltip
      formatter={(value: number, _name, item) => {
        const point = item?.payload as ChartDataPoint | undefined;
        const amount = formatValue(value);
        if (typeof point?.count === 'number') {
          const noun =
            point.count === 1 ? countNoun : countNoun.endsWith('s') ? countNoun : `${countNoun}s`;
          return [`${amount} · ${point.count} ${noun}`, valueLabel];
        }
        return [amount, valueLabel];
      }}
      labelFormatter={(_label, payload) => {
        const point = payload?.[0]?.payload as ChartDataPoint | undefined;
        return point?.label ?? point?.name ?? _label;
      }}
      contentStyle={{
        borderRadius: '12px',
        border: '1px solid #f3f4f6',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
      }}
    />
  );

  const xAxis = (
    <XAxis
      dataKey="name"
      tick={{ fontSize: 11, fill: '#6b7280' }}
      interval={data.length > 12 ? 'preserveStartEnd' : 0}
      minTickGap={16}
      tickLine={false}
      axisLine={{ stroke: '#e5e7eb' }}
    />
  );

  const yAxis = (
    <YAxis
      domain={[0, yScale.max]}
      ticks={yScale.ticks}
      tick={{ fontSize: 11, fill: '#6b7280' }}
      tickFormatter={(value: number) => formatAxisValue(value)}
      width={72}
      tickLine={false}
      axisLine={false}
    />
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            {subtitle ? <p className="text-sm text-muted-foreground mt-1">{subtitle}</p> : null}
          </div>
          {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
        </div>
      </CardHeader>
      <div className="px-2 pb-4">
        <ResponsiveContainer width="100%" height={height}>
          {variant === 'bar' ? (
            <BarChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 4 }} barCategoryGap="18%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              {xAxis}
              {yAxis}
              {tooltip}
              <Bar dataKey="value" fill="#FF7700" radius={[8, 8, 0, 0]} maxBarSize={56} />
            </BarChart>
          ) : (
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF7700" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FF7700" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              {xAxis}
              {yAxis}
              {tooltip}
              <Area
                type="monotone"
                dataKey="value"
                stroke="#FF7700"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${gradientId})`}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
