import type { CompanyProductOption } from './use-company-products';
import type { ProductTableColumn, ProductTableProps } from './product-table';
import {
  updateCell,
  recalculateProductTable,
  resolveProductRateColumnId,
  resolveProductQtyColumnId,
} from './product-table';
import {
  isInvoiceTable1Type,
  INVOICE_COL_RATE,
  INVOICE_COL_UNITS,
  INVOICE_COL_DISCOUNT,
  updateInvoiceCell,
  recalculateInvoiceTable,
  type InvoiceTableProps,
  type InvoiceDiscountMode,
} from './invoice-table';
import {
  isInvoiceTable2Type,
  resolveInvoice2RateColumnId,
  resolveInvoice2QtyColumnId,
  applyInvoice2CellEdits,
  recalculateInvoiceTable2,
  INVOICE2_COL_DISCOUNT,
  INVOICE2_COL_RATE,
  INVOICE2_COL_QTY,
  type InvoiceTable2Props,
} from './invoice-table-2';
import {
  isInvoiceTable3Type,
  INVOICE3_COL_RATE,
  INVOICE3_COL_QTY,
  INVOICE3_COL_DISCOUNT,
  updateInvoice3Cell,
  recalculateInvoiceTable3,
  type InvoiceTable3Props,
} from './invoice-table-3';
import {
  EMPTY_TAX_SETTINGS,
  PRODUCT_GST_RATE_KEY,
  type TaxSettings,
} from './tax-settings';

export type ProductPick = Pick<
  CompanyProductOption,
  'name' | 'sku' | 'price' | 'discount' | 'discountType' | 'gst' | 'tax'
>;

export { PRODUCT_GST_RATE_KEY } from './tax-settings';

export function resolveProductGstRate(
  product: Pick<ProductPick, 'gst' | 'tax'> | { gst?: unknown; tax?: unknown }
): number | null {
  const candidates = [product.gst, product.tax];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }
  return null;
}

function stampProductGstRate(
  table: ProductTableProps,
  rowId: string,
  productGst: number | null
): ProductTableProps {
  if (productGst == null) return table;
  const targetId = String(rowId);
  return {
    ...table,
    rows: table.rows.map((item) =>
      String(item.id) === targetId
        ? {
            ...item,
            cells: {
              ...item.cells,
              [PRODUCT_GST_RATE_KEY]: String(productGst),
            },
          }
        : item
    ),
  };
}

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
    // Prefer converting fixed→%; if price missing, still surface the catalog amount.
    if (!price) return String(value);
    const percent = Math.round((value / price) * 100 * 100) / 100;
    return Number.isInteger(percent) ? String(percent) : percent.toFixed(2);
  }

  if (catalogType === 'fixed') {
    const amount = Math.round(value * 100) / 100;
    return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  }

  const price = product.price ?? 0;
  // Prefer converting %→amount; if price missing, still write the catalog % value.
  if (!price) return String(value);
  const amount = Math.round((price * value) / 100 * 100) / 100;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

export function resolveTableDiscountColumnId(
  tableType: string,
  _columns: ProductTableColumn[]
): string | null {
  // Always target the standard discount column for invoice tables (same idea as rate
  // fallbacks). Visibility checks previously skipped writing catalog / discount-rule
  // values when the column was missing from incomplete props or hidden in the template.
  if (isInvoiceTable1Type(tableType)) {
    return INVOICE_COL_DISCOUNT;
  }
  if (isInvoiceTable2Type(tableType)) {
    return INVOICE2_COL_DISCOUNT;
  }
  if (isInvoiceTable3Type(tableType)) {
    return INVOICE3_COL_DISCOUNT;
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
    return (
      resolveInvoice2RateColumnId(columns, sampleCells)
      ?? INVOICE2_COL_RATE
    );
  }
  if (isInvoiceTable1Type(tableType)) {
    return columns.some((col) => col.id === INVOICE_COL_RATE)
      ? INVOICE_COL_RATE
      : resolveProductRateColumnId(columns, sampleCells) ?? INVOICE_COL_RATE;
  }
  if (isInvoiceTable3Type(tableType)) {
    return columns.some((col) => col.id === INVOICE3_COL_RATE)
      ? INVOICE3_COL_RATE
      : resolveProductRateColumnId(columns, sampleCells) ?? INVOICE3_COL_RATE;
  }
  return resolveProductRateColumnId(columns, sampleCells);
}

function resolveTableQtyColumnId(
  tableType: string,
  columns: ProductTableColumn[],
  sampleCells?: Record<string, string>
): string | null {
  if (isInvoiceTable2Type(tableType)) {
    return resolveInvoice2QtyColumnId(columns, sampleCells) ?? INVOICE2_COL_QTY;
  }
  if (isInvoiceTable1Type(tableType)) {
    return columns.some((col) => col.id === INVOICE_COL_UNITS)
      ? INVOICE_COL_UNITS
      : resolveProductQtyColumnId(columns, sampleCells) ?? INVOICE_COL_UNITS;
  }
  if (isInvoiceTable3Type(tableType)) {
    return columns.some((col) => col.id === INVOICE3_COL_QTY)
      ? INVOICE3_COL_QTY
      : resolveProductQtyColumnId(columns, sampleCells) ?? INVOICE3_COL_QTY;
  }
  return resolveProductQtyColumnId(columns, sampleCells);
}

