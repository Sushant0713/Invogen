import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { getEditableTextKey, getEditableTextValue } from '@/features/builder/text-styles';
import {
  isTableElementType,
  productTablePropsToRecord,
  updateCell as updateProductCell,
  recalculateProductTable,
  isProductComputedAmountLabel,
  resolveProductAmountColumnIds,
  resolveProductQtyColumnId,
  resolveProductRateColumnId,
  displayColumnLabel,
  type ProductTableProps,
  type ProductTableRow,
} from '@/features/builder/product-table';
import { normalizeTablePropsForType, resolveTableElementType } from '@/features/builder/table-props-normalize';
import { finalizeComposerTableProps, isSummaryOnlyTable, syncSummaryOnlyTable } from '@/features/builder/composer-table-preview';
import { updateInvoiceCell, recalculateInvoiceTable, isInvoiceTable1Type, INVOICE_COL_TAXABLE, INVOICE_COL_CGST, INVOICE_COL_SGST, INVOICE_COL_GST, INVOICE_COL_TOTAL, type InvoiceTableProps } from '@/features/builder/invoice-table';
import { updateInvoice2Cell, isInvoice2ComputedColumn, isInvoice2SummaryRowId, isInvoice2ComputedAmountLabel, recalculateInvoiceTable2, computeInvoice2Summary, isInvoiceTable2Type, type InvoiceTable2Props } from '@/features/builder/invoice-table-2';
import { updateInvoice3Cell, isInvoice3ComputedColumn, recalculateInvoiceTable3, getInvoice3GrandTotal, calculateInvoice3LineAmounts, isInvoiceTable3Type, type InvoiceTable3Props } from '@/features/builder/invoice-table-3';
import { isInvoiceComputedColumn } from '@/features/builder/invoice-table';
import { EMPTY_TAX_SETTINGS, type TaxSettings, getCombinedGstRate } from '@/features/builder/tax-settings';
import type { PlaceholderContext } from '@/features/template-gallery/placeholder-utils';
import { getLayerLabel } from '@/features/builder/element-layers';
import { parseTermsFromProps, buildTermsProps } from '@/features/builder/terms-content';
import { parseAddressFromProps, buildAddressProps } from '@/features/builder/address-content';

export function cloneTemplatePages(pages: TemplatePage[]): TemplatePage[] {
  return structuredClone(pages);
}

function elementHasContent(element: CanvasElement): boolean {
  if (element.visible === false) return false;
  const props = (element.props ?? {}) as Record<string, unknown>;

  if (isTableElementType(element.type)) {
    const table = normalizeTablePropsForType(element.type, props);
    return table.rows.some((row) =>
      table.columns.some((col) => {
        if (col.visible === false) return false;
        const cell = row.cells[col.id] ?? '';
        return String(cell).trim().length > 0;
      })
    );
  }

  const textKey = getEditableTextKey(element.type);
  if (textKey) {
    const value = getEditableTextValue(props, element.type);
    if (value.trim()) return true;
    if (element.type === ComponentType.ADDRESS) {
      return formatAddressFromProps(props).trim().length > 0;
    }
    if (element.type === ComponentType.TERMS) {
      return parseTermsFromProps(props).items.some((item) => item.trim());
    }
  }

  if (element.type === ComponentType.BARCODE) {
    return typeof props.value === 'string' && props.value.trim().length > 0;
  }

  if (element.type === ComponentType.IMAGE || element.type === ComponentType.LOGO
    || element.type === ComponentType.SIGNATURE || element.type === ComponentType.STAMP) {
    return !!(props.src || props.url);
  }

  if (element.type === ComponentType.QR_CODE) {
    return !!(props.value || props.qrData);
  }

  // Shapes, dividers, cards with defaults still count as content on a page
  if (
    element.type === ComponentType.DIVIDER
    || element.type.includes('rectangle')
    || element.type.includes('circle')
    || element.type === ComponentType.LINE
  ) {
    return true;
  }

  return Object.values(props).some((value) => {
    if (typeof value === 'string') return value.trim().length > 0;
    return false;
  });
}

