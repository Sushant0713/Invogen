import { cn } from '@/lib/utils';

const INVOICE_STATUSES = ['draft', 'sent', 'paid'] as const;

export type DashboardInvoiceStatus = (typeof INVOICE_STATUSES)[number];

const STATUS_RANK: Record<DashboardInvoiceStatus, number> = {
  draft: 0,
  sent: 1,
  paid: 2,
};

/** Status can only move forward: draft → sent → paid. */
export function getDisabledInvoiceStatuses(
  current: DashboardInvoiceStatus,
): DashboardInvoiceStatus[] {
  if (current === 'paid') return [...INVOICE_STATUSES];
  if (current === 'sent') return ['draft'];
  return [];
}

interface InvoiceStatusToggleProps {
  value: string;
  onChange: (status: DashboardInvoiceStatus) => void;
  disabled?: boolean;
  loading?: boolean;
}

const STATUS_STYLES: Record<DashboardInvoiceStatus, string> = {
  draft: 'data-[active=true]:bg-gray-700 data-[active=true]:text-white',
  sent: 'data-[active=true]:bg-blue-600 data-[active=true]:text-white',
  paid: 'data-[active=true]:bg-green-600 data-[active=true]:text-white',
};

export function InvoiceStatusToggle({
  value,
  onChange,
  disabled,
  loading,
}: InvoiceStatusToggleProps) {
  const isKnownStatus = INVOICE_STATUSES.includes(value as DashboardInvoiceStatus);
  const current = isKnownStatus ? (value as DashboardInvoiceStatus) : null;
  const disabledStatuses = current ? getDisabledInvoiceStatuses(current) : [...INVOICE_STATUSES];

  return (
    <div
      className={cn(
        'inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1',
        (disabled || loading) && 'opacity-60',
      )}
      role="group"
      aria-label="Invoice status"
    >
      {INVOICE_STATUSES.map((status) => {
        const isDisabled =
          disabled || loading || disabledStatuses.includes(status);
        const isBackward =
          current !== null && STATUS_RANK[status] < STATUS_RANK[current];

        return (
        <button
          key={status}
          type="button"
          data-active={current === status}
          disabled={isDisabled}
          title={
            isBackward
              ? 'Status cannot be moved backward'
              : current === 'paid'
                ? 'Paid invoices are locked'
                : undefined
          }
          onClick={() => {
            if (status !== current && !isDisabled) onChange(status);
          }}
          className={cn(
            'min-w-[52px] rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors',
            'text-gray-500 hover:text-gray-800 disabled:cursor-not-allowed',
            STATUS_STYLES[status],
          )}
        >
          {status}
        </button>
        );
      })}
    </div>
  );
}
