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
  /** Client invoices with status=sent attributed to this day. */
  sentInvoiceCount: number;
  /** Client invoices with status=paid attributed to this day. */
  paidInvoiceCount: number;
};

function emptyWeekBuckets(): DailyRevenueBucket[] {
  const weekStart = startOfWeekMonday(new Date());
  const buckets: DailyRevenueBucket[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    buckets.push({
      date: toLocalDateKey(day),
      total: 0,
      count: 0,
      sentInvoiceCount: 0,
      paidInvoiceCount: 0,
    });
  }
  return buckets;
}

export function buildDailyRevenueSeriesForCurrentWeek(
  capturedPayments: { createdAt: Date; amount: number }[],
): DailyRevenueBucket[] {
  const buckets = emptyWeekBuckets();

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

type InvoiceDaySource = {
  status: string;
  createdAt?: Date | null;
  sentAt?: Date | null;
  paidAt?: Date | null;
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function invoiceDayKey(invoice: InvoiceDaySource, status: 'sent' | 'paid'): string | null {
  if (status === 'sent') {
    const at = asDate(invoice.sentAt) ?? asDate(invoice.createdAt);
    return at ? toLocalDateKey(at) : null;
  }
  const at = asDate(invoice.paidAt) ?? asDate(invoice.createdAt);
  return at ? toLocalDateKey(at) : null;
}

/** Merge client invoice counts into an existing this-week revenue series (same dates). */
export function attachWeeklyClientInvoiceCounts(
  buckets: DailyRevenueBucket[],
  invoices: InvoiceDaySource[],
): DailyRevenueBucket[] {
  const next = buckets.map((bucket) => ({ ...bucket }));
  const byDate = new Map(next.map((bucket) => [bucket.date, bucket]));

  for (const invoice of invoices) {
    if (invoice.status === 'sent') {
      const key = invoiceDayKey(invoice, 'sent');
      const bucket = key ? byDate.get(key) : undefined;
      if (bucket) bucket.sentInvoiceCount += 1;
    } else if (invoice.status === 'paid') {
      const key = invoiceDayKey(invoice, 'paid');
      const bucket = key ? byDate.get(key) : undefined;
      if (bucket) bucket.paidInvoiceCount += 1;
    }
  }

  return next;
}