export function isPageBlank(page: TemplatePage): boolean {
  const visible = page.elements.filter((el) => el.visible !== false);
  if (visible.length === 0) return true;
  return !visible.some((el) => elementHasContent(el));
}

/** Drop trailing blank pages when a template ships with an empty extra page. */
export function normalizeComposerPages(pages: TemplatePage[]): TemplatePage[] {
  const cloned = cloneTemplatePages(pages);
  if (cloned.length <= 1) return cloned;
  const nonBlank = cloned.filter((page) => !isPageBlank(page));
  return nonBlank.length > 0 ? nonBlank : cloned.slice(0, 1);
}

export function deleteComposerPage(pages: TemplatePage[], pageId: string): TemplatePage[] {
  if (pages.length <= 1) return pages;
  return pages.filter((page) => page.id !== pageId);
}

function updateElementOnPage(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  updater: (element: CanvasElement) => CanvasElement
): TemplatePage[] {
  return pages.map((page) => {
    if (page.id !== pageId) return page;
    return {
      ...page,
      elements: page.elements.map((element) =>
        element.id === elementId ? updater(element) : element
      ),
    };
  });
}

function updateTableProps(
  type: string,
  props: ProductTableProps,
  rowId: string,
  columnId: string,
  value: string,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): ProductTableProps {
  if (isInvoiceTable1Type(type)) {
    return updateInvoiceCell(props, rowId, columnId, value, tax);
  }
  if (isInvoiceTable2Type(type)) {
    return updateInvoice2Cell(props, rowId, columnId, value, tax);
  }
  if (isInvoiceTable3Type(type)) {
    return updateInvoice3Cell(props, rowId, columnId, value, tax);
  }
  return recalculateProductTable(updateProductCell(props, rowId, columnId, value));
}

function recalculateTableProps(type: string, props: ProductTableProps, tax: TaxSettings): ProductTableProps {
  if (isInvoiceTable1Type(type)) {
    return recalculateInvoiceTable(props as InvoiceTableProps, tax);
  }
  if (isInvoiceTable2Type(type)) {
    return recalculateInvoiceTable2(props as InvoiceTable2Props, tax);
  }
  if (isInvoiceTable3Type(type)) {
    return recalculateInvoiceTable3(props as InvoiceTable3Props, tax);
  }
  return recalculateProductTable(props);
}

function parseComposerAmount(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[,₹\s]/g, '').trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatComposerAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function normalizeSummaryToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Rows that display SUBTOTAL / CGST / FINAL etc. — not editable line items. */
export function isComposerSummaryRow(row: Pick<ProductTableRow, 'id' | 'name' | 'cells'>): boolean {
  if (isInvoice2SummaryRowId(row.id)) return true;
  const nameToken = normalizeSummaryToken(row.name ?? '');
  if (/^(subtotal|cgst|sgst|gst|total|final|amount|tax)$/.test(nameToken)) return true;
  for (const value of Object.values(row.cells ?? {})) {
    const token = normalizeSummaryToken(String(value));
    if (/^(subtotal|cgst|sgst|gst|total|final)$/.test(token)) return true;
  }
  return false;
}

function getComposerSummaryRowKind(
  row: Pick<ProductTableRow, 'name' | 'cells'>,
  columns: ProductTableProps['columns']
): 'subtotal' | 'cgst' | 'sgst' | 'gst' | 'total' | null {
  const tokens = [row.name ?? '', ...Object.values(row.cells ?? {})].map((v) =>
    normalizeSummaryToken(String(v))
  );
  for (const token of tokens) {
    if (token.includes('subtotal')) return 'subtotal';
    if (token.includes('cgst')) return 'cgst';
    if (token.includes('sgst')) return 'sgst';
    if (token === 'gst' || token.startsWith('gst')) return 'gst';
    if (token === 'total' || token === 'final' || token.includes('grandtotal')) return 'total';
  }
  const labelCol = columns.find((col) => /label|discount/i.test(col.label));
  if (labelCol) {
    const labelToken = normalizeSummaryToken(String(row.cells?.[labelCol.id] ?? ''));
    if (labelToken.includes('subtotal')) return 'subtotal';
    if (labelToken.includes('cgst')) return 'cgst';
    if (labelToken.includes('sgst')) return 'sgst';
    if (labelToken === 'gst' || labelToken.startsWith('gst')) return 'gst';
    if (labelToken === 'total' || labelToken === 'final') return 'total';
  }
  return null;
}

