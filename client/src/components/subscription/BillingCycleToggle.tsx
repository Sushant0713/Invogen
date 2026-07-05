import { cn } from '@/lib/utils';

type BillingCycle = 'monthly' | 'yearly';

export function BillingCycleToggle({
  value,
  onChange,
  className,
}: {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  className?: string;
}) {
  return (
    <div
      className={cn('inline-flex shrink-0 rounded-full bg-gray-100 p-0.5 text-[11px]', className)}
      role="tablist"
      aria-label="Billing cycle"
    >
      {(['monthly', 'yearly'] as const).map((cycle) => {
        const active = value === cycle;
        return (
          <button
            key={cycle}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(cycle)}
            className={cn(
              'rounded-full px-3 py-1 font-medium transition-all duration-200',
              active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {cycle === 'monthly' ? 'Month' : 'Year'}
          </button>
        );
      })}
    </div>
  );
}