/**
 * Apply catalog product pick to product + rate columns and recalculate totals.
 * Pick/replace behavior matches the original path; product GST is stamped afterward.
 */
export function applyProductPickToTable(
  tableType: string,
  table: ProductTableProps,
  rowId: string,
  productColumnId: string,
  product: ProductPick,
  showSku: boolean,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): ProductTableProps {
  const targetId = String(rowId);
  const row = table.rows.find((item) => String(item.id) === targetId) ?? null;
  if (!row) return table;

  const resolvedRowId = String(row.id);
  const productValue = formatProductCellValue(product, showSku);
  const rateColId = resolveTableRateColumnId(tableType, table.columns, row.cells);
  const rateValue = formatProductPrice(product.price);
  const qtyColId = resolveTableQtyColumnId(tableType, table.columns, row.cells);
  const needsDefaultQty = Boolean(qtyColId && !String(row.cells[qtyColId] ?? '').trim());
  const discountColId = resolveTableDiscountColumnId(tableType, table.columns);
  const discountMode = resolveTableDiscountMode(table);
  const discountValue = discountColId ? formatProductDiscount(product, discountMode) : null;

  let next: ProductTableProps;

  if (isInvoiceTable2Type(tableType)) {
    const edits = [{ rowId: resolvedRowId, columnId: productColumnId, value: productValue }];
    if (needsDefaultQty && qtyColId) {
      edits.push({ rowId: resolvedRowId, columnId: qtyColId, value: '1' });
    }
    if (rateColId && rateValue) {
      edits.push({ rowId: resolvedRowId, columnId: rateColId, value: rateValue });
      if (rateColId !== INVOICE2_COL_RATE) {
        edits.push({ rowId: resolvedRowId, columnId: INVOICE2_COL_RATE, value: rateValue });
      }
    }
    if (discountColId && discountValue != null) {
      edits.push({ rowId: resolvedRowId, columnId: discountColId, value: discountValue });
    }
    next = applyInvoice2CellEdits(table as InvoiceTable2Props, edits, tax);
  } else if (isInvoiceTable1Type(tableType)) {
    let updated = updateInvoiceCell(
      table as InvoiceTableProps,
      resolvedRowId,
      productColumnId,
      productValue,
      tax
    );
    if (needsDefaultQty && qtyColId) {
      updated = updateInvoiceCell(updated, resolvedRowId, qtyColId, '1', tax);
    }
    if (rateColId && rateValue) {
      updated = updateInvoiceCell(updated, resolvedRowId, rateColId, rateValue, tax);
      if (rateColId !== INVOICE_COL_RATE) {
        updated = updateInvoiceCell(updated, resolvedRowId, INVOICE_COL_RATE, rateValue, tax);
      }
    }
    if (discountColId && discountValue != null) {
      updated = updateInvoiceCell(updated, resolvedRowId, discountColId, discountValue, tax);
    }
    next = updated;
  } else if (isInvoiceTable3Type(tableType)) {
    let updated = updateInvoice3Cell(
      table as InvoiceTable3Props,
      resolvedRowId,
      productColumnId,
      productValue,
      tax
    );
    if (needsDefaultQty && qtyColId) {
      updated = updateInvoice3Cell(updated, resolvedRowId, qtyColId, '1', tax);
    }
    if (rateColId && rateValue) {
      updated = updateInvoice3Cell(updated, resolvedRowId, rateColId, rateValue, tax);
      if (rateColId !== INVOICE3_COL_RATE) {
        updated = updateInvoice3Cell(updated, resolvedRowId, INVOICE3_COL_RATE, rateValue, tax);
      }
    }
    if (discountColId && discountValue != null) {
      updated = updateInvoice3Cell(updated, resolvedRowId, discountColId, discountValue, tax);
    }
    next = updated;
  } else {
    let updated = updateCell(table, resolvedRowId, productColumnId, productValue);
    if (needsDefaultQty && qtyColId) {
      updated = updateCell(updated, resolvedRowId, qtyColId, '1');
    }
    if (rateColId && rateValue) {
      updated = updateCell(updated, resolvedRowId, rateColId, rateValue);
    }
    next = recalculateProductTable(updated);
  }

  const productGst = resolveProductGstRate(product);
  if (productGst == null) return next;

  const stamped = stampProductGstRate(next, resolvedRowId, productGst);
  if (isInvoiceTable1Type(tableType)) {
    return recalculateInvoiceTable(stamped as InvoiceTableProps, tax);
  }
  if (isInvoiceTable2Type(tableType)) {
    return recalculateInvoiceTable2(stamped as InvoiceTable2Props, tax);
  }
  if (isInvoiceTable3Type(tableType)) {
    return recalculateInvoiceTable3(stamped as InvoiceTable3Props, tax);
  }
  return stamped;
}
