import { ComponentType } from '../types/component';
import type { CanvasElement, TemplatePage } from '../types/invoice';

/** One subscription line used to populate template product/invoice tables. */
export interface PlatformInvoiceTableLine {
  description: string;
  quantity: number;
  /** List price before discount (usually plan subtotal). */
  rate: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst?: number;
  tax: number;
  total: number;
}

type TableColumn = { id?: string; label?: string };
type TableRow = {
  id?: string;
  name?: string;
  heightPx?: number;
  cells?: Record<string, string>;
};

const TABLE_TYPES = new Set<string>([
  ComponentType.PRODUCT_TABLE,
  ComponentType.INVOICE_TABLE,
  ComponentType.INVOICE_TABLE_2,
  ComponentType.INVOICE_TABLE_3,
  ComponentType.TABLE,
  'product_table',
  'invoice_table',
  'invoice_table_2',
  'invoice_table_3',
  'table',
]);

function formatCellAmount(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isSummaryLikeRow(row: TableRow): boolean {
  const id = normalizeToken(String(row.id ?? ''));
  if (id.includes('summary') || id.startsWith('inv2summary')) return true;
  const name = normalizeToken(String(row.name ?? ''));
  if (/^(subtotal|cgst|sgst|gst|total|final|amount|tax)$/.test(name)) return true;
  if (name.includes('subtotal') || name.includes('grandtotal')) return true;
  for (const value of Object.values(row.cells ?? {})) {
    const token = normalizeToken(String(value));
    if (/^(subtotal|cgst|sgst|gst|total|final)$/.test(token)) return true;
  }
  return false;
}

function findColumnId(
  columns: TableColumn[],
  options: { ids?: string[]; labelIncludes?: string[]; labelExcludes?: string[] }
): string | null {
  for (const id of options.ids ?? []) {
    const hit = columns.find((col) => String(col.id ?? '') === id);
    if (hit?.id) return String(hit.id);
  }
  for (const col of columns) {
    const label = normalizeToken(String(col.label ?? ''));
    if (!label) continue;
    if ((options.labelExcludes ?? []).some((ex) => label.includes(normalizeToken(ex)))) {
      continue;
    }
    for (const needle of options.labelIncludes ?? []) {
      if (label.includes(normalizeToken(needle))) {
        return col.id ? String(col.id) : null;
      }
    }
  }
  return null;
}

function resolveColumnMap(columns: TableColumn[]) {
  return {
    sr: findColumnId(columns, { ids: ['col_sr_no'], labelIncludes: ['srno', 'sno'] }),
    items: findColumnId(columns, {
      ids: ['col_items', 'col_item'],
      labelIncludes: ['item', 'product', 'description', 'particular', 'service', 'plan'],
    }),
    qty: findColumnId(columns, {
      ids: ['col_units', 'col_qty'],
      labelIncludes: ['qty', 'quantity', 'units'],
      labelExcludes: ['price', 'rate', 'amount'],
    }),
    rate: findColumnId(columns, {
      ids: ['col_rate', 'col_price'],
      labelIncludes: ['rate', 'unitprice', 'price'],
      labelExcludes: ['total', 'taxable', 'discount'],
    }),
    discount: findColumnId(columns, {
      ids: ['col_discount'],
      labelIncludes: ['discount'],
    }),
    taxable: findColumnId(columns, {
      ids: ['col_taxable'],
      labelIncludes: ['taxable'],
    }),
    cgst: findColumnId(columns, { ids: ['col_cgst'], labelIncludes: ['cgst'] }),
    sgst: findColumnId(columns, { ids: ['col_sgst'], labelIncludes: ['sgst'] }),
    igst: findColumnId(columns, { ids: ['col_igst'], labelIncludes: ['igst'] }),
    gst: findColumnId(columns, {
      ids: ['col_gst'],
      labelIncludes: ['gst'],
      labelExcludes: ['cgst', 'sgst', 'igst', 'taxable'],
    }),
    total: findColumnId(columns, {
      ids: ['col_total', 'col_line_total'],
      labelIncludes: ['linetotal', 'totalamount', 'total'],
      labelExcludes: ['subtotal', 'taxable'],
    }),
  };
}

function fillRowCells(
  columns: TableColumn[],
  existing: Record<string, string> | undefined,
  line: PlatformInvoiceTableLine,
  elementType: string
): Record<string, string> {
  const cells: Record<string, string> = { ...(existing ?? {}) };
  const map = resolveColumnMap(columns);
  const type = String(elementType);
  // Invoice table 2 line total is pre-tax (qty×rate − discount). Others include tax in total.
  const lineTotalValue =
    type === ComponentType.INVOICE_TABLE_2 || type === 'invoice_table_2'
      ? line.taxable
      : type === ComponentType.PRODUCT_TABLE || type === 'product_table' || type === 'table'
        ? map.discount
          ? line.taxable
          : line.rate
        : line.total;

  if (map.sr) cells[map.sr] = '1';
  if (map.items) cells[map.items] = line.description;
  if (map.qty) cells[map.qty] = formatCellAmount(line.quantity);
  if (map.rate) cells[map.rate] = formatCellAmount(line.rate);
  if (map.discount) cells[map.discount] = formatCellAmount(line.discount);
  if (map.taxable) cells[map.taxable] = formatCellAmount(line.taxable);
  if (map.cgst) cells[map.cgst] = formatCellAmount(line.cgst);
  if (map.sgst) cells[map.sgst] = formatCellAmount(line.sgst);
  if (map.igst) cells[map.igst] = formatCellAmount(line.igst ?? line.tax);
  if (map.gst) cells[map.gst] = formatCellAmount(line.tax);
  if (map.total) cells[map.total] = formatCellAmount(lineTotalValue);

  return cells;
}

function clearSampleRowCells(
  columns: TableColumn[],
  existing: Record<string, string> | undefined,
  rowIndex: number
): Record<string, string> {
  const cells: Record<string, string> = { ...(existing ?? {}) };
  const map = resolveColumnMap(columns);
  for (const col of columns) {
    const id = col.id ? String(col.id) : '';
    if (!id) continue;
    if (map.sr && id === map.sr) {
      cells[id] = String(rowIndex + 1);
      continue;
    }
    // Keep authored empty shells; clear leftover sample values only.
    if (
      id === map.items
      || id === map.qty
      || id === map.rate
      || id === map.discount
      || id === map.taxable
      || id === map.cgst
      || id === map.sgst
      || id === map.igst
      || id === map.gst
      || id === map.total
    ) {
      cells[id] = id === map.discount || id === map.taxable || id === map.cgst || id === map.sgst || id === map.igst || id === map.gst || id === map.total
        ? '0'
        : '';
    }
  }
  return cells;
}

/**
 * Fill plan + discount into the first data row only.
 * Keeps authored columns, widths, row count, heights, and discount mode intact.
 */
function fillTableElement(element: CanvasElement, line: PlatformInvoiceTableLine): CanvasElement {
  if (!TABLE_TYPES.has(String(element.type))) return element;

  const props = { ...(element.props ?? {}) } as Record<string, unknown>;
  const columns = Array.isArray(props.columns) ? (props.columns as TableColumn[]) : [];
  if (columns.length === 0) return element;

  const rows = Array.isArray(props.rows) ? (props.rows as TableRow[]) : [];
  if (rows.length === 0) return element;

  let filledFirstDataRow = false;
  let dataRowIndex = 0;
  const nextRows = rows.map((row) => {
    if (isSummaryLikeRow(row)) return row;
    const index = dataRowIndex;
    dataRowIndex += 1;
    if (!filledFirstDataRow) {
      filledFirstDataRow = true;
      return {
        ...row,
        cells: fillRowCells(columns, row.cells, line, String(element.type)),
      };
    }
    // Preserve extra authored rows; clear sample leftovers so only the plan line shows.
    return {
      ...row,
      cells: clearSampleRowCells(columns, row.cells, index),
    };
  });

  return {
    ...element,
    props: {
      ...props,
      rows: nextRows,
    },
  };
}

/** Patch table cell values with the selected plan line — structure stays as authored. */
export function fillPlatformInvoiceTables(
  pages: TemplatePage[],
  line: PlatformInvoiceTableLine
): TemplatePage[] {
  return pages.map((page) => ({
    ...page,
    elements: page.elements.map((element) => fillTableElement(element, line)),
  }));
}

export function buildPlatformInvoiceTableLine(params: {
  planName: string;
  billingCycle: string;
  subtotal: number;
  discount: number;
  cgst: number;
  sgst: number;
  tax: number;
  total: number;
  discountCode?: string;
}): PlatformInvoiceTableLine {
  const plan = params.planName?.trim() || 'Subscription plan';
  const cycle = params.billingCycle?.trim();
  const code = params.discountCode?.trim();
  // Single line — multi-line text grows row height and can squash column widths in preview.
  const description = [plan, cycle ? `(${cycle})` : null, code ? `· ${code}` : null]
    .filter(Boolean)
    .join(' ');

  const taxable = Math.max(0, params.subtotal - params.discount);
  return {
    description,
    quantity: 1,
    rate: params.subtotal,
    discount: Math.max(0, params.discount),
    taxable,
    cgst: params.cgst,
    sgst: params.sgst,
    tax: params.tax,
    total: params.total,
  };
}
