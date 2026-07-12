import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCompactCurrency } from '@/lib/utils';

type Distribution = {
  top5: number;
  next10: number;
  others: number;
  total: number;
  top5Percent: number;
};

interface CustomerRevenueDonutProps {
  title?: string;
  distribution: Distribution;
  height?: number;
}

const SEGMENTS = [
  { key: 'top5', label: 'Top 5 Customers', color: '#8b5cf6' },
  { key: 'next10', label: 'Next 10 Customers', color: '#3b82f6' },
  { key: 'others', label: 'All Others', color: '#e5e7eb' },
] as const;

export function CustomerRevenueDonut({
  title = 'Revenue Distribution by Customer',
  distribution,
  height = 300,
}: CustomerRevenueDonutProps) {
  const chartData = useMemo(
    () =>
      SEGMENTS.map((segment) => ({
        name: segment.label,
        value: distribution[segment.key],
        color: segment.color,
      })).filter((item) => item.value > 0),
    [distribution],
  );

  const top5Percent = Math.round(distribution.top5Percent);

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
          <p className="text-3xl font-bold text-gray-900">{top5Percent}%</p>
          <p className="text-sm text-gray-500">From Top 5</p>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-4 border-t border-gray-100 px-4 py-4">
        {SEGMENTS.map((segment) => (
          <div key={segment.key} className="flex items-center gap-2 text-sm text-gray-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
            {segment.label}
          </div>
        ))}
      </div>
    </Card>
  );
}
