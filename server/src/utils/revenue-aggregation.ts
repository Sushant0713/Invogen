const MS_PER_DAY = 86_400_000;

export type RevenueGroupBy = 'day' | 'month';

const GROUP_FORMAT: Record<RevenueGroupBy, string> = {
  day: '%Y-%m-%d',
  month: '%Y-%m',
};

export function buildRevenueDateMatch(query: Record<string, unknown>) {
  const match: Record<string, unknown> = { status: 'captured' };
  const createdAt: Record<string, Date> = {};

  if (query.from) {
    const from = new Date(query.from as string);
    from.setHours(0, 0, 0, 0);
    createdAt.$gte = from;
  }

  if (query.to) {
    const to = new Date(query.to as string);
    to.setHours(23, 59, 59, 999);
    createdAt.$lte = to;
  }

  if (Object.keys(createdAt).length > 0) {
    match.createdAt = createdAt;
  }

  return match;
}

export function resolveRevenueGroupBy(
  requested: unknown,
  from?: string,
  to?: string,
): RevenueGroupBy {
  if (requested === 'day' || requested === 'month') {
    return requested;
  }

  if (!from || !to) {
    return 'month';
  }

  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const days = Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  return days <= 45 ? 'day' : 'month';
}

export function getRevenueGroupFormat(groupBy: RevenueGroupBy): string {
  return GROUP_FORMAT[groupBy];
}

export type RevenueSeriesPoint = {
  period: string;
  total: number;
  count: number;
};

export function mapRevenueAggregation(
  rows: { _id: string; total: number; count: number }[],
): RevenueSeriesPoint[] {
  return rows.map((row) => ({
    period: row._id,
    total: row.total,
    count: row.count,
  }));
}
