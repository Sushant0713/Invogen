import { describe, expect, it } from 'vitest';
import reducer, {
  loadTemplate,
  selectElement,
  updateElement,
} from '@/store/slices/builderSlice';
import { ComponentType } from '@invogen/shared';
import type { TemplatePage } from '@invogen/shared';
import { reflowPagesForPreview } from '../preview-page-reflow';
import {
  addRow,
  normalizeInvoiceTable3Props,
  productTablePropsToRecord,
  recalculateInvoiceTable3,
} from '../invoice-table-3';
import { normalizeTablePropsForType } from '../table-props-normalize';
import { resolveBuilderTablePropsForEdit } from '../product-table';

const PAGE_CONTENT_BOTTOM = 1083; // A4 (1123) − 40 bottom margin

function el(id: string, type: string, x: number, y: number, w: number, h: number, props: Record<string, unknown> = {}) {
  return { id, type, x, y, width: w, height: h, zIndex: 1, props };
}

function invoice3Table(rowCount: number): Record<string, unknown> {
  const base = normalizeInvoiceTable3Props({ showTotalFooter: true, showAmountInWords: true });
  const rows = Array.from({ length: rowCount }, (_, i) => ({
    id: `row_${i + 1}`,
    name: `Row ${i + 1}`,
    heightPx: 32,
    cells: { col_qty: '1', col_rate: '0', col_discount: '0', col_gst: '0', col_total: '0' },
  }));
  return productTablePropsToRecord({ ...base, rows });
}

function docWithRows(rowCount: number): TemplatePage[] {
  const margins = { top: 40, right: 40, bottom: 40, left: 40 };
  return [
    {
      id: 'p1',
      name: 'Page 1',
      margins,
      elements: [
        el('table', ComponentType.INVOICE_TABLE_3, 66, 402, 660, 100, invoice3Table(rowCount)),
        el('footer1', ComponentType.FOOTER, 141, 1043, 300, 24, { content: 'Thank you' }),
      ],
    },
  ];
}

function tableSegments(pages: TemplatePage[]) {
  return pages.flatMap((page, pageIndex) =>
    page.elements
      .filter((e) => e.type === ComponentType.INVOICE_TABLE_3)
      .map((e) => {
        const pr = e.props as Record<string, unknown>;
        return {
          page: pageIndex + 1,
          rows: Array.isArray(pr.rows) ? (pr.rows as unknown[]).length : 0,
          showTotals: pr.__previewPaginationShowTotals,
          showTotalFooter: pr.showTotalFooter,
          bottom: Math.round(e.y + e.height),
        };
      })
  );
}

function totalsShown(segs: ReturnType<typeof tableSegments>): boolean {
  if (!segs.length) return false;
  const last = segs[segs.length - 1];
  return last.showTotals !== false && last.showTotalFooter !== false;
}

describe('invoice table pagination — total footer survives the split', () => {
  it('keeps the total on the last segment across the whole boundary (17–30 rows)', () => {
    for (let rows = 17; rows <= 30; rows += 1) {
      const result = reflowPagesForPreview(docWithRows(rows), { trustTableProps: true });
      const segs = tableSegments(result);
      expect(totalsShown(segs), `total missing at ${rows} rows: ${JSON.stringify(segs)}`).toBe(true);
      for (const seg of segs) {
        expect(seg.bottom, `segment overflows page at ${rows} rows`).toBeLessThanOrEqual(
          PAGE_CONTENT_BOTTOM + 3
        );
      }
    }
  });
});

describe('builder slice — adding rows through the split keeps the total', () => {
  function addRowToAnchor(state: ReturnType<typeof reducer>) {
    let anchor: { id: string; props: Record<string, unknown> } | null = null;
    for (const page of state.pages) {
      for (const e of page.elements) {
        if (e.type !== ComponentType.INVOICE_TABLE_3) continue;
        const start = (e.props as Record<string, unknown>).__previewPaginationRangeStart;
        if (start == null || start === 0) {
          anchor = { id: e.id, props: e.props as Record<string, unknown> };
          break;
        }
        if (!anchor) anchor = { id: e.id, props: e.props as Record<string, unknown> };
      }
      if (anchor) break;
    }
    if (!anchor) throw new Error('no invoice_table_3 found');
    const table = normalizeTablePropsForType(
      ComponentType.INVOICE_TABLE_3,
      resolveBuilderTablePropsForEdit(anchor.props)
    );
    const next = productTablePropsToRecord(recalculateInvoiceTable3(addRow(table as never)));
    return { id: anchor.id, next };
  }

  function maxRows(state: ReturnType<typeof reducer>): number {
    let max = 0;
    for (const page of state.pages) {
      for (const e of page.elements) {
        if (e.type !== ComponentType.INVOICE_TABLE_3) continue;
        const all = (e.props as Record<string, unknown>).__previewPaginationRows;
        if (Array.isArray(all)) max = Math.max(max, all.length);
        else if (Array.isArray(e.props.rows)) max = Math.max(max, (e.props.rows as unknown[]).length);
      }
    }
    return max;
  }

  it('never drops the total while rows cross onto page 2', () => {
    let state = reducer(undefined, { type: '@@INIT' } as never);
    state = reducer(state, loadTemplate({ id: 't', name: 'T', pages: docWithRows(14) }));
    state = reducer(state, selectElement({ id: 'table' } as never));

    for (let add = 0; add < 12; add += 1) {
      const { id, next } = addRowToAnchor(state);
      state = reducer(
        state,
        updateElement({ id, changes: { props: next }, replaceProps: true, recordHistory: true } as never)
      );
      const segs = tableSegments(state.pages as TemplatePage[]);
      expect(
        totalsShown(segs),
        `total lost after add #${add + 1} (rows=${maxRows(state)}, pages=${state.pages.length})`
      ).toBe(true);
    }

    expect(maxRows(state)).toBeGreaterThanOrEqual(24);
    expect(state.pages.length).toBeGreaterThanOrEqual(2);
  });
});
