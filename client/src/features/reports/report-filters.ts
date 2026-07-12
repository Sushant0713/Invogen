import { toDateInputValue } from '@/lib/revenue-chart';

export type ReportDatePreset =
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_year'
  | 'last_6_months';

export const REPORT_DATE_PRESETS: { id: ReportDatePreset; label: string }[] = [
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'this_quarter', label: 'This Quarter' },
  { id: 'this_year', label: 'This Year' },
  { id: 'last_6_months', label: 'Last 6 Months' },
];

export function getReportPresetRange(preset: ReportDatePreset): { from: string; to: string } {
  const now = new Date();
  const to = toDateInputValue(now);
  const from = new Date(now);

  switch (preset) {
    case 'last_month': {
      from.setDate(1);
      from.setMonth(from.getMonth() - 1);
      const end = new Date(from.getFullYear(), from.getMonth() + 1, 0);
      return { from: toDateInputValue(from), to: toDateInputValue(end) };
    }
    case 'this_quarter': {
      const quarterMonth = Math.floor(from.getMonth() / 3) * 3;
      from.setMonth(quarterMonth, 1);
      return { from: toDateInputValue(from), to };
    }
    case 'this_year': {
      from.setMonth(0, 1);
      return { from: toDateInputValue(from), to };
    }
    case 'last_6_months': {
      from.setMonth(from.getMonth() - 5, 1);
      return { from: toDateInputValue(from), to };
    }
    case 'this_month':
    default: {
      from.setDate(1);
      return { from: toDateInputValue(from), to };
    }
  }
}

export const INVOICE_STATUS_FILTERS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
] as const;

export const CURRENCY_FILTERS = [{ value: 'INR', label: 'INR (₹)' }] as const;

export function formatGrowthPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function formatTrendLabel(value: number | null | undefined, suffix = 'vs last period') {
  if (value == null || Number.isNaN(value)) return undefined;
  const arrow = value >= 0 ? '↗' : '↘';
  const sign = value > 0 ? '+' : '';
  return `${arrow} ${sign}${value.toFixed(1)}% ${suffix}`;
}
