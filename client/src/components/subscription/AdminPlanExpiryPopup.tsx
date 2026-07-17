import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import {
  DUE_SOON_WITHIN_DAYS,
  daysUntilDate,
  formatPlanDaysRemainingMessage,
} from '@/lib/invoice-due-proximity';
import type { AdminSubscriptionRecord } from '@/hooks/useAdminSubscription';
import { useAppSelector } from '@/hooks/useAppDispatch';

const REMINDER_HOUR = 11;

function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dismissStorageKey(userId: string | undefined, dateKey: string) {
  return `invogen:plan-expiry-popup:${userId || 'anon'}:${dateKey}`;
}

function msUntilLocalHour(hour: number, from = new Date()): number {
  const target = new Date(from);
  target.setHours(hour, 0, 0, 0);
  if (target.getTime() <= from.getTime()) return 0;
  return target.getTime() - from.getTime();
}

interface AdminPlanExpiryPopupProps {
  subscription: AdminSubscriptionRecord | null | undefined;
  active: boolean;
}

/** Big closable reminder when the admin plan is ending soon (from 11:00 local, once per day). */
export function AdminPlanExpiryPopup({ subscription, active }: AdminPlanExpiryPopupProps) {
  const userId = useAppSelector((s) => s.auth.user?.id);
  const [open, setOpen] = useState(false);

  const plan = subscription?.planId;
  const daysRemaining = useMemo(() => {
    if (!active || !subscription?.currentPeriodEnd) return null;
    return daysUntilDate(subscription.currentPeriodEnd);
  }, [active, subscription?.currentPeriodEnd]);

  const shouldWarn =
    daysRemaining != null && daysRemaining <= DUE_SOON_WITHIN_DAYS && daysRemaining >= 0;

  useEffect(() => {
    if (!shouldWarn || daysRemaining == null) {
      setOpen(false);
      return;
    }

    const dateKey = localDateKey();
    const storageKey = dismissStorageKey(
      userId != null ? String(userId) : undefined,
      dateKey
    );
    if (typeof window !== 'undefined' && window.localStorage.getItem(storageKey)) {
      setOpen(false);
      return;
    }

    const show = () => {
      if (window.localStorage.getItem(storageKey)) return;
      setOpen(true);
    };

    const now = new Date();
    if (now.getHours() >= REMINDER_HOUR) {
      show();
      return;
    }

    const delay = msUntilLocalHour(REMINDER_HOUR, now);
    const timer = window.setTimeout(show, delay);
    return () => window.clearTimeout(timer);
  }, [shouldWarn, daysRemaining, userId]);

  if (!open || !shouldWarn || daysRemaining == null || !subscription) return null;

  const planName = plan?.name || 'subscription';
  const message = formatPlanDaysRemainingMessage(daysRemaining);

  const handleClose = () => {
    const storageKey = dismissStorageKey(
      userId != null ? String(userId) : undefined,
      localDateKey()
    );
    window.localStorage.setItem(storageKey, '1');
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-expiry-title"
        className="relative w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl"
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 id="plan-expiry-title" className="text-2xl font-bold text-gray-900">
            Plan ending soon
          </h2>
          <p className="mt-3 text-lg font-semibold text-red-600">{message}</p>
          <p className="mt-2 text-sm text-gray-600">
            Your <span className="font-medium text-gray-900">{planName}</span> plan
            {subscription.currentPeriodEnd
              ? ` ends on ${formatDate(subscription.currentPeriodEnd)}`
              : ' is ending soon'}
            . Renew to keep uninterrupted access.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to="/admin/subscription" onClick={handleClose}>
              <Button type="button" className="w-full sm:w-auto">
                Renew plan
              </Button>
            </Link>
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
