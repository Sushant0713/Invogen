import { ComponentType } from '@invogen/shared';

/** How a PAGE_NUMBER field renders its auto value. */
export type PageNumberFormat = 'page_of' | 'slash' | 'number';

export function readPageNumberFormat(props: Record<string, unknown>): PageNumberFormat {
  const raw = props.pageNumberFormat;
  if (raw === 'slash' || raw === 'number' || raw === 'page_of') return raw;
  return 'page_of';
}

/** 1-based page label, e.g. "Page 1 of 3", "1 / 3", or "1". */
export function formatPageNumberLabel(
  pageIndex: number,
  pageCount: number,
  format: PageNumberFormat = 'page_of'
): string {
  const n = Math.max(1, pageIndex + 1);
  const total = Math.max(1, pageCount);
  if (format === 'number') return String(n);
  if (format === 'slash') return `${n} / ${total}`;
  return `Page ${n} of ${total}`;
}

/** Inject the live page number into PAGE_NUMBER element props for display. */
export function withAutoPageNumberProps(
  type: string,
  props: Record<string, unknown>,
  pageIndex: number | undefined,
  pageCount: number | undefined
): Record<string, unknown> {
  if (type !== ComponentType.PAGE_NUMBER) return props;
  if (pageIndex === undefined || pageCount === undefined || pageCount < 1) return props;
  const format = readPageNumberFormat(props);
  const value = formatPageNumberLabel(pageIndex, pageCount, format);
  return {
    ...props,
    // Empty label so getDisplayText shows the full auto string (not "Page: Page 1 of 3").
    label: '',
    value,
  };
}
