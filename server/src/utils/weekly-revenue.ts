const MS_PER_DAY = 86_400_000;

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentWeekStart(): Date {
  return startOfWeekMonday(new Date());
}

export type DailyRevenueBucket = {
  date: string;
  total: number;
  count: number;
};

export function buildDailyRevenueSeriesForCurrentWeek(
  capturedPayments: { createdAt: Date; amount: number }[],
): DailyRevenueBucket[] {
  const weekStart = startOfWeekMonday(new Date());
  const buckets: DailyRevenueBucket[] = [];

  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    buckets.push({
      date: toLocalDateKey(day),
      total: 0,
      count: 0,
    });
  }

  for (const payment of capturedPayments) {
    const dayKey = toLocalDateKey(new Date(payment.createdAt));
    const bucket = buckets.find((entry) => entry.date === dayKey);
    if (bucket) {
      bucket.total += payment.amount;
      bucket.count += 1;
    }
  }

  return buckets;
}