function resolveComposerSummaryValueColumn(
  columns: ProductTableProps['columns']
): string | null {
  const amountCols = resolveProductAmountColumnIds(columns);
  if (amountCols.length > 0) return amountCols[0];
  const totalCol = columns.find((col) => /total|amount|value/i.test(col.label));
  if (totalCol) return totalCol.id;
  return columns.length > 0 ? columns[columns.length - 1].id : null;
}

function hasEmbeddedSummaryRows(props: ProductTableProps): boolean {
  return props.rows.some((row) => isComposerSummaryRow(row));
}

/** Keep SUBTOTAL/CGST/SGST rows in product tables aligned with computed line totals. */
function syncEmbeddedSummaryRows(
  props: ProductTableProps,
  tax: TaxSettings
): ProductTableProps {
  if (!hasEmbeddedSummaryRows(props)) return props;

  const lineRows = props.rows.filter((row) => !isComposerSummaryRow(row));
  const summaryRows = props.rows.filter((row) => isComposerSummaryRow(row));
  const valueCol = resolveComposerSummaryValueColumn(props.columns);
  if (!valueCol) return props;

  const subtotal = sumProductTableSubtotal({ ...props, rows: lineRows });
  const taxPart = computeComposerTaxAmount(subtotal, tax);

  const syncedSummaryRows = summaryRows.map((row) => {
    const kind = getComposerSummaryRowKind(row, props.columns);
    if (!kind) return row;
    let amount = 0;
    if (kind === 'subtotal') amount = subtotal;
    else if (kind === 'cgst') amount = taxPart.cgst;
    else if (kind === 'sgst') amount = taxPart.sgst;
    else if (kind === 'gst') amount = taxPart.gst;
    else if (kind === 'total') amount = taxPart.total;
    return {
      ...row,
      cells: { ...row.cells, [valueCol]: formatComposerAmount(amount) },
    };
  });

  return { ...props, rows: [...lineRows, ...syncedSummaryRows] };
}

function sumProductTableSubtotal(props: ProductTableProps): number {
  const lineRows = props.rows.filter((row) => !isComposerSummaryRow(row));
  const amountCols = resolveProductAmountColumnIds(props.columns);
  if (amountCols.length > 0) {
    return lineRows.reduce(
      (sum, row) =>
        sum
        + amountCols.reduce(
          (rowSum, colId) => rowSum + parseComposerAmount(row.cells[colId]),
          0
        ),
      0
    );
  }
  const qtyCol = resolveProductQtyColumnId(props.columns);
  const rateCol = resolveProductRateColumnId(props.columns);
  if (!qtyCol || !rateCol) return 0;
  return lineRows.reduce(
    (sum, row) =>
      sum
      + parseComposerAmount(row.cells[qtyCol]) * parseComposerAmount(row.cells[rateCol]),
    0
  );
}

function computeComposerTaxAmount(
  taxableSubtotal: number,
  tax: TaxSettings
): { tax: number; total: number; cgst: number; sgst: number; gst: number } {
  let cgst = 0;
  let sgst = 0;
  let gst = 0;
  if (tax.isEnabled && taxableSubtotal > 0) {
    if (tax.taxDisplayMode === 'combined') {
      gst = Math.round((taxableSubtotal * getCombinedGstRate(tax)) / 100 * 100) / 100;
    } else {
      cgst = Math.round((taxableSubtotal * tax.cgstRate) / 100 * 100) / 100;
      sgst = Math.round((taxableSubtotal * tax.sgstRate) / 100 * 100) / 100;
    }
  }
  const taxAmount = cgst + sgst + gst;
  return {
    tax: taxAmount,
    total: Math.round((taxableSubtotal + taxAmount) * 100) / 100,
    cgst,
    sgst,
    gst,
  };
}

