export type RevenueGroupBy = 'day' | 'month';

export type RevenueSeriesPoint = {
  period: string;
  total: number;
  count: number;
};

export type RevenuePreset = '7d' | '30d' | '3m' | '12m' | 'all';

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPresetRange(preset: RevenuePreset): { from: string; to: string } {
  if (preset === 'all') {
    return { from: '', to: '' };
  }

  const to = new Date();
  const from = new Date();

  switch (preset) {
    case '7d':
      from.setDate(from.getDate() - 6);
      break;
    case '30d':
      from.setDate(from.getDate() - 29);
      break;
    case '3m':
      from.setMonth(from.getMonth() - 3);
      break;
    case '12m':
    default:
      from.setFullYear(from.getFullYear() - 1);
      break;
  }

  return {
    from: toDateInputValue(from),
    to: toDateInputValue(to),
  };
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dayKey(date: Date): string {
  return toDateInputValue(date);
}

export function fillRevenueSeriesGaps(
  series: RevenueSeriesPoint[],
  from: string,
  to: string,
  groupBy: RevenueGroupBy,
): RevenueSeriesPoint[] {
  if (!from || !to) {
    return series;
  }

  const totals = new Map(series.map((point) => [point.period, point]));
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const filled: RevenueSeriesPoint[] = [];

  if (groupBy === 'month') {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cursor <= endMonth) {
      const period = monthKey(cursor);
      const existing = totals.get(period);
      filled.push(existing ?? { period, total: 0, count: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return filled;
  }

  const cursor = new Date(start);
  while (cursor <= end) {
    const period = dayKey(cursor);
    const existing = totals.get(period);
    filled.push(existing ?? { period, total: 0, count: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return filled;
}

export function formatRevenuePeriodLabel(period: string, groupBy: RevenueGroupBy): string {
  if (groupBy === 'month') {
    const [year, month] = period.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  }

  const date = new Date(`${period}T12:00:00`);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatRevenuePeriodTooltip(period: string, groupBy: RevenueGroupBy): string {
  if (groupBy === 'month') {
    const [year, month] = period.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  const date = new Date(`${period}T12:00:00`);
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatRevenueRangeLabel(from: string, to: string): string {
  if (!from && !to) return 'All time';
  if (from && to) return `${formatInputDate(from)} – ${formatInputDate(to)}`;
  if (from) return `From ${formatInputDate(from)}`;
  return `Until ${formatInputDate(to)}`;
}

function formatInputDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function buildRevenueChartData(
  series: RevenueSeriesPoint[],
  groupBy: RevenueGroupBy,
) {
  return series.map((point) => ({
    name: formatRevenuePeriodLabel(point.period, groupBy),
    value: point.total,
    label: formatRevenuePeriodTooltip(point.period, groupBy),
    count: point.count,
  }));
}

export function getRevenueGroupLabel(groupBy: RevenueGroupBy): string {
  return groupBy === 'day' ? 'Daily' : 'Monthly';
}
