import { ComponentType } from '@invogen/shared';

const DISPLAY_LOCALE = 'en-IN';
const DISPLAY_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
};

/** Human-readable date for templates (e.g. 13 Jul 2026). */
export function formatDisplayDate(date: Date = new Date()): string {
  return date.toLocaleDateString(DISPLAY_LOCALE, DISPLAY_OPTIONS);
}

/** Value for HTML `<input type="date">`. */
export function formatIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function parseFlexibleDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isIsoDateString(trimmed)) {
    const parsed = new Date(`${trimmed}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // e.g. "01 Jul 2026" / "17 Jun 2026" (template display format)
  const displayMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (displayMatch) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const month = months[displayMatch[2].toLowerCase()];
    if (month !== undefined) {
      const day = Number(displayMatch[1]);
      const year = Number(displayMatch[3]);
      const parsed = new Date(year, month, day, 12, 0, 0, 0);
      if (
        parsed.getFullYear() === year
        && parsed.getMonth() === month
        && parsed.getDate() === day
      ) {
        return parsed;
      }
    }
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toIsoDateValue(value: string): string {
  const parsed = parseFlexibleDate(value);
  return parsed ? formatIsoDate(parsed) : '';
}

export function toDisplayDateValue(value: string): string {
  const parsed = parseFlexibleDate(value);
  return parsed ? formatDisplayDate(parsed) : value.trim();
}

/** Compare ISO dates (YYYY-MM-DD). Returns negative if a < b, 0 if equal, positive if a > b. */
export function compareIsoDates(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Ensure due date is not before invoice date; returns clamped due ISO (or empty). */
export function clampDueDateToInvoiceDate(invoiceIso: string, dueIso: string): string {
  const invoice = toIsoDateValue(invoiceIso);
  const due = toIsoDateValue(dueIso);
  if (!due) return '';
  if (!invoice) return due;
  return compareIsoDates(due, invoice) < 0 ? invoice : due;
}

/** Normalize Date / DueDate in form context so due is never before invoice date. */
export function normalizeInvoiceFormDates<T extends Record<string, string | undefined>>(
  context: T
): T {
  const invoice = toIsoDateValue(String(context.Date ?? ''));
  const due = toIsoDateValue(String(context.DueDate ?? ''));
  if (!invoice && !due) return context;

  const next = { ...context };
  if (invoice) next.Date = invoice as T[keyof T] & string;
  if (due) {
    next.DueDate = (clampDueDateToInvoiceDate(invoice, due) || due) as T[keyof T] & string;
  }
  return next;
}

export function isDateFieldComponentType(type: string): boolean {
  return type === ComponentType.DATE || type === ComponentType.DUE_DATE;
}

/** Invoice date defaults to live; due date defaults to manual/sample. */
export function defaultUseLiveDate(type: string): boolean {
  return type === ComponentType.DATE;
}

export function usesLiveDate(props: Record<string, unknown>, type: string): boolean {
  if (!isDateFieldComponentType(type)) return false;
  if (props.useLiveDate === false) return false;
  if (props.useLiveDate === true) return true;
  return defaultUseLiveDate(type);
}

/** ISO value for the date picker — always returns a valid date string. */
export function getDatePickerValue(props: Record<string, unknown>, type: string): string {
  if (usesLiveDate(props, type)) return formatIsoDate();
  const iso = toIsoDateValue(String(props.value ?? ''));
  if (iso) return iso;
  if (type === ComponentType.DUE_DATE) {
    const due = new Date();
    due.setDate(due.getDate() + 15);
    return formatIsoDate(due);
  }
  return formatIsoDate();
}
