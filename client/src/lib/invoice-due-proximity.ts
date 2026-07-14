/** Highlight unpaid/sent invoices whose due date is within this many days (or overdue). */
export const DUE_SOON_WITHIN_DAYS = 7;

export type DueProximityRow = {
  status?: string;
  dueDate?: string | null;
  customerSnapshot?: {
    placeholders?: { DueDate?: string };
  } | null;
};

export function resolveInvoiceDueDate(row: DueProximityRow): Date | null {
  const raw = row.dueDate || row.customerSnapshot?.placeholders?.DueDate || '';
  if (!raw) return null;
  const due = new Date(raw);
  return Number.isNaN(due.getTime()) ? null : due;
}

export function formatDaysRemainingMessage(daysRemaining: number): string {
  if (daysRemaining > 0) {
    return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`;
  }
  if (daysRemaining === 0) return 'Due today';
  const overdue = Math.abs(daysRemaining);
  return `${overdue} day${overdue === 1 ? '' : 's'} overdue`;
}

export function getDueProximity(row: DueProximityRow, warnWithinDays = DUE_SOON_WITHIN_DAYS) {
  if (String(row.status) !== 'sent') return null;
  const due = resolveInvoiceDueDate(row);
  if (!due) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);

  const daysRemaining = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  if (daysRemaining > warnWithinDays) return null;

  return {
    daysRemaining,
    message: formatDaysRemainingMessage(daysRemaining),
  };
}

/** Days until a calendar date (plan period end), or null if invalid. */
export function daysUntilDate(isoDate: string | Date | null | undefined): number | null {
  if (!isoDate) return null;
  const end = new Date(isoDate);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  return Math.round((endDay.getTime() - today.getTime()) / 86_400_000);
}

export function formatPlanDaysRemainingMessage(daysRemaining: number): string {
  if (daysRemaining > 0) {
    return `Your plan ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
  }
  if (daysRemaining === 0) return 'Your plan ends today';
  const overdue = Math.abs(daysRemaining);
  return `Your plan ended ${overdue} day${overdue === 1 ? '' : 's'} ago`;
}
