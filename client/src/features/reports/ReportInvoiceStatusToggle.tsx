import { cn } from '@/lib/utils';

const REPORT_STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
] as const;

export type ReportInvoiceStatusFilter = (typeof REPORT_STATUS_OPTIONS)[number]['value'];

interface ReportInvoiceStatusToggleProps {
  value: string;
  onChange: (status: ReportInvoiceStatusFilter) => void;
}

/** Same style as All Invoices status control — filter report by Sent / Paid (or All). */
export function ReportInvoiceStatusToggle({ value, onChange }: ReportInvoiceStatusToggleProps) {
  return (
    <div
      className="inline-flex w-full rounded-xl border border-gray-200 bg-gray-50 p-1"
      role="group"
      aria-label="Invoice status filter"
    >
      {REPORT_STATUS_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          data-active={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-w-0 flex-1 rounded-lg px-2.5 py-2 text-xs font-medium capitalize transition-colors',
            'text-gray-500 hover:text-gray-800',
            option.value === 'sent' &&
              'data-[active=true]:bg-blue-600 data-[active=true]:text-white',
            option.value === 'paid' &&
              'data-[active=true]:bg-green-600 data-[active=true]:text-white',
            option.value === 'all' &&
              'data-[active=true]:bg-gray-700 data-[active=true]:text-white',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
