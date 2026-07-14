import { cn } from '@/lib/utils';

const DATE_BASIS_OPTIONS = [
  { value: 'invoice', label: 'Invoice date' },
  { value: 'status', label: 'Status date' },
] as const;

export type ReportDateBasis = (typeof DATE_BASIS_OPTIONS)[number]['value'];

interface ReportDateBasisToggleProps {
  value: ReportDateBasis;
  onChange: (basis: ReportDateBasis) => void;
}

/**
 * Invoice date = issue date on the invoice.
 * Status date = real time when Sent/Paid was clicked on All Invoices (sentAt / paidAt).
 */
export function ReportDateBasisToggle({ value, onChange }: ReportDateBasisToggleProps) {
  return (
    <div
      className="inline-flex w-full rounded-xl border border-gray-200 bg-gray-50 p-1"
      role="group"
      aria-label="Graph date basis"
    >
      {DATE_BASIS_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          data-active={value === option.value}
          onClick={() => onChange(option.value)}
          title={
            option.value === 'invoice'
              ? 'Use invoice date on the document'
              : 'Use the real time when Sent or Paid was clicked'
          }
          className={cn(
            'min-w-0 flex-1 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors',
            'text-gray-500 hover:text-gray-800',
            'data-[active=true]:bg-primary data-[active=true]:text-white',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
