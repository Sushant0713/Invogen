import type { LineItem, TemplatePage } from '@invogen/shared';
import { parseIndianAmount } from './invoice-gst';

export type ProductSaleLine = {
  productKey: string;
  productId: string | null;
  name: string;
  quantity: number;
  revenue: number;
};

type TableColumn = {
  id: string;
  label: string;
  visible?: boolean;
  columnType?: string;
};

type TableRow = {
  id?: string;
  name?: string;
  cells?: Record<string, string>;
};

const TABLE_TYPES = new Set([
  'product_table',
  'table',
  'invoice_table',
  'invoice_table_2',
  'invoice_table_3',
]);

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return parseIndianAmount(value);
}

function stripSkuSuffix(name: string): string {
  return name.replace(/\s*\([^)]+\)\s*$/, '').trim();
}

function productKeyFrom(name: string, productId?: string | null): string {
  if (productId) return `id:${productId}`;
  const normalized = stripSkuSuffix(name).toLowerCase();
  return normalized ? `name:${normalized}` : 'unknown';
}

function isSerialColumn(col: TableColumn): boolean {
  return col.columnType === 'sr_no';
}

function isProductNameColumn(col: TableColumn): boolean {
  if (col.visible === false || isSerialColumn(col)) return false;
  if (col.columnType === 'product') return true;
  const token = `${col.id} ${col.label}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  return /\b(item|items|product|products|description|particular|service|plan|name)\b/.test(token);
}

function resolveProductNameColumnId(columns: TableColumn[]): string | null {
  const productCol = columns.find((col) => col.columnType === 'product' && col.visible !== false);
  if (productCol) return productCol.id;

  const byLabel = columns.find((col) => isProductNameColumn(col));
  if (byLabel) return byLabel.id;

  const fallback = columns.find(
    (col) => col.visible !== false && !isSerialColumn(col) && col.id === 'col_item'
  );
  return fallback?.id ?? null;
}

function resolveQtyColumnId(columns: TableColumn[], sampleCells?: Record<string, string>): string | null {
  const candidates = columns.filter((col) => {
    if (col.visible === false || isSerialColumn(col)) return false;
    return /quant|qty|quantity/.test(normalizeLabel(col.label)) || col.id === 'col_qty';
  });
  if (candidates.length === 1) return candidates[0].id;
  if (candidates.length > 1 && sampleCells) {
    const withValues = candidates
      .map((col) => ({ col, value: parseAmount(sampleCells[col.id]) }))
      .filter((item) => item.value > 0);
    if (withValues.length > 0) return withValues[0].col.id;
  }
  return candidates[0]?.id ?? null;
}

function resolveRateColumnId(columns: TableColumn[], sampleCells?: Record<string, string>): string | null {
  const candidates = columns.filter((col) => {
    if (col.visible === false || isSerialColumn(col)) return false;
    const norm = normalizeLabel(col.label);
    return /^rate$|unitprice|price|mrp/.test(norm) || norm.includes('rate') || col.id === 'col_rate' || col.id === 'col_price';
  });
  if (candidates.length === 1) return candidates[0].id;
  if (candidates.length > 1 && sampleCells) {
    const withValues = candidates
      .map((col) => ({ col, value: parseAmount(sampleCells[col.id]) }))
      .filter((item) => item.value > 0);
    if (withValues.length > 0) return withValues[0].col.id;
  }
  return candidates[0]?.id ?? null;
}

function resolveAmountColumnIds(columns: TableColumn[]): string[] {
  const ids = columns
    .filter((col) => {
      if (col.visible === false || isSerialColumn(col)) return false;
      const norm = normalizeLabel(col.label);
      return /^amount$|^total$|^lineamount$|^linetotal$/.test(norm) || col.id === 'col_total';
    })
    .map((col) => col.id);
  return ids.length > 0 ? ids : ['col_total'];
}

function isSummaryRow(row: TableRow): boolean {
  const nameToken = normalizeLabel(row.name ?? '');
  if (/^(subtotal|cgst|sgst|gst|total|final|amount|tax)$/.test(nameToken)) return true;
  for (const value of Object.values(row.cells ?? {})) {
    const token = normalizeLabel(String(value));
    if (/^(subtotal|cgst|sgst|gst|total|final)$/.test(token)) return true;
  }
  return false;
}

function isContinuationSegment(props: Record<string, unknown>): boolean {
  const start = props.__previewPaginationStart;
  return typeof start === 'number' && start > 0;
}

function extractFromTableProps(props: Record<string, unknown>): ProductSaleLine[] {
  if (isContinuationSegment(props)) return [];

  const columns = (Array.isArray(props.columns) ? props.columns : []) as TableColumn[];
  const rows = (Array.isArray(props.rows) ? props.rows : []) as TableRow[];
  if (columns.length === 0 || rows.length === 0) return [];

  const lines: ProductSaleLine[] = [];

  for (const row of rows) {
    if (isSummaryRow(row)) continue;
    const cells = row.cells ?? {};
    const nameCol = resolveProductNameColumnId(columns);
    const rawName = nameCol ? String(cells[nameCol] ?? '').trim() : '';
    const name = stripSkuSuffix(rawName || String(row.name ?? '').trim());
    if (!name) continue;

    const qtyCol = resolveQtyColumnId(columns, cells);
    const rateCol = resolveRateColumnId(columns, cells);
    const amountCols = resolveAmountColumnIds(columns);

    const quantity = qtyCol ? parseAmount(cells[qtyCol]) : 1;
    let revenue = 0;
    for (const colId of amountCols) {
      revenue = Math.max(revenue, parseAmount(cells[colId]));
    }
    if (revenue <= 0 && qtyCol && rateCol) {
      revenue = Math.max(0, quantity * parseAmount(cells[rateCol]));
    }
    if (quantity <= 0 && revenue <= 0) continue;

    lines.push({
      productKey: productKeyFrom(name),
      productId: null,
      name,
      quantity: quantity > 0 ? quantity : 1,
      revenue,
    });
  }

  return lines;
}

function extractFromTemplateSnapshot(snapshot?: TemplatePage[]): ProductSaleLine[] {
  if (!Array.isArray(snapshot)) return [];
  const lines: ProductSaleLine[] = [];

  for (const page of snapshot) {
    for (const element of page.elements ?? []) {
      if (!TABLE_TYPES.has(element.type)) continue;
      lines.push(...extractFromTableProps(element.props ?? {}));
    }
  }

  return lines;
}

function extractFromLineItems(lineItems?: LineItem[]): ProductSaleLine[] {
  if (!Array.isArray(lineItems)) return [];

  return lineItems
    .map((item) => {
      const name = stripSkuSuffix(String(item.name ?? '').trim());
      if (!name || name.toLowerCase() === 'service') return null;
      const quantity = item.quantity > 0 ? item.quantity : 1;
      const revenue = item.total > 0 ? item.total : Math.max(0, quantity * item.price);
      if (quantity <= 0 && revenue <= 0) return null;
      return {
        productKey: productKeyFrom(name, item.productId ? String(item.productId) : null),
        productId: item.productId ? String(item.productId) : null,
        name,
        quantity,
        revenue,
      } satisfies ProductSaleLine;
    })
    .filter((line): line is ProductSaleLine => line !== null);
}

export function extractInvoiceProductLines(invoice: {
  templateSnapshot?: TemplatePage[];
  lineItems?: LineItem[];
}): ProductSaleLine[] {
  const fromTables = extractFromTemplateSnapshot(invoice.templateSnapshot);
  if (fromTables.length > 0) return fromTables;
  return extractFromLineItems(invoice.lineItems);
}
