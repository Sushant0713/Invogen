import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import {
  clampDueDateToInvoiceDate,
  getDatePickerValue,
  toIsoDateValue,
} from '@/lib/date-format';

/** Effective ISO date shown for a date / due-date field (respects live date). */
export function getElementDateIso(
  element: Pick<CanvasElement, 'type' | 'props'>
): string {
  return getDatePickerValue((element.props ?? {}) as Record<string, unknown>, element.type);
}

/** First invoice-date (Date) field found on the template pages. */
export function findPrimaryInvoiceDateIso(pages: TemplatePage[]): string {
  for (const page of pages) {
    for (const element of page.elements) {
      if (element.type === ComponentType.DATE) {
        const iso = getElementDateIso(element);
        if (iso) return iso;
      }
    }
  }
  return '';
}

/** Props for a due-date field that is never before the invoice date. */
export function clampDueDateElementProps(
  props: Record<string, unknown>,
  invoiceIso: string
): { props: Record<string, unknown>; changed: boolean; clampedTo: string } {
  const current = getDatePickerValue(props, ComponentType.DUE_DATE);
  const clamped = clampDueDateToInvoiceDate(invoiceIso, current);
  if (!clamped || clamped === current) {
    return { props, changed: false, clampedTo: current };
  }
  return {
    props: {
      ...props,
      value: clamped,
      useLiveDate: false,
    },
    changed: true,
    clampedTo: clamped,
  };
}

/** Normalize every due-date field on the pages so none are before the invoice date. */
export function enforceInvoiceDueDateOrderOnPages(pages: TemplatePage[]): {
  pages: TemplatePage[];
  changed: boolean;
} {
  const invoiceIso = findPrimaryInvoiceDateIso(pages);
  if (!invoiceIso) return { pages, changed: false };

  let changed = false;
  const nextPages = pages.map((page) => ({
    ...page,
    elements: page.elements.map((element) => {
      if (element.type !== ComponentType.DUE_DATE) return element;
      const result = clampDueDateElementProps(
        (element.props ?? {}) as Record<string, unknown>,
        invoiceIso
      );
      if (!result.changed) return element;
      changed = true;
      return { ...element, props: result.props };
    }),
  }));

  return { pages: nextPages, changed };
}

/** Display value for due date on canvas / preview — never earlier than invoice date. */
export function resolveDueDateDisplayIso(
  dueProps: Record<string, unknown>,
  invoiceIso: string
): string {
  const due = getDatePickerValue(dueProps, ComponentType.DUE_DATE);
  if (!invoiceIso) return due;
  return clampDueDateToInvoiceDate(invoiceIso, due) || due;
}

export function isDueBeforeInvoice(invoiceIso: string, dueIso: string): boolean {
  const invoice = toIsoDateValue(invoiceIso);
  const due = toIsoDateValue(dueIso);
  if (!invoice || !due) return false;
  return due < invoice;
}