/** Re-run invoice table math for every table on every page (live preview + form). */
export function recalculatePagesTables(
  pages: TemplatePage[],
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): TemplatePage[] {
  const withLineTables = pages.map((page) => ({
    ...page,
    elements: page.elements.map((element) => {
      if (element.visible === false || !isTableElementType(element.type)) return element;
      const raw = (element.props ?? {}) as Record<string, unknown>;
      const table = raw as unknown as ProductTableProps;
      if (isSummaryOnlyTable(table)) return element;
      return {
        ...element,
        props: finalizeComposerTableProps(element.type, raw, tax),
      };
    }),
  }));

  const totals = extractTablePlaceholderTotals(withLineTables, tax);

  return withLineTables.map((page) => ({
    ...page,
    elements: page.elements.map((element) => {
      if (element.visible === false || !isTableElementType(element.type)) return element;
      const raw = (element.props ?? {}) as Record<string, unknown>;
      const table = raw as unknown as ProductTableProps;
      if (!isSummaryOnlyTable(table)) return element;
      return {
        ...element,
        props: syncSummaryOnlyTable(table, totals),
      };
    }),
  }));
}

/** Pull subtotal / tax / total from invoice tables into {{Placeholder}} fields. */
export function extractTablePlaceholderTotals(
  pages: TemplatePage[],
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): PlaceholderContext {
  let subtotal = 0;
  let taxAmount = 0;
  let total = 0;
  let cgst = 0;
  let sgst = 0;
  let gst = 0;
  let found = false;

  for (const page of pages) {
    for (const element of page.elements) {
      if (element.visible === false || !isTableElementType(element.type)) continue;
      const raw = (element.props ?? {}) as Record<string, unknown>;
      const resolvedType = resolveTableElementType(element.type, raw);
      const table = normalizeTablePropsForType(element.type, raw);
      if (isSummaryOnlyTable(table)) continue;

      if (isInvoiceTable1Type(resolvedType)) {
        const props = recalculateInvoiceTable(table as InvoiceTableProps, tax);
        found = true;
        for (const row of props.rows) {
          subtotal += parseComposerAmount(row.cells[INVOICE_COL_TAXABLE]);
          taxAmount +=
            parseComposerAmount(row.cells[INVOICE_COL_CGST])
            + parseComposerAmount(row.cells[INVOICE_COL_SGST])
            + parseComposerAmount(row.cells[INVOICE_COL_GST]);
          total += parseComposerAmount(row.cells[INVOICE_COL_TOTAL]);
        }
      } else if (isInvoiceTable2Type(resolvedType)) {
        const props = recalculateInvoiceTable2(table as InvoiceTable2Props, tax);
        const summary = computeInvoice2Summary(props.rows, tax, props.columns, props);
        found = true;
        subtotal += summary.subtotal;
        taxAmount += summary.cgst + summary.sgst + summary.gst;
        cgst += summary.cgst;
        sgst += summary.sgst;
        gst += summary.gst;
        total += summary.total;
      } else if (isInvoiceTable3Type(resolvedType)) {
        const props = recalculateInvoiceTable3(table as InvoiceTable3Props, tax);
        found = true;
        for (const row of props.rows) {
          const line = calculateInvoice3LineAmounts(
            row.cells,
            tax,
            props.columns,
            props.discountMode ?? 'amount'
          );
          subtotal += line.taxable;
          taxAmount += line.gst;
          total += line.total;
          if (line.gst > 0) {
            if (tax.taxDisplayMode === 'split') {
              const half = Math.round((line.gst / 2) * 100) / 100;
              cgst += half;
              sgst += line.gst - half;
            } else {
              gst += line.gst;
            }
          }
        }
      } else {
        const tableSubtotal = sumProductTableSubtotal(table);
        if (tableSubtotal > 0) {
          found = true;
          const taxPart = computeComposerTaxAmount(tableSubtotal, tax);
          subtotal += tableSubtotal;
          taxAmount += taxPart.tax;
          cgst += taxPart.cgst;
          sgst += taxPart.sgst;
          gst += taxPart.gst;
          total += taxPart.total;
        }
      }
    }
  }

  if (!found) return {};

  return {
    Subtotal: formatComposerAmount(subtotal),
    Tax: formatComposerAmount(taxAmount),
    CGST: formatComposerAmount(cgst),
    SGST: formatComposerAmount(sgst),
    GST: formatComposerAmount(gst),
    Total: formatComposerAmount(total),
    Amount: formatComposerAmount(total),
  };
}

