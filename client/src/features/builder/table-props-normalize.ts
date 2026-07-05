import { ComponentType } from '@invogen/shared';
import { normalizeProductTableProps, productTablePropsToRecord, recalculateProductTable, resolveProductAmountColumnIds, resolveProductQtyColumnId, resolveProductRateColumnId } from './product-table';
import { isInvoiceTable1Type, normalizeInvoiceTableProps } from './invoice-table';
import {
  INVOICE2_COL_DISCOUNT,
  INVOICE2_COL_LINE_TOTAL,
  isInvoiceTable2Type,
  normalizeInvoiceTable2Props,
} from './invoice-table-2';
import { isInvoiceTable3Type, normalizeInvoiceTable3Props } from './invoice-table-3';
import type { ProductTableProps } from './product-table';

/** Some templates store invoice-table-2 data under product_table type. */
export function hasInvoice2TableLayout(raw: Record<string, unknown> = {}): boolean {
  if (raw.showSummaryTable === true) return true;
  if (Array.isArray(raw.summaryRows) && raw.summaryRows.length > 0) return true;
  const cols = raw.columns;
  if (!Array.isArray(cols)) return false;
  const ids = new Set(cols.map((col: { id?: string }) => col.id));
  return ids.has(INVOICE2_COL_DISCOUNT) && ids.has(INVOICE2_COL_LINE_TOTAL);
}

export function resolveTableElementType(
  type: string,
  raw: Record<string, unknown> = {}
): string {
  if (isInvoiceTable1Type(type) || isInvoiceTable2Type(type) || isInvoiceTable3Type(type)) {
    return type;
  }
  if ((type === ComponentType.PRODUCT_TABLE || type === 'table') && hasInvoice2TableLayout(raw)) {
    return ComponentType.INVOICE_TABLE_2;
  }
  return type;
}

export function normalizeTablePropsForType(
  type: string,
  raw: Record<string, unknown> = {}
): ProductTableProps {
  const resolvedType = resolveTableElementType(type, raw);
  if (isInvoiceTable1Type(resolvedType)) return normalizeInvoiceTableProps(raw);
  if (isInvoiceTable2Type(resolvedType)) return normalizeInvoiceTable2Props(raw);
  if (isInvoiceTable3Type(resolvedType)) return normalizeInvoiceTable3Props(raw);
  const normalized = normalizeProductTableProps(raw);
  return recalculateProductTable(normalized);
}

export { productTablePropsToRecord };
