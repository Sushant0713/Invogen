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
  updateInvoiceCell,
  type InvoiceTableProps,
} from './invoice-table';
import {
  isInvoiceTable2Type,
  resolveInvoice2RateColumnId,
  applyInvoice2CellEdits,
  type InvoiceTable2Props,
} from './invoice-table-2';
import {
  isInvoiceTable3Type,
  INVOICE3_COL_RATE,
  updateInvoice3Cell,
  type InvoiceTable3Props,
} from './invoice-table-3';
import { EMPTY_TAX_SETTINGS, type TaxSettings } from './tax-settings';

export type ProductPick = Pick<CompanyProductOption, 'name' | 'sku' | 'price'>;

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

  if (isInvoiceTable2Type(tableType)) {
    const edits = [{ rowId, columnId: productColumnId, value: productValue }];
    if (rateColId && rateValue) {
      edits.push({ rowId, columnId: rateColId, value: rateValue });
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
    return next;
  }

  let next = updateCell(table, rowId, productColumnId, productValue);
  if (rateColId && rateValue) {
    next = updateCell(next, rowId, rateColId, rateValue);
  }
  return recalculateProductTable(next);
}