export function updateComposerTableCell(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  rowId: string,
  columnId: string,
  value: string,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): TemplatePage[] {
  return updateElementOnPage(pages, pageId, elementId, (element) => {
    if (!isTableElementType(element.type)) return element;
    const raw = (element.props ?? {}) as Record<string, unknown>;
    const resolvedType = resolveTableElementType(element.type, raw);
    const table = normalizeTablePropsForType(element.type, raw);
    const withEdit = updateTableProps(resolvedType, table, rowId, columnId, value, tax);
    const nextProps = finalizeComposerTableProps(
      element.type,
      productTablePropsToRecord(withEdit),
      tax
    );
    return { ...element, props: nextProps };
  });
}

export function updateComposerElementProps(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  propsPatch: Record<string, unknown>
): TemplatePage[] {
  return updateElementOnPage(pages, pageId, elementId, (element) => ({
    ...element,
    props: { ...(element.props ?? {}), ...propsPatch },
  }));
}

export function updateComposerTextContent(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  value: string,
  elementType: string
): TemplatePage[] {
  return updateElementOnPage(pages, pageId, elementId, (element) => {
    const base = (element.props ?? {}) as Record<string, unknown>;
    if (elementType === ComponentType.TERMS) {
      const { title } = parseTermsFromProps(base);
      const items = value.split('\n').map((line) => line.trim()).filter(Boolean);
      return { ...element, props: buildTermsProps(title, items.length ? items : [''], base) };
    }
    if (elementType === ComponentType.ADDRESS) {
      const parsed = parseAddressFromProps(base);
      const lines = value.split('\n');
      return {
        ...element,
        props: buildAddressProps(
          { ...parsed, lines: lines.length ? lines : [''] },
          base
        ),
      };
    }
    const key = getEditableTextKey(elementType);
    if (key === 'content') return { ...element, props: { ...base, content: value } };
    if (key === 'text') return { ...element, props: { ...base, text: value } };
    if (key === 'label') return { ...element, props: { ...base, value } };
    return { ...element, props: { ...base, content: value } };
  });
}

function formatAddressFromProps(props: Record<string, unknown>): string {
  return parseAddressFromProps(props).lines.join('\n');
}

export interface ScannedTable {
  pageId: string;
  pageName: string;
  elementId: string;
  /** Resolved table kind (invoice_table, invoice_table_2, product_table, etc.). */
  elementType: string;
  label: string;
  tableKind: string;
  columns: Array<{ id: string; label: string; columnType?: string }>;
  rows: Array<{ id: string; name: string; cells: Record<string, string> }>;
}

export interface ScannedTextField {
  pageId: string;
  pageName: string;
  elementId: string;
  elementType: string;
  label: string;
  value: string;
  multiline: boolean;
}

export function isTableCellEditable(
  elementType: string,
  columnId: string,
  rowId: string,
  columnType?: string,
  columnLabel?: string
): boolean {
  if (columnType === 'sr_no') return false;
  if (isInvoiceTable1Type(elementType) && isInvoiceComputedColumn(columnId)) return false;
  if (isInvoiceTable2Type(elementType)) {
    if (isInvoice2SummaryRowId(rowId)) return false;
    if (isInvoice2ComputedColumn(columnId, rowId)) return false;
    if (columnLabel && isInvoice2ComputedAmountLabel(columnLabel)) return false;
  }
  if (
    (elementType === 'product_table' || elementType === 'table')
    && columnLabel
    && isProductComputedAmountLabel(columnLabel)
  ) {
    return false;
  }
  if (isInvoiceTable3Type(elementType) && isInvoice3ComputedColumn(columnId)) return false;
  return true;
}

