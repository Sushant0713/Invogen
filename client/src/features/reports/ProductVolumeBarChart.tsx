import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { getChartYAxisScale } from '@/lib/chart-scale';

export type ProductVolumePoint = {
  name: string;
  unitsSold: number;
};

interface ProductVolumeBarChartProps {
  title?: string;
  data: ProductVolumePoint[];
  height?: number;
}

export function ProductVolumeBarChart({
  title = 'Top Selling Products by Volume',
  data,
  height = 280,
}: ProductVolumeBarChartProps) {
  const chartData = useMemo(
    () =>
      [...data]
        .sort((a, b) => a.unitsSold - b.unitsSold)
        .map((item) => ({
          name: item.name.length > 22 ? `${item.name.slice(0, 20)}…` : item.name,
          fullName: item.name,
          unitsSold: item.unitsSold,
        })),
    [data],
  );

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
          <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 20, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, yScale.max]}
              ticks={yScale.ticks}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 11, fill: '#374151' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value: number) => [value, 'Units Sold']}
              labelFormatter={(_label, payload) => {
                const point = payload?.[0]?.payload as { fullName?: string; name?: string } | undefined;
                return point?.fullName ?? point?.name ?? _label;
              }}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #f3f4f6',
                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
              }}
            />
            <Bar dataKey="unitsSold" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
