import { SubscriptionStatus } from '@invogen/shared';
import { Notification, Subscription } from '../models';
import { notificationService } from '../services/notification.service';
import { notifySubscriptionExpiringSoon } from '../utils/notification-events';

/** Warn when plan period end is within this many days (or ends today). */
const WARN_WITHIN_DAYS = 7;
/** Local server hour (0–23) when daily plan reminders are sent. */
const REMINDER_HOUR = 11;
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

function formatReminderDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysUntil(end: Date, now: Date): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  return Math.round((endDay.getTime() - today.getTime()) / 86_400_000);
}

async function alreadyRemindedToday(companyId: string, reminderDate: string): Promise<boolean> {
  const existing = await Notification.findOne({
    'metadata.kind': 'subscriptionExpiringSoon',
    'metadata.companyId': companyId,
    'metadata.reminderDate': reminderDate,
  })
    .select('_id')
    .lean();
  return Boolean(existing);
}

export async function runSubscriptionExpiringSoonReminders(now = new Date()): Promise<number> {
  if (now.getHours() !== REMINDER_HOUR) return 0;

  const reminderDate = formatReminderDate(now);
  const windowEnd = new Date(now);
  windowEnd.setHours(0, 0, 0, 0);
  windowEnd.setDate(windowEnd.getDate() + WARN_WITHIN_DAYS);
  windowEnd.setHours(23, 59, 59, 999);

  const windowStart = new Date(now);
  windowStart.setHours(0, 0, 0, 0);

  const subscriptions = await Subscription.find({
    status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
    currentPeriodEnd: { $gte: windowStart, $lte: windowEnd },
  })
    .populate('planId', 'name billingCycle')
    .populate('companyId', 'name')
    .lean();

  let sent = 0;

  for (const subscription of subscriptions) {
    const plan = subscription.planId as
      | { name?: string; billingCycle?: string }
      | null
      | undefined;
    if (!plan) continue;

    const company = subscription.companyId as { _id?: unknown; name?: string } | null | undefined;
    const companyId = company?._id != null ? String(company._id) : String(subscription.companyId);
    if (!companyId) continue;

    const periodEnd = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd)
      : null;
    if (!periodEnd || Number.isNaN(periodEnd.getTime())) continue;

    const daysRemaining = daysUntil(periodEnd, now);
    if (daysRemaining > WARN_WITHIN_DAYS) continue;

    if (await alreadyRemindedToday(companyId, reminderDate)) continue;

    const companyName = company?.name || 'Client';
    const planName = plan.name || 'subscription';

    await notifySubscriptionExpiringSoon({
      companyId,
      companyName,
      planName,
      daysRemaining,
      reminderDate,
    });
    sent += 1;
  }

  return sent;
}

let started = false;

/** Daily at 11:00 (server local time): notify admins + super-admins of plans ending soon. */
export function startSubscriptionExpiryReminderJob() {
  if (started) return;
  started = true;

  const tick = () => {
    notificationService.fire(
      runSubscriptionExpiringSoonReminders().then((count) => {
        if (count > 0) {
          console.log(`[subscription-reminders] Sent ${count} expiring-soon notification(s)`);
        }
      })
    );
  };

  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
}
