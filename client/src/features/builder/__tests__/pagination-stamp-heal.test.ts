import { describe, expect, it } from 'vitest';
import { ComponentType } from '@invogen/shared';
import type { TemplatePage } from '@invogen/shared';
import {
  consolidatePaginatedTablesToAuthored,
  stripLayoutOnlyStampsFromPages,
  reflowPagesForPreview,
} from '../preview-page-reflow';
import { normalizeInvoiceTableProps } from '../invoice-table';
import { productTablePropsToRecord } from '../product-table';

// A table 1 corrupted exactly like the real saved template: 1 authored row but
// stale pagination stamps for a 16-row split, stamped as the SECOND segment.
function corruptTable1Doc(): TemplatePage[] {
  const base = normalizeInvoiceTableProps({ showGrandTotalFooter: true, showAmountInWords: true });
  const fullRows = Array.from({ length: 16 }, (_, i) => ({
    id: `row_${i + 1}`, name: `Row ${i + 1}`, heightPx: 32, cells: {},
  }));
  const props = {
    ...productTablePropsToRecord({ ...base, rows: [fullRows[15]] }), // only the sliced row
    __previewPaginationRows: fullRows,
    __previewPaginationStart: 15,
    __previewPaginationEnd: 16,
    __previewPaginationShowTotals: true,
    __previewPaginationTableId: 'tbl-1',
  };
  return [{
    id: 'p1', name: 'Page 1', margins: { top: 40, right: 40, bottom: 40, left: 40 },
    elements: [
      { id: 'tbl-1', type: ComponentType.INVOICE_TABLE, x: 66, y: 40, width: 660, height: 139, zIndex: 1, props },
    ],
  }];
}

const PAGINATION_KEYS = [
  '__previewPaginationRows', '__previewPaginationStart', '__previewPaginationEnd',
  '__previewPaginationShowTotals', '__previewPaginationTableId',
];

describe('pagination stamp heal', () => {
  it('consolidation restores full authored rows and strips all stamps', () => {
    const healed = consolidatePaginatedTablesToAuthored(corruptTable1Doc());
    const table = healed[0].elements.find((e) => e.type === ComponentType.INVOICE_TABLE)!;
    const pr = table.props as Record<string, unknown>;
    expect(Array.isArray(pr.rows) ? (pr.rows as unknown[]).length : 0).toBe(16);
    for (const key of PAGINATION_KEYS) expect(key in pr, `${key} not stripped`).toBe(false);
    // total footer intended → preserved
    expect(pr.showGrandTotalFooter).toBe(true);
  });

  it('save strip also consolidates (no pagination stamps persisted)', () => {
    const saved = stripLayoutOnlyStampsFromPages(corruptTable1Doc());
    const pr = saved[0].elements[0].props as Record<string, unknown>;
    for (const key of PAGINATION_KEYS) expect(key in pr).toBe(false);
    expect((pr.rows as unknown[]).length).toBe(16);
  });

  it('healed table re-paginates with the grand total on the last segment', () => {
    const healed = consolidatePaginatedTablesToAuthored(corruptTable1Doc());
    const result = reflowPagesForPreview(healed, { trustTableProps: true });
    const segs = result.flatMap((p, pi) =>
      p.elements.filter((e) => e.type === ComponentType.INVOICE_TABLE).map((e) => ({
        page: pi + 1,
        showTotals: (e.props as Record<string, unknown>).__previewPaginationShowTotals,
        showGrandTotalFooter: (e.props as Record<string, unknown>).showGrandTotalFooter,
      }))
    );
    const last = segs[segs.length - 1];
    expect(last.showTotals !== false && last.showGrandTotalFooter !== false).toBe(true);
  });
});
