import type { InvoiceDiscountMode } from '@/features/builder/invoice-table';

interface TableDiscountModeSelectProps {
  value: InvoiceDiscountMode;
  onChange: (mode: InvoiceDiscountMode) => void;
  compact?: boolean;
  id?: string;
}

export function TableDiscountModeSelect({
  value,
  onChange,
  compact = false,
  id,
}: TableDiscountModeSelectProps) {
  return (
    <div className={compact ? 'flex items-center gap-2' : 'space-y-1.5'}>
      <label
        htmlFor={id}
        className={
          compact
            ? 'shrink-0 text-xs font-medium text-gray-600'
            : 'block text-sm font-medium text-gray-700'
        }
      >
        Discount type
      </label>
      <select
        id={id}
        className={
          compact
            ? 'rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
            : 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
        }
        value={value}
        onChange={(e) => onChange(e.target.value as InvoiceDiscountMode)}
      >
        <option value="amount">Amount (₹)</option>
        <option value="percent">Percentage (%)</option>
      </select>
    </div>
  );
}
