import { cn } from '@/lib/utils';
import type { SalesDateBasisPreference } from '@/lib/sales-date-basis';

const DATE_BASIS_OPTIONS = [
  { value: 'invoice' as const, label: 'Invoice date' },
  { value: 'status' as const, label: 'Status date' },
];

export type ReportDateBasis = SalesDateBasisPreference;

interface ReportDateBasisToggleProps {
  value: ReportDateBasis;
  onChange: (basis: ReportDateBasis) => void;
  className?: string;
  /** Compact control for page headers (e.g. All Invoices). */
  compact?: boolean;
}

/**
 * Invoice date = issue date on the invoice.
 * Status date = real time when Sent or Paid was clicked on All Invoices (sentAt / paidAt).
 */
export function ReportDateBasisToggle({
  value,
  onChange,
  className,
  compact,
}: ReportDateBasisToggleProps) {
  return (
    <div
      className={cn(
        'inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1',
        compact ? '' : 'w-full',
        className,
      )}
      role="group"
      aria-label="Revenue graph date basis"
    >
      {DATE_BASIS_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          data-active={value === option.value}
          onClick={() => onChange(option.value)}
          title={
            option.value === 'invoice'
              ? 'Reports use invoice date'
              : 'Reports use the time Sent or Paid was clicked'
          }
          className={cn(
            'rounded-lg font-medium transition-colors',
            'text-gray-500 hover:text-gray-800',
            'data-[active=true]:bg-primary data-[active=true]:text-white',
            compact ? 'px-3 py-1.5 text-xs whitespace-nowrap' : 'min-w-0 flex-1 px-2.5 py-2 text-xs',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