export function isTableCellEditableForRow(
  elementType: string,
  columnId: string,
  row: Pick<ProductTableRow, 'id' | 'name' | 'cells'>,
  columnType?: string,
  columnLabel?: string
): boolean {
  if (isComposerSummaryRow(row)) return false;
  return isTableCellEditable(elementType, columnId, row.id, columnType, columnLabel);
}

function composerTableTypeLabel(resolvedType: string): string {
  if (isInvoiceTable1Type(resolvedType)) return 'Invoice table';
  if (isInvoiceTable2Type(resolvedType)) return 'Invoice table (summary block)';
  if (isInvoiceTable3Type(resolvedType)) return 'Invoice table (compact)';
  return 'Product table';
}

export function scanComposerTables(pages: TemplatePage[]): ScannedTable[] {
  const tables: ScannedTable[] = [];
  pages.forEach((page) => {
    page.elements.forEach((element) => {
      if (element.visible === false || !isTableElementType(element.type)) return;
      const raw = (element.props ?? {}) as Record<string, unknown>;
      const resolvedType = resolveTableElementType(element.type, raw);
      const table = normalizeTablePropsForType(element.type, raw);
      if (isSummaryOnlyTable(table)) return;
      tables.push({
        pageId: page.id,
        pageName: page.name,
        elementId: element.id,
        elementType: resolvedType,
        label: getLayerLabel(element),
        tableKind: composerTableTypeLabel(resolvedType),
        columns: table.columns
          .filter((col) => col.visible !== false)
          .map((col) => ({
            id: col.id,
            label: displayColumnLabel(col),
            columnType: col.columnType,
          })),
        rows: table.rows
          .filter((row) => !isComposerSummaryRow(row))
          .map((row) => ({
            id: row.id,
            name: row.name,
            cells: { ...row.cells },
          })),
      });
    });
  });
  return tables;
}

const TEXT_FORM_TYPES = new Set<string>([
  ComponentType.TEXT,
  ComponentType.HEADING,
  ComponentType.FOOTER,
  ComponentType.NOTES,
  ComponentType.TERMS,
  ComponentType.ADDRESS,
  ComponentType.BARCODE,
  ComponentType.CUSTOM_HTML,
  ComponentType.PAYMENT_DETAILS,
]);

const SKIP_TEXT_TYPES = new Set<string>([
  ComponentType.INVOICE_NUMBER,
  ComponentType.DATE,
  ComponentType.DUE_DATE,
  ComponentType.GST_NUMBER,
  ComponentType.PAN_NUMBER,
]);

export function scanComposerTextFields(pages: TemplatePage[]): ScannedTextField[] {
  const fields: ScannedTextField[] = [];
  pages.forEach((page) => {
    page.elements.forEach((element) => {
      if (element.visible === false) return;
      if (isTableElementType(element.type)) return;
      if (SKIP_TEXT_TYPES.has(element.type)) return;
      if (!TEXT_FORM_TYPES.has(element.type)) return;

      const props = (element.props ?? {}) as Record<string, unknown>;
      let value = '';
      let multiline = false;

      if (element.type === ComponentType.TERMS) {
        value = parseTermsFromProps(props).items.join('\n');
        multiline = true;
      } else if (element.type === ComponentType.ADDRESS) {
        value = formatAddressFromProps(props);
        multiline = true;
      } else if (element.type === ComponentType.BARCODE) {
        value = typeof props.value === 'string' ? props.value : '';
      } else if (getEditableTextKey(element.type)) {
        value = getEditableTextValue(props, element.type);
        multiline = element.type === ComponentType.NOTES
          || element.type === ComponentType.TERMS
          || element.type === ComponentType.ADDRESS
          || element.type === ComponentType.PAYMENT_DETAILS
          || (element.type === ComponentType.TEXT && value.includes('\n'));
      } else if (element.type === ComponentType.CUSTOM_HTML) {
        value = typeof props.html === 'string' ? props.html : '';
        multiline = true;
      }

      fields.push({
        pageId: page.id,
        pageName: page.name,
        elementId: element.id,
        elementType: element.type,
        label: getLayerLabel(element),
        value,
        multiline,
      });
    });
  });
  return fields;
}
