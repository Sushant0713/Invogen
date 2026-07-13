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
