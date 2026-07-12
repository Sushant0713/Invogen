import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCompactCurrency } from '@/lib/utils';

type DistributionSegment = {
  key: string;
  name: string;
  revenue: number;
  color: string;
};

type Distribution = {
  segments: DistributionSegment[];
  total: number;
  topProductName: string;
  topProductPercent: number;
};

interface ProductRevenueDonutProps {
  title?: string;
  distribution: Distribution;
  height?: number;
}

export function ProductRevenueDonut({
  title = 'Revenue Breakdown by Product',
  distribution,
  height = 300,
}: ProductRevenueDonutProps) {
  const chartData = useMemo(
    () =>
      distribution.segments
        .filter((segment) => segment.revenue > 0)
        .map((segment) => ({
          name: segment.name,
          value: segment.revenue,
          color: segment.color,
        })),
    [distribution.segments],
  );

  const topPercent = Math.round(distribution.topProductPercent);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <div className="relative px-2 pb-5">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={chartData.length ? chartData : [{ name: 'No data', value: 1, color: '#f3f4f6' }]}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={72}
              outerRadius={108}
              paddingAngle={2}
              stroke="none"
            >
              {(chartData.length ? chartData : [{ name: 'No data', value: 1, color: '#f3f4f6' }]).map(
                (entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ),
              )}
            </Pie>
            <Tooltip
              formatter={(value: number, name) => [formatCompactCurrency(value), name]}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #f3f4f6',
                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
          <p className="text-3xl font-bold text-gray-900">{topPercent}%</p>
          <p className="max-w-[120px] truncate text-center text-sm text-gray-500">
            {distribution.topProductName}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-4 border-t border-gray-100 px-4 py-4">
        {distribution.segments.map((segment) => (
          <div key={segment.key} className="flex items-center gap-2 text-sm text-gray-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
            {segment.name}
          </div>
        ))}
      </div>
    </Card>
  );
}
