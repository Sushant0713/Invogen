import { UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { CustomerSuggestion } from './customer-suggest';

interface Props {
  suggestion: CustomerSuggestion;
  isRepeat: boolean;
  priorInvoiceCount: number;
  saving: boolean;
  onAdd: () => void;
  onDismiss: () => void;
}

/**
 * Shown in the composer form (never on the invoice canvas — that would end up
 * in the PDF/share link) when a manually-typed customer has been billed before
 * but is not in the customer list.
 */
export function SaveCustomerPrompt({
  suggestion,
  isRepeat,
  priorInvoiceCount,
  saving,
  onAdd,
  onDismiss,
}: Props) {
  const times = priorInvoiceCount === 1 ? 'once before' : `${priorInvoiceCount} times before`;
  const detail = [suggestion.phone, suggestion.email].filter(Boolean).join(' · ');
  const who = suggestion.name || 'this customer';

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 rounded-full bg-amber-100 p-1.5 text-amber-700">
          <UserPlus className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-900">
            {isRepeat ? `You billed ${who} ${times}` : `Save ${who} to your customers?`}
          </p>
          {detail ? (
            <p className="mt-0.5 truncate text-xs text-amber-700">{detail}</p>
          ) : null}
          <p className="mt-1 text-xs text-amber-700">
            {isRepeat
              ? "They're not in your customer list yet — save them to pick them next time."
              : 'Saving them now means you can pick them from the list next time.'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={onAdd} loading={saving} disabled={saving}>
              <UserPlus className="h-3.5 w-3.5" />
              Add to customers
            </Button>
            <Button variant="ghost" size="sm" onClick={onDismiss} disabled={saving}>
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          disabled={saving}
          title="Dismiss"
          className="shrink-0 rounded p-1 text-amber-500 hover:bg-amber-100 hover:text-amber-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
