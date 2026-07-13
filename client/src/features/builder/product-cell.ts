import type { CompanyProductOption } from './use-company-products';
import type { ProductTableColumn, ProductTableProps } from './product-table';
import {
  updateCell,
  recalculateProductTable,
  resolveProductRateColumnId,
} from './product-table';
import {
  isInvoiceTable1Type,
  INVOICE_COL_RATE,
  INVOICE_COL_DISCOUNT,
  isInvoiceColumnVisible,
  updateInvoiceCell,
  type InvoiceTableProps,
  type InvoiceDiscountMode,
} from './invoice-table';
import {
  isInvoiceTable2Type,
  resolveInvoice2RateColumnId,
  applyInvoice2CellEdits,
  INVOICE2_COL_DISCOUNT,
  isInvoice2ColumnVisible,
  type InvoiceTable2Props,
} from './invoice-table-2';
import {
  isInvoiceTable3Type,
  INVOICE3_COL_RATE,
  INVOICE3_COL_DISCOUNT,
  isInvoice3ColumnVisible,
  updateInvoice3Cell,
  type InvoiceTable3Props,
} from './invoice-table-3';
import { EMPTY_TAX_SETTINGS, type TaxSettings } from './tax-settings';

export type ProductPick = Pick<CompanyProductOption, 'name' | 'sku' | 'price' | 'discount' | 'discountType'>;

/** Display value stored in the product column when SKU toggle is on. */
export function formatProductCellValue(
  pick: Pick<ProductPick, 'name' | 'sku'>,
  showSku: boolean
): string {
  const name = pick.name.trim();
  const sku = pick.sku?.trim();
  if (!showSku || !sku) return name;
  return `${name} (${sku})`;
}

export function formatProductPrice(price?: number): string {
  if (price == null || !Number.isFinite(price)) return '';
  const rounded = Math.round(price * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function resolveTableDiscountMode(table: ProductTableProps): InvoiceDiscountMode {
  const mode = (table as { discountMode?: string }).discountMode;
  return mode === 'percent' ? 'percent' : 'amount';
}

export function formatProductDiscount(
  product: Pick<ProductPick, 'discount' | 'price' | 'discountType'>,
  discountMode: InvoiceDiscountMode
): string {
  const value = product.discount ?? 0;
  if (!value || value <= 0) return '0';

  const catalogType = product.discountType === 'fixed' ? 'fixed' : 'percentage';

  if (discountMode === 'percent') {
    if (catalogType === 'percentage') return String(value);
    const price = product.price ?? 0;
    if (!price) return '0';
    const percent = Math.round((value / price) * 100 * 100) / 100;
    return Number.isInteger(percent) ? String(percent) : percent.toFixed(2);
  }

  if (catalogType === 'fixed') {
    const amount = Math.round(value * 100) / 100;
    return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  }

  const price = product.price ?? 0;
  if (!price) return '0';
  const amount = Math.round((price * value) / 100 * 100) / 100;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

export function resolveTableDiscountColumnId(
  tableType: string,
  columns: ProductTableColumn[]
): string | null {
  if (isInvoiceTable1Type(tableType)) {
    return isInvoiceColumnVisible(columns, INVOICE_COL_DISCOUNT) ? INVOICE_COL_DISCOUNT : null;
  }
  if (isInvoiceTable2Type(tableType)) {
    return isInvoice2ColumnVisible(columns, INVOICE2_COL_DISCOUNT) ? INVOICE2_COL_DISCOUNT : null;
  }
  if (isInvoiceTable3Type(tableType)) {
    return isInvoice3ColumnVisible(columns, INVOICE3_COL_DISCOUNT) ? INVOICE3_COL_DISCOUNT : null;
  }
  return null;
}

export function tableHasProductColumn(
  columns: Array<{ columnType?: string; visible?: boolean }>
): boolean {
  return columns.some((col) => col.visible !== false && col.columnType === 'product');
}

export function resolveTableRateColumnId(
  tableType: string,
  columns: ProductTableColumn[],
  sampleCells?: Record<string, string>
): string | null {
  if (isInvoiceTable2Type(tableType)) {
    return resolveInvoice2RateColumnId(columns, sampleCells);
  }
  if (isInvoiceTable1Type(tableType)) {
    return columns.some((col) => col.id === INVOICE_COL_RATE)
      ? INVOICE_COL_RATE
      : resolveProductRateColumnId(columns, sampleCells);
  }
  if (isInvoiceTable3Type(tableType)) {
    return columns.some((col) => col.id === INVOICE3_COL_RATE)
      ? INVOICE3_COL_RATE
      : resolveProductRateColumnId(columns, sampleCells);
  }
  return resolveProductRateColumnId(columns, sampleCells);
}

/** Apply catalog product pick to product + rate columns and recalculate totals. */
export function applyProductPickToTable(
  tableType: string,
  table: ProductTableProps,
  rowId: string,
  productColumnId: string,
  product: ProductPick,
  showSku: boolean,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): ProductTableProps {
  const row = table.rows.find((item) => item.id === rowId);
  const productValue = formatProductCellValue(product, showSku);
  const rateColId = resolveTableRateColumnId(tableType, table.columns, row?.cells);
  const rateValue = formatProductPrice(product.price);
  const discountColId = resolveTableDiscountColumnId(tableType, table.columns);
  const discountMode = resolveTableDiscountMode(table);
  const discountValue = discountColId ? formatProductDiscount(product, discountMode) : null;

  if (isInvoiceTable2Type(tableType)) {
    const edits = [{ rowId, columnId: productColumnId, value: productValue }];
    if (rateColId && rateValue) {
      edits.push({ rowId, columnId: rateColId, value: rateValue });
    }
    if (discountColId && discountValue != null) {
      edits.push({ rowId, columnId: discountColId, value: discountValue });
    }
    return applyInvoice2CellEdits(table as InvoiceTable2Props, edits, tax);
  }

  if (isInvoiceTable1Type(tableType)) {
    let next = updateInvoiceCell(
      table as InvoiceTableProps,
      rowId,
      productColumnId,
      productValue,
      tax
    );
    if (rateColId && rateValue) {
      next = updateInvoiceCell(next, rowId, rateColId, rateValue, tax);
    }
    if (discountColId && discountValue != null) {
      next = updateInvoiceCell(next, rowId, discountColId, discountValue, tax);
    }
    return next;
  }

  if (isInvoiceTable3Type(tableType)) {
    let next = updateInvoice3Cell(
      table as InvoiceTable3Props,
      rowId,
      productColumnId,
      productValue,
      tax
    );
    if (rateColId && rateValue) {
      next = updateInvoice3Cell(next, rowId, rateColId, rateValue, tax);
    }
    if (discountColId && discountValue != null) {
      next = updateInvoice3Cell(next, rowId, discountColId, discountValue, tax);
    }
    return next;
  }

  let next = updateCell(table, rowId, productColumnId, productValue);
  if (rateColId && rateValue) {
    next = updateCell(next, rowId, rateColId, rateValue);
  }
  return recalculateProductTable(next);
}
