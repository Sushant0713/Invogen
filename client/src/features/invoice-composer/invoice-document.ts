import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { v4 as uuidv4 } from 'uuid';
import { getEditableTextKey, getEditableTextValue } from '@/features/builder/text-styles';
import {
  isTableElementType,
  productTablePropsToRecord,
  updateCell as updateProductCell,
  recalculateProductTable,
  addRow as addProductRow,
  removeRow as removeProductRow,
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
import { updateInvoiceCell, recalculateInvoiceTable, isInvoiceTable1Type, addRow as addInvoice1Row, INVOICE_COL_TAXABLE, INVOICE_COL_CGST, INVOICE_COL_SGST, INVOICE_COL_GST, INVOICE_COL_IGST, INVOICE_COL_TOTAL, INVOICE_COL_DISCOUNT, setInvoiceDiscountMode, type InvoiceTableProps, type InvoiceDiscountMode } from '@/features/builder/invoice-table';
import { updateInvoice2Cell, isInvoice2ComputedColumn, isInvoice2SummaryRowId, isInvoice2ComputedAmountLabel, recalculateInvoiceTable2, computeInvoice2Summary, isInvoiceTable2Type, addRow as addInvoice2Row, INVOICE2_COL_DISCOUNT, setInvoice2DiscountMode, type InvoiceTable2Props } from '@/features/builder/invoice-table-2';
import { updateInvoice3Cell, isInvoice3ComputedColumn, recalculateInvoiceTable3, getInvoice3GrandTotal, calculateInvoice3LineAmounts, isInvoiceTable3Type, addRow as addInvoice3Row, INVOICE3_COL_DISCOUNT, setInvoice3DiscountMode, type InvoiceTable3Props } from '@/features/builder/invoice-table-3';
import { isInvoiceComputedColumn } from '@/features/builder/invoice-table';
import { EMPTY_TAX_SETTINGS, type TaxSettings, getCombinedGstRate, getIgstRate } from '@/features/builder/tax-settings';
import {
  EMPTY_PRODUCT_SETTINGS,
  type ProductSettings,
  resolveShowProductSku,
} from '@/features/builder/product-settings';
import type { PlaceholderContext } from '@/features/template-gallery/placeholder-utils';
import { extractPlaceholderKeys, placeholderFieldLabel } from '@/features/template-gallery/placeholder-utils';
import { getLayerLabel } from '@/features/builder/element-layers';
import { getPageDimensions, getDefaultElementSize } from '@/features/builder/builder-dnd';
import { normalizeDocumentFooters } from '@/features/builder/document-footer';
import { enforceInvoiceDueDateOrderOnPages } from '@/features/builder/invoice-date-order';
import { reflowPagesForPreview } from '@/features/builder/document-layout';
import { fitOverflowingDataFields } from '@/features/builder/fit-preview-data-fields';
import { normalizeBuilderPagesForEditor } from '@/features/builder/preview-page-reflow';
import {
  applyProductPickToTable,
  type ProductPick,
} from '@/features/builder/product-cell';
import { parseTermsFromProps, buildTermsProps, getDefaultTermsProps } from '@/features/builder/terms-content';
import { parseAddressFromProps, buildAddressProps } from '@/features/builder/address-content';
import {
  createCardCustomField,
  getCardFieldDef,
  getCardFieldDefs,
  getCardFieldValue,
  getCardVisibleFieldDefs,
  isCardComponentType,
  parseCardCustomFields,
  parseHiddenCardFields,
  setCustomCardFieldHidden,
  type CardCustomField,
} from '@/features/builder/card-components';

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

/** Drop only trailing blank pages; keep intentional multi-page layouts intact. */
export function normalizeComposerPages(pages: TemplatePage[]): TemplatePage[] {
  const cloned = cloneTemplatePages(pages);
  if (cloned.length <= 1) return cloned;

  let end = cloned.length;
  while (end > 1 && isPageBlank(cloned[end - 1])) {
    end -= 1;
  }
  return cloned.slice(0, end);
}

/**
 * Normalize template JSON the same way the builder does on open (footers, due dates, page tabs)
 * before composer / platform invoice preview editing.
 */
export function hydrateComposerTemplatePages(pages: TemplatePage[]): TemplatePage[] {
  const trimmed = normalizeComposerPages(pages);
  return normalizeBuilderPagesForEditor(
    enforceInvoiceDueDateOrderOnPages(normalizeDocumentFooters(trimmed)).pages
  );
}

/**
 * Word-style reflow + data-field fitting — shared by invoice composer, platform invoice preview, and PDF print.
 * Keeps pagination/reflow; run once then pass to TemplatePreviewPages with autoReflow={false}.
 */
export function prepareInvoiceLivePreviewPages(
  pages: TemplatePage[],
  options: { trustTableProps?: boolean } = {}
): TemplatePage[] {
  if (!pages.length) return [];
  const trustTableProps = options.trustTableProps ?? true;
  const originalElements = pages.flatMap((p) => p.elements);
  const reflowed = reflowPagesForPreview(cloneTemplatePages(pages), { trustTableProps });
  return fitOverflowingDataFields(reflowed, originalElements);
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

/** Normalize table structure (fixed rate/discount cols) but keep existing row ids for form picks. */
function normalizeComposerTableForEdit(
  elementType: string,
  raw: Record<string, unknown>
): ProductTableProps {
  const sourceRows = Array.isArray(raw.rows) ? (raw.rows as Array<{ id?: unknown }>) : [];
  const previousIds = sourceRows.map((row) => {
    const id = row?.id != null ? String(row.id).trim() : '';
    return id;
  });
  const normalized = normalizeTablePropsForType(elementType, raw);
  if (previousIds.length === 0) return normalized;

  // Prefer preserving ids by index. If normalize changes row count, keep surviving ids.
  return {
    ...normalized,
    rows: normalized.rows.map((row, index) => ({
      ...row,
      id: previousIds[index] || String(row.id),
    })),
  };
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
  if (/^(subtotal|cgst|sgst|igst|gst|total|final|amount|tax)$/.test(nameToken)) return true;
  for (const value of Object.values(row.cells ?? {})) {
    const token = normalizeSummaryToken(String(value));
    if (/^(subtotal|cgst|sgst|igst|gst|total|final)$/.test(token)) return true;
  }
  return false;
}

function getComposerSummaryRowKind(
  row: Pick<ProductTableRow, 'name' | 'cells'>,
  columns: ProductTableProps['columns']
): 'subtotal' | 'cgst' | 'sgst' | 'igst' | 'gst' | 'total' | null {
  const tokens = [row.name ?? '', ...Object.values(row.cells ?? {})].map((v) =>
    normalizeSummaryToken(String(v))
  );
  for (const token of tokens) {
    if (token.includes('subtotal')) return 'subtotal';
    if (token.includes('cgst')) return 'cgst';
    if (token.includes('sgst')) return 'sgst';
    if (token.includes('igst')) return 'igst';
    if (token === 'gst' || token.startsWith('gst')) return 'gst';
    if (token === 'total' || token === 'final' || token.includes('grandtotal')) return 'total';
  }
  const labelCol = columns.find((col) => /label|discount/i.test(col.label));
  if (labelCol) {
    const labelToken = normalizeSummaryToken(String(row.cells?.[labelCol.id] ?? ''));
    if (labelToken.includes('subtotal')) return 'subtotal';
    if (labelToken.includes('cgst')) return 'cgst';
    if (labelToken.includes('sgst')) return 'sgst';
    if (labelToken.includes('igst')) return 'igst';
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
    else if (kind === 'igst') amount = taxPart.igst;
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
): { tax: number; total: number; cgst: number; sgst: number; gst: number; igst: number } {
  let cgst = 0;
  let sgst = 0;
  let gst = 0;
  let igst = 0;
  if (tax.isEnabled && taxableSubtotal > 0) {
    if (tax.taxDisplayMode === 'combined') {
      gst = Math.round((taxableSubtotal * getCombinedGstRate(tax)) / 100 * 100) / 100;
    } else if (tax.taxDisplayMode === 'igst') {
      igst = Math.round((taxableSubtotal * getIgstRate(tax)) / 100 * 100) / 100;
    } else {
      cgst = Math.round((taxableSubtotal * tax.cgstRate) / 100 * 100) / 100;
      sgst = Math.round((taxableSubtotal * tax.sgstRate) / 100 * 100) / 100;
    }
  }
  const taxAmount = cgst + sgst + gst + igst;
  return {
    tax: taxAmount,
    total: Math.round((taxableSubtotal + taxAmount) * 100) / 100,
    cgst,
    sgst,
    gst,
    igst,
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
  let igst = 0;
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
          const rowCgst = parseComposerAmount(row.cells[INVOICE_COL_CGST]);
          const rowSgst = parseComposerAmount(row.cells[INVOICE_COL_SGST]);
          const rowGst = parseComposerAmount(row.cells[INVOICE_COL_GST]);
          const rowIgst = parseComposerAmount(row.cells[INVOICE_COL_IGST]);
          taxAmount += rowCgst + rowSgst + rowGst + rowIgst;
          cgst += rowCgst;
          sgst += rowSgst;
          gst += rowGst;
          igst += rowIgst;
          total += parseComposerAmount(row.cells[INVOICE_COL_TOTAL]);
        }
      } else if (isInvoiceTable2Type(resolvedType)) {
        const props = recalculateInvoiceTable2(table as InvoiceTable2Props, tax);
        const summary = computeInvoice2Summary(props.rows, tax, props.columns, props);
        found = true;
        subtotal += summary.subtotal;
        taxAmount += summary.cgst + summary.sgst + summary.gst + summary.igst;
        cgst += summary.cgst;
        sgst += summary.sgst;
        gst += summary.gst;
        igst += summary.igst;
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
          taxAmount += line.gst + line.igst;
          total += line.total;
          if (line.igst > 0) {
            igst += line.igst;
          } else if (line.gst > 0) {
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
          igst += taxPart.igst;
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
    IGST: formatComposerAmount(igst),
    GST: formatComposerAmount(gst),
    Total: formatComposerAmount(total),
    Amount: formatComposerAmount(total),
  };
}

function addRowToTableProps(
  type: string,
  props: ProductTableProps,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): ProductTableProps {
  const lines = props.rows.filter((row) => !isComposerSummaryRow(row));
  const base = { ...props, rows: lines };
  if (isInvoiceTable1Type(type)) {
    return addInvoice1Row(base as InvoiceTableProps, tax);
  }
  if (isInvoiceTable2Type(type)) {
    return addInvoice2Row(base as InvoiceTable2Props, tax);
  }
  if (isInvoiceTable3Type(type)) {
    return addInvoice3Row(base as InvoiceTable3Props, tax);
  }
  return recalculateProductTable(addProductRow(base));
}

export function addComposerTableRow(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): TemplatePage[] {
  return updateElementOnPage(pages, pageId, elementId, (element) => {
    if (!isTableElementType(element.type)) return element;
    const raw = (element.props ?? {}) as Record<string, unknown>;
    const resolvedType = resolveTableElementType(element.type, raw);
    const table = normalizeTablePropsForType(element.type, raw);
    if (isSummaryOnlyTable(table)) return element;
    const withRow = addRowToTableProps(resolvedType, table, tax);
    const nextProps = finalizeComposerTableProps(
      element.type,
      productTablePropsToRecord(withRow),
      tax
    );
    return { ...element, props: nextProps };
  });
}

function removeRowFromTableProps(
  type: string,
  props: ProductTableProps,
  rowId: string,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): ProductTableProps {
  const lines = props.rows.filter((row) => !isComposerSummaryRow(row));
  const base = { ...props, rows: lines };
  const removed = removeProductRow(base, rowId);
  if (removed.rows.length === base.rows.length) return base;
  if (isInvoiceTable1Type(type)) {
    return recalculateInvoiceTable(removed as InvoiceTableProps, tax);
  }
  if (isInvoiceTable2Type(type)) {
    return recalculateInvoiceTable2(removed as InvoiceTable2Props, tax);
  }
  if (isInvoiceTable3Type(type)) {
    return recalculateInvoiceTable3(removed as InvoiceTable3Props, tax);
  }
  return recalculateProductTable(removed);
}

export function deleteComposerTableRow(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  rowId: string,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): TemplatePage[] {
  return updateElementOnPage(pages, pageId, elementId, (element) => {
    if (!isTableElementType(element.type)) return element;
    const raw = (element.props ?? {}) as Record<string, unknown>;
    const resolvedType = resolveTableElementType(element.type, raw);
    const table = normalizeTablePropsForType(element.type, raw);
    if (isSummaryOnlyTable(table)) return element;
    const withoutRow = removeRowFromTableProps(resolvedType, table, rowId, tax);
    const nextProps = finalizeComposerTableProps(
      element.type,
      productTablePropsToRecord(withoutRow),
      tax
    );
    return { ...element, props: nextProps };
  });
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

export function updateComposerProductPick(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  rowId: string,
  productColumnId: string,
  product: ProductPick,
  tax: TaxSettings = EMPTY_TAX_SETTINGS,
  productSettings: ProductSettings = EMPTY_PRODUCT_SETTINGS
): TemplatePage[] {
  return updateElementOnPage(pages, pageId, elementId, (element) => {
    if (!isTableElementType(element.type)) return element;
    const raw = (element.props ?? {}) as Record<string, unknown>;
    const resolvedType = resolveTableElementType(element.type, raw);
    // Normalize so Rate + Discount columns exist; keep existing row ids for pick/replace.
    const table = normalizeComposerTableForEdit(element.type, raw);
    const withEdit = applyProductPickToTable(
      resolvedType,
      table,
      rowId,
      productColumnId,
      product,
      resolveShowProductSku(table.showProductSku, productSettings),
      tax
    );
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
  discountMode?: InvoiceDiscountMode;
  supportsDiscountMode: boolean;
  showProductSku?: boolean;
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

export interface ScannedFooter {
  pageId: string;
  pageName: string;
  elementId: string;
  value: string;
  /** 1-based index among footers on the same page. */
  indexOnPage: number;
  /** 1-based index across all footers in the invoice. */
  index: number;
}

export interface ScannedTerms {
  pageId: string;
  pageName: string;
  elementId: string;
  title: string;
  items: string[];
  indexOnPage: number;
  index: number;
}

const COMPOSER_TEXT_FIELD_LABELS: Partial<Record<string, string>> = {
  [ComponentType.FOOTER]: 'Footer',
  [ComponentType.NOTES]: 'Note',
  [ComponentType.HEADING]: 'Heading',
  [ComponentType.TEXT]: 'Text',
  [ComponentType.TERMS]: 'Terms & conditions',
  [ComponentType.ADDRESS]: 'Address',
  [ComponentType.BARCODE]: 'Barcode',
  [ComponentType.CUSTOM_HTML]: 'Custom HTML',
  [ComponentType.PAYMENT_DETAILS]: 'Payment details',
};

function composerTextFieldLabel(element: CanvasElement, indexOnPage: number): string {
  const base = COMPOSER_TEXT_FIELD_LABELS[element.type] ?? getLayerLabel(element);
  if (element.type === ComponentType.FOOTER && indexOnPage > 1) {
    return `Footer ${indexOnPage}`;
  }
  if (indexOnPage > 1 && element.type !== ComponentType.FOOTER) {
    return `${base} ${indexOnPage}`;
  }
  return base;
}

function footerLabel(footer: ScannedFooter, totalFooters: number): string {
  if (totalFooters <= 1 && footer.indexOnPage === 1) return 'Footer';
  return `Footer ${footer.index}`;
}

function termsLabel(terms: ScannedTerms, totalTerms: number): string {
  if (totalTerms <= 1 && terms.indexOnPage === 1) return 'Terms & conditions';
  return `Terms & conditions ${terms.index}`;
}

const COMPOSER_CUSTOMER_KEYS = [
  'ClientName',
  'Email',
  'Phone',
  'GST',
  'Address',
  'State',
] as const;

const CUSTOMER_CARD_FORM_KEYS = new Set(['ClientName', 'Email', 'Phone', 'Address']);

const COMPOSER_COMPANY_KEYS = [
  'CompanyName',
  'CompanyAddress',
  'CompanyEmail',
  'CompanyPhone',
  'CompanyGST',
  'PAN',
  'PlaceOfSupply',
  'StateCode',
] as const;

const COMPANY_CARD_FORM_KEYS = new Set([
  'CompanyName',
  'CompanyAddress',
  'CompanyEmail',
  'CompanyPhone',
  'CompanyGST',
  'PAN',
]);

const COMPOSER_INVOICE_KEYS = ['InvoiceNumber', 'Date', 'DueDate'] as const;

const COMPOSER_TOTAL_KEYS = new Set([
  'Subtotal',
  'Tax',
  'Total',
  'Amount',
  'CGST',
  'SGST',
  'IGST',
  'GST',
]);

const DATA_FIELD_COMPONENTS: Partial<
  Record<string, { key: string; label: string }>
> = {
  [ComponentType.INVOICE_NUMBER]: { key: 'InvoiceNumber', label: 'Invoice number' },
  [ComponentType.DATE]: { key: 'Date', label: 'Invoice date' },
  [ComponentType.DUE_DATE]: { key: 'DueDate', label: 'Due date' },
  [ComponentType.GST_NUMBER]: { key: 'CompanyGST', label: 'GSTIN' },
  [ComponentType.PAN_NUMBER]: { key: 'PAN', label: 'PAN' },
};

export interface ScannedDataField {
  key: string;
  label: string;
  elementType: string;
}

export interface ComposerFormModel {
  tables: ScannedTable[];
  textFields: ScannedTextField[];
  footers: ScannedFooter[];
  terms: ScannedTerms[];
  dataFields: ScannedDataField[];
  cards: ScannedCard[];
  customerFields: string[];
  companyFields: string[];
  invoiceFields: string[];
  otherPlaceholders: string[];
  showCustomerPicker: boolean;
}

export interface ScannedCardField {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  formContextKey?: string;
  valueSource: 'formContext' | 'elementProps';
}

export interface ScannedCard {
  pageId: string;
  elementId: string;
  elementType: string;
  sectionTitle: string;
  fields: ScannedCardField[];
  customFields: CardCustomField[];
  showCustomerPicker: boolean;
}

const CUSTOMER_PROP_TO_CONTEXT: Record<string, string> = {
  name: 'ClientName',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
};

const COMPANY_PROP_TO_CONTEXT: Record<string, string> = {
  name: 'CompanyName',
  address: 'CompanyAddress',
  gst: 'CompanyGST',
  pan: 'PAN',
  email: 'CompanyEmail',
  phone: 'CompanyPhone',
};

function cardSectionTitle(type: string, index: number): string {
  switch (type) {
    case ComponentType.CUSTOMER_CARD:
      return index > 1 ? `Customer ${index}` : 'Customer';
    case ComponentType.COMPANY_CARD:
      return index > 1 ? `Company / supplier ${index}` : 'Company / supplier';
    case ComponentType.PAYMENT_DETAILS:
      return index > 1 ? `Payment details ${index}` : 'Payment details';
    default:
      return 'Card';
  }
}

function extraPlaceholderFields(
  placeholderKeys: string[],
  coveredValues: Set<string>
): ScannedCardField[] {
  return placeholderKeys
    .filter((key) => !coveredValues.has(key))
    .map((key) => ({
      key: `__placeholder_${key}`,
      label: placeholderFieldLabel(key),
      placeholder: placeholderFieldLabel(key),
      multiline: key.toLowerCase().includes('address'),
      formContextKey: key,
      valueSource: 'formContext' as const,
    }));
}

export function scanComposerCards(
  pages: TemplatePage[],
  options?: {
    customerPlaceholderKeys?: string[];
    companyPlaceholderKeys?: string[];
  }
): ScannedCard[] {
  const cards: ScannedCard[] = [];
  const counts: Record<string, number> = {};

  for (const page of pages) {
    for (const element of page.elements) {
      if (element.visible === false || !isCardComponentType(element.type)) continue;

      counts[element.type] = (counts[element.type] ?? 0) + 1;
      const index = counts[element.type];
      const props = (element.props ?? {}) as Record<string, unknown>;
      // Composer form should still show hidden fields so the user can toggle them back on.
      // Actual rendering is controlled by `hiddenFields` in card-components.
      const defs = getCardFieldDefs(element.type);
      const propToContext =
        element.type === ComponentType.CUSTOMER_CARD
          ? CUSTOMER_PROP_TO_CONTEXT
          : element.type === ComponentType.COMPANY_CARD
            ? COMPANY_PROP_TO_CONTEXT
            : {};

      const fields: ScannedCardField[] = defs.map((def) => ({
        key: def.key,
        label: def.label,
        placeholder: def.placeholder,
        multiline: def.multiline,
        formContextKey: propToContext[def.key],
        valueSource: propToContext[def.key] ? 'formContext' : 'elementProps',
      }));

      if (element.type === ComponentType.CUSTOMER_CARD && options?.customerPlaceholderKeys) {
        fields.push(
          ...extraPlaceholderFields(
            options.customerPlaceholderKeys,
            new Set(Object.values(CUSTOMER_PROP_TO_CONTEXT))
          )
        );
      }

      if (element.type === ComponentType.COMPANY_CARD && options?.companyPlaceholderKeys) {
        fields.push(
          ...extraPlaceholderFields(
            options.companyPlaceholderKeys,
            new Set(Object.values(COMPANY_PROP_TO_CONTEXT))
          )
        );
      }

      cards.push({
        pageId: page.id,
        elementId: element.id,
        elementType: element.type,
        sectionTitle: cardSectionTitle(element.type, index),
        fields,
        customFields: parseCardCustomFields(props.customFields),
        showCustomerPicker: element.type === ComponentType.CUSTOMER_CARD && index === 1,
      });
    }
  }

  return cards;
}

function updateCardElementProps(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  updater: (props: Record<string, unknown>) => Record<string, unknown>
): TemplatePage[] {
  return updateElementOnPage(pages, pageId, elementId, (element) => {
    const nextProps = updater((element.props ?? {}) as Record<string, unknown>);
    return { ...element, props: nextProps };
  });
}

export function updateComposerCardProp(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  key: string,
  value: string
): TemplatePage[] {
  return updateCardElementProps(pages, pageId, elementId, (props) => ({
    ...props,
    [key]: value,
  }));
}

export function addComposerCardCustomField(
  pages: TemplatePage[],
  pageId: string,
  elementId: string
): TemplatePage[] {
  return updateCardElementProps(pages, pageId, elementId, (props) => ({
    ...props,
    customFields: [...parseCardCustomFields(props.customFields), createCardCustomField()],
  }));
}

export function updateComposerCardCustomField(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  fieldId: string,
  patch: Partial<Pick<CardCustomField, 'label' | 'value'>>
): TemplatePage[] {
  return updateCardElementProps(pages, pageId, elementId, (props) => ({
    ...props,
    customFields: parseCardCustomFields(props.customFields).map((field) =>
      field.id === fieldId ? { ...field, ...patch } : field
    ),
  }));
}

export function deleteComposerCardCustomField(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  fieldId: string
): TemplatePage[] {
  return updateCardElementProps(pages, pageId, elementId, (props) => ({
    ...props,
    customFields: parseCardCustomFields(props.customFields).filter((field) => field.id !== fieldId),
  }));
}

export function deleteComposerCardStandardField(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  fieldKey: string
): TemplatePage[] {
  return updateCardElementProps(pages, pageId, elementId, (props) => {
    const hidden = new Set(parseHiddenCardFields(props.hiddenFields));
    hidden.add(fieldKey);
    return { ...props, hiddenFields: [...hidden] };
  });
}

export function toggleComposerCardStandardField(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  fieldKey: string,
  hidden: boolean
): TemplatePage[] {
  return updateCardElementProps(pages, pageId, elementId, (props) => {
    const set = new Set(parseHiddenCardFields(props.hiddenFields));
    if (hidden) set.add(fieldKey);
    else set.delete(fieldKey);
    return { ...props, hiddenFields: [...set] };
  });
}

export function toggleComposerCardCustomField(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  fieldId: string,
  hidden: boolean
): TemplatePage[] {
  return updateCardElementProps(pages, pageId, elementId, (props) => ({
    ...props,
    hiddenFields: setCustomCardFieldHidden(
      parseHiddenCardFields(props.hiddenFields),
      fieldId,
      hidden
    ),
  }));
}

export function getComposerCardPropValue(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  key: string,
  placeholder = ''
): string {
  const raw = getComposerCardPropRawValue(pages, pageId, elementId, key);
  if (raw == null) return placeholder;
  return getCardFieldValue({ [key]: raw }, key, placeholder);
}

export function getComposerCardPropRawValue(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  key: string
): string | undefined {
  for (const page of pages) {
    if (page.id !== pageId) continue;
    const element = page.elements.find((item) => item.id === elementId);
    if (!element) return undefined;
    const props = (element.props ?? {}) as Record<string, unknown>;
    const raw = props[key];
    return typeof raw === 'string' ? raw : undefined;
  }
  return undefined;
}

export function getComposerCardFieldPlaceholder(
  elementType: string,
  fieldKey: string,
  fallback = ''
): string {
  if (fieldKey.startsWith('__placeholder_')) {
    const contextKey = fieldKey.replace('__placeholder_', '');
    return placeholderFieldLabel(contextKey);
  }
  return getCardFieldDef(elementType, fieldKey)?.placeholder ?? fallback;
}

function pageHasElementType(pages: TemplatePage[], type: string): boolean {
  return pages.some((page) =>
    page.elements.some((el) => el.visible !== false && el.type === type)
  );
}

/** Discover which left-panel fields match editable content on the template preview. */
export function scanComposerDataFields(pages: TemplatePage[]): ScannedDataField[] {
  const seen = new Set<string>();
  const fields: ScannedDataField[] = [];
  for (const page of pages) {
    for (const element of page.elements) {
      if (element.visible === false) continue;
      if (element.type === ComponentType.FIELD) {
        const props = (element.props ?? {}) as Record<string, unknown>;
        const key = typeof props.dataKey === 'string' ? props.dataKey.trim() : '';
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const label =
          typeof props.label === 'string' && props.label.trim()
            ? props.label.trim()
            : key;
        fields.push({ key, label, elementType: element.type });
        continue;
      }
      const mapped = DATA_FIELD_COMPONENTS[element.type];
      if (!mapped || seen.has(mapped.key)) continue;
      seen.add(mapped.key);
      fields.push({ ...mapped, elementType: element.type });
    }
  }
  return fields;
}

export function buildComposerFormModel(pages: TemplatePage[]): ComposerFormModel {
  const keysInTemplate = new Set(extractPlaceholderKeys(pages));
  const tables = scanComposerTables(pages);
  const textFields = scanComposerTextFields(pages);
  const footers = scanComposerFooters(pages);
  const terms = scanComposerTerms(pages);
  const dataFields = scanComposerDataFields(pages);
  const dataFieldKeys = new Set(dataFields.map((field) => field.key));

  const hasCustomerCard = pageHasElementType(pages, ComponentType.CUSTOMER_CARD);
  const hasCompanyCard = pageHasElementType(pages, ComponentType.COMPANY_CARD);

  const customerFields = COMPOSER_CUSTOMER_KEYS.filter((key) => {
    if (keysInTemplate.has(key) || dataFieldKeys.has(key)) return true;
    return hasCustomerCard && CUSTOMER_CARD_FORM_KEYS.has(key);
  });

  const companyFields = COMPOSER_COMPANY_KEYS.filter((key) => {
    if (keysInTemplate.has(key) || dataFieldKeys.has(key)) return true;
    // Standalone "Company PAN" field uses CompanyPAN; company form still uses PAN.
    if (key === 'PAN' && dataFieldKeys.has('CompanyPAN')) return true;
    return hasCompanyCard && COMPANY_CARD_FORM_KEYS.has(key);
  });

  const isCompanyOrCustomerKey = (key: string) =>
    (COMPOSER_CUSTOMER_KEYS as readonly string[]).includes(key)
    || (COMPOSER_COMPANY_KEYS as readonly string[]).includes(key)
    || key === 'CompanyPAN'
    || key === 'CompanyTitle'
    || key === 'CustomerTitle';

  const isPaymentFieldKey = (key: string) =>
    key.startsWith('Bank') || key === 'PaymentTitle';

  const invoiceFields = [
    ...dataFields
      .map((field) => field.key)
      .filter((key) => !isCompanyOrCustomerKey(key) && !isPaymentFieldKey(key)),
    ...COMPOSER_INVOICE_KEYS.filter(
      (key) => keysInTemplate.has(key) && !dataFieldKeys.has(key)
    ),
  ].filter((key, index, list) => list.indexOf(key) === index);

  const covered = new Set<string>([
    ...COMPOSER_CUSTOMER_KEYS,
    ...COMPOSER_COMPANY_KEYS,
    ...COMPOSER_INVOICE_KEYS,
    ...COMPOSER_TOTAL_KEYS,
    ...invoiceFields,
    ...customerFields,
    ...companyFields,
  ]);
  const otherPlaceholders = [
    ...keysInTemplate,
    ...[...dataFieldKeys].filter((key) => isPaymentFieldKey(key) || key.endsWith('Title')),
  ]
    .filter((key) => !covered.has(key))
    .filter((key, index, list) => list.indexOf(key) === index)
    .sort((a, b) => a.localeCompare(b));

  const cards = scanComposerCards(pages, {
    customerPlaceholderKeys: customerFields,
    companyPlaceholderKeys: companyFields,
  });

  return {
    tables,
    textFields,
    footers,
    terms,
    dataFields,
    cards,
    customerFields,
    companyFields,
    invoiceFields,
    otherPlaceholders,
    showCustomerPicker: customerFields.length > 0,
  };
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

const DISCOUNT_COLUMN_IDS = new Set([
  INVOICE_COL_DISCOUNT,
  INVOICE2_COL_DISCOUNT,
  INVOICE3_COL_DISCOUNT,
]);

function tableSupportsDiscountMode(
  resolvedType: string,
  columns: ProductTableProps['columns']
): boolean {
  if (
    !isInvoiceTable1Type(resolvedType)
    && !isInvoiceTable2Type(resolvedType)
    && !isInvoiceTable3Type(resolvedType)
  ) {
    return false;
  }
  return columns.some(
    (col) => col.visible !== false && DISCOUNT_COLUMN_IDS.has(col.id)
  );
}

function readTableDiscountMode(raw: Record<string, unknown>): InvoiceDiscountMode {
  return raw.discountMode === 'percent' ? 'percent' : 'amount';
}

export function updateComposerTableDiscountMode(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  mode: InvoiceDiscountMode,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): TemplatePage[] {
  return updateElementOnPage(pages, pageId, elementId, (element) => {
    if (!isTableElementType(element.type)) return element;
    const raw = (element.props ?? {}) as Record<string, unknown>;
    const resolvedType = resolveTableElementType(element.type, raw);
    const table = normalizeTablePropsForType(element.type, raw);
    if (!tableSupportsDiscountMode(resolvedType, table.columns)) return element;

    let withMode: ProductTableProps;
    if (isInvoiceTable1Type(resolvedType)) {
      withMode = setInvoiceDiscountMode(table as InvoiceTableProps, mode, tax);
    } else if (isInvoiceTable2Type(resolvedType)) {
      withMode = setInvoice2DiscountMode(table as InvoiceTable2Props, mode, tax);
    } else {
      withMode = setInvoice3DiscountMode(table as InvoiceTable3Props, mode, tax);
    }

    const nextProps = finalizeComposerTableProps(
      element.type,
      productTablePropsToRecord(withMode),
      tax
    );
    return { ...element, props: nextProps };
  });
}

export function scanComposerTables(pages: TemplatePage[]): ScannedTable[] {
  const tables: ScannedTable[] = [];
  pages.forEach((page) => {
    page.elements.forEach((element) => {
      if (element.visible === false || !isTableElementType(element.type)) return;
      const raw = (element.props ?? {}) as Record<string, unknown>;
      const resolvedType = resolveTableElementType(element.type, raw);
      const table = normalizeComposerTableForEdit(element.type, raw);
      if (isSummaryOnlyTable(table)) return;
      const supportsDiscountMode = tableSupportsDiscountMode(resolvedType, table.columns);
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
        discountMode: supportsDiscountMode ? readTableDiscountMode(raw) : undefined,
        supportsDiscountMode,
        showProductSku: table.showProductSku === true,
      });
    });
  });
  return tables;
}

const TEXT_FORM_TYPES = new Set<string>([
  ComponentType.TEXT,
  ComponentType.HEADING,
  ComponentType.NOTES,
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

export function scanComposerFooters(pages: TemplatePage[]): ScannedFooter[] {
  const footers: ScannedFooter[] = [];
  let globalIndex = 0;
  pages.forEach((page) => {
    const pageFooters = page.elements
      .filter((element) => element.visible !== false && element.type === ComponentType.FOOTER)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    pageFooters.forEach((element, pageIndex) => {
      globalIndex += 1;
      const props = (element.props ?? {}) as Record<string, unknown>;
      footers.push({
        pageId: page.id,
        pageName: page.name,
        elementId: element.id,
        value: getEditableTextValue(props, element.type),
        indexOnPage: pageIndex + 1,
        index: globalIndex,
      });
    });
  });
  return footers;
}

export function resolveComposerFooterPageId(pages: TemplatePage[]): string | null {
  if (pages.length === 0) return null;
  const withFooter = pages.find((page) =>
    page.elements.some(
      (element) => element.visible !== false && element.type === ComponentType.FOOTER
    )
  );
  return withFooter?.id ?? pages[pages.length - 1].id;
}

export function addComposerFooter(
  pages: TemplatePage[],
  pageId?: string
): TemplatePage[] {
  const targetPageId = pageId ?? resolveComposerFooterPageId(pages);
  if (!targetPageId) return pages;

  return pages.map((page) => {
    if (page.id !== targetPageId) return page;
    const margins = page.margins ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const { width: pageWidth, height: pageHeight } = getPageDimensions(page);
    const existing = page.elements.filter(
      (element) => element.visible !== false && element.type === ComponentType.FOOTER
    );
    const width = Math.min(520, pageWidth - margins.left - margins.right);
    const height = 36;
    const x = margins.left + Math.max(0, (pageWidth - margins.left - margins.right - width) / 2);
    let y = pageHeight - margins.bottom - height - 20;
    if (existing.length > 0) {
      const last = [...existing].sort((a, b) => b.y + b.height - (a.y + a.height))[0];
      y = last.y + last.height + 10;
    }
    const maxZ = page.elements.reduce((max, element) => Math.max(max, element.zIndex ?? 0), 0);
    const element: CanvasElement = {
      id: uuidv4(),
      type: ComponentType.FOOTER,
      x,
      y,
      width,
      height,
      zIndex: maxZ + 1,
      props: { content: 'Thank you for your business!' },
    };
    return { ...page, elements: [...page.elements, element] };
  });
}

export function deleteComposerFooter(
  pages: TemplatePage[],
  pageId: string,
  elementId: string
): TemplatePage[] {
  return pages.map((page) => {
    if (page.id !== pageId) return page;
    return {
      ...page,
      elements: page.elements.filter((element) => element.id !== elementId),
    };
  });
}

export { footerLabel, termsLabel };

export function scanComposerTerms(pages: TemplatePage[]): ScannedTerms[] {
  const termsBlocks: ScannedTerms[] = [];
  let globalIndex = 0;
  pages.forEach((page) => {
    const pageTerms = page.elements
      .filter((element) => element.visible !== false && element.type === ComponentType.TERMS)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    pageTerms.forEach((element, pageIndex) => {
      globalIndex += 1;
      const props = (element.props ?? {}) as Record<string, unknown>;
      const parsed = parseTermsFromProps(props);
      termsBlocks.push({
        pageId: page.id,
        pageName: page.name,
        elementId: element.id,
        title: parsed.title,
        items: parsed.items.length > 0 ? parsed.items : [''],
        indexOnPage: pageIndex + 1,
        index: globalIndex,
      });
    });
  });
  return termsBlocks;
}

export function resolveComposerTermsPageId(pages: TemplatePage[]): string | null {
  if (pages.length === 0) return null;
  const withTerms = pages.find((page) =>
    page.elements.some(
      (element) => element.visible !== false && element.type === ComponentType.TERMS
    )
  );
  return withTerms?.id ?? pages[pages.length - 1].id;
}

function updateComposerTermsElement(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  updater: (props: Record<string, unknown>) => Record<string, unknown>
): TemplatePage[] {
  return updateElementOnPage(pages, pageId, elementId, (element) => {
    if (element.type !== ComponentType.TERMS) return element;
    const base = (element.props ?? {}) as Record<string, unknown>;
    return { ...element, props: updater(base) };
  });
}

export function updateComposerTermsTitle(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  title: string
): TemplatePage[] {
  return updateComposerTermsElement(pages, pageId, elementId, (base) => {
    const { items } = parseTermsFromProps(base);
    return buildTermsProps(title, items, base);
  });
}

export function updateComposerTermsItem(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  itemIndex: number,
  value: string
): TemplatePage[] {
  return updateComposerTermsElement(pages, pageId, elementId, (base) => {
    const { title, items } = parseTermsFromProps(base);
    const nextItems = items.map((item, index) => (index === itemIndex ? value : item));
    return buildTermsProps(title, nextItems.length > 0 ? nextItems : [''], base);
  });
}

export function addComposerTermsItem(
  pages: TemplatePage[],
  pageId: string,
  elementId: string
): TemplatePage[] {
  return updateComposerTermsElement(pages, pageId, elementId, (base) => {
    const { title, items } = parseTermsFromProps(base);
    return buildTermsProps(title, [...items, ''], base);
  });
}

export function deleteComposerTermsItem(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  itemIndex: number
): TemplatePage[] {
  return updateComposerTermsElement(pages, pageId, elementId, (base) => {
    const { title, items } = parseTermsFromProps(base);
    const nextItems =
      items.length <= 1
        ? ['']
        : items.filter((_, index) => index !== itemIndex);
    return buildTermsProps(title, nextItems, base);
  });
}

export function addComposerTerms(
  pages: TemplatePage[],
  pageId?: string
): TemplatePage[] {
  const targetPageId = pageId ?? resolveComposerTermsPageId(pages);
  if (!targetPageId) return pages;

  return pages.map((page) => {
    if (page.id !== targetPageId) return page;
    const margins = page.margins ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const { width: pageWidth, height: pageHeight } = getPageDimensions(page);
    const existing = page.elements.filter(
      (element) => element.visible !== false && element.type === ComponentType.TERMS
    );
    const { width, height } = getDefaultElementSize(ComponentType.TERMS);
    const x = margins.left + Math.max(0, (pageWidth - margins.left - margins.right - width) / 2);
    let y = pageHeight - margins.bottom - height - 120;
    if (existing.length > 0) {
      const last = [...existing].sort((a, b) => b.y + b.height - (a.y + a.height))[0];
      y = last.y + last.height + 12;
    }
    const maxZ = page.elements.reduce((max, element) => Math.max(max, element.zIndex ?? 0), 0);
    const element: CanvasElement = {
      id: uuidv4(),
      type: ComponentType.TERMS,
      x,
      y,
      width,
      height,
      zIndex: maxZ + 1,
      props: getDefaultTermsProps(),
    };
    return { ...page, elements: [...page.elements, element] };
  });
}

export function deleteComposerTerms(
  pages: TemplatePage[],
  pageId: string,
  elementId: string
): TemplatePage[] {
  return pages.map((page) => {
    if (page.id !== pageId) return page;
    return {
      ...page,
      elements: page.elements.filter((element) => element.id !== elementId),
    };
  });
}

export function scanComposerTextFields(pages: TemplatePage[]): ScannedTextField[] {
  const fields: ScannedTextField[] = [];
  const typeCounts = new Map<string, number>();
  pages.forEach((page) => {
    page.elements.forEach((element) => {
      if (element.visible === false) return;
      if (isTableElementType(element.type)) return;
      if (element.type === ComponentType.FOOTER) return;
      if (element.type === ComponentType.TERMS) return;
      if (SKIP_TEXT_TYPES.has(element.type)) return;
      if (!TEXT_FORM_TYPES.has(element.type)) return;

      const countKey = `${page.id}:${element.type}`;
      const indexOnPage = (typeCounts.get(countKey) ?? 0) + 1;
      typeCounts.set(countKey, indexOnPage);

      const props = (element.props ?? {}) as Record<string, unknown>;
      let value = '';
      let multiline = false;

      if (element.type === ComponentType.ADDRESS) {
        value = formatAddressFromProps(props);
        multiline = true;
      } else if (element.type === ComponentType.BARCODE) {
        value = typeof props.value === 'string' ? props.value : '';
      } else if (getEditableTextKey(element.type)) {
        value = getEditableTextValue(props, element.type);
        multiline = element.type === ComponentType.NOTES
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
        label: composerTextFieldLabel(element, indexOnPage),
        value,
        multiline,
      });
    });
  });
  return fields;
}
