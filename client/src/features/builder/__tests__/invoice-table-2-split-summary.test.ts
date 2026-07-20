import { describe, expect, it } from 'vitest';
import { ComponentType } from '@invogen/shared';
import type { TemplatePage } from '@invogen/shared';
import { prepareInvoiceLivePreviewPages } from '@/features/invoice-composer/invoice-document';
import {
  normalizeInvoiceTable2Props,
  recalculateInvoiceTable2,
} from '../invoice-table-2';
import { productTablePropsToRecord } from '../product-table';

const VALUED_CELLS = { col_qty: '2', col_rate: '100', col_discount: '0', col_line_total: '200' };
const BLANK_CELLS = { col_qty: '1', col_rate: '0', col_discount: '0', col_line_total: '0' };

function tableProps(total: number, valuedCount: number): Record<string, unknown> {
  const base = normalizeInvoiceTable2Props({ showSummaryTable: true });
  const rows = Array.from({ length: total }, (_, i) => ({
    id: `row_${i + 1}`,
    name: `Row ${i + 1}`,
    heightPx: 32,
    cells: i < valuedCount ? { ...VALUED_CELLS } : { ...BLANK_CELLS },
  }));
  return productTablePropsToRecord({ ...base, rows });
}

function doc(total: number, valued: number): TemplatePage[] {
  const margins = { top: 40, right: 40, bottom: 40, left: 40 };
  return [
    {
      id: 'p1',
      name: 'Page 1',
      margins,
      elements: [
        {
          id: 't', type: ComponentType.INVOICE_TABLE_2,
          x: 66, y: 402, width: 660, height: 100, zIndex: 1,
          props: tableProps(total, valued),
        },
        {
          id: 'f', type: ComponentType.FOOTER,
          x: 141, y: 1043, width: 300, height: 24, zIndex: 1,
          props: { content: 'Thank you' },
        },
      ],
    },
  ];
}

/** Summary label=value pairs from whichever segment renders the summary block. */
function renderedSummary(pages: TemplatePage[]): string[] {
  const withSummary = pages.flatMap((p) =>
    p.elements.filter(
      (e) =>
        e.type === ComponentType.INVOICE_TABLE_2
        && Array.isArray((e.props as Record<string, unknown>).summaryRows)
        && ((e.props as Record<string, unknown>).summaryRows as unknown[]).length > 0
    )
  );
  const last = withSummary[withSummary.length - 1];
  if (!last) return [];
  const rows = (last.props as Record<string, unknown>).summaryRows as Array<{
    cells?: Record<string, string>;
  }>;
  return rows.map(
    (r) => `${r.cells?.__inv2_summary_label}=${r.cells?.__inv2_summary_value}`
  );
}

function expectedSummary(valuedCount: number): string[] {
  const base = normalizeInvoiceTable2Props({ showSummaryTable: true });
  const rows = Array.from({ length: valuedCount }, (_, i) => ({
    id: `e${i}`, name: '', heightPx: 32, cells: { ...VALUED_CELLS },
  }));
  const full = recalculateInvoiceTable2({ ...base, rows });
  return (full.summaryRows ?? []).map(
    (r) => `${r.cells?.__inv2_summary_label}=${r.cells?.__inv2_summary_value}`
  );
}

describe('invoice table 2 — split summary covers the whole table', () => {
  it('summary on the continuation page totals ALL rows, not just that segment', () => {
    const pages = prepareInvoiceLivePreviewPages(doc(24, 24));
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(renderedSummary(pages)).toEqual(expectedSummary(24));
  });

  it('values on page 1 with blank rows spilling still total correctly (was 0)', () => {
    const pages = prepareInvoiceLivePreviewPages(doc(24, 5));
    expect(pages.length).toBeGreaterThanOrEqual(2);
    const summary = renderedSummary(pages);
    expect(summary).toEqual(expectedSummary(5));
    // Guard the exact regression: the summary must not be all zeros.
    expect(summary.every((s) => /=0$/.test(s))).toBe(false);
  });

  it('unsplit table summary is unchanged', () => {
    const pages = prepareInvoiceLivePreviewPages(doc(3, 3));
    expect(renderedSummary(pages)).toEqual(expectedSummary(3));
  });
});
