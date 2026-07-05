import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { getEditableTextKey, getEditableTextValue } from '@/features/builder/text-styles';
import {
  isTableElementType,
  productTablePropsToRecord,
  type ProductTableProps,
} from '@/features/builder/product-table';
import { normalizeTablePropsForType } from '@/features/builder/table-props-normalize';
import { updateInvoiceCell } from '@/features/builder/invoice-table';
import { updateInvoice2Cell, isInvoice2ComputedColumn, isInvoice2SummaryRowId } from '@/features/builder/invoice-table-2';
import { updateInvoice3Cell, isInvoice3ComputedColumn } from '@/features/builder/invoice-table-3';
import { updateCell as updateProductCell } from '@/features/builder/product-table';
import { isInvoiceComputedColumn } from '@/features/builder/invoice-table';
import { isInvoiceTable1Type } from '@/features/builder/invoice-table';
import { isInvoiceTable2Type } from '@/features/builder/invoice-table-2';
import { isInvoiceTable3Type } from '@/features/builder/invoice-table-3';
import { displayColumnLabel } from '@/features/builder/product-table';
import { EMPTY_TAX_SETTINGS } from '@/features/builder/tax-settings';
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
  value: string
): ProductTableProps {
  if (isInvoiceTable1Type(type)) {
    return updateInvoiceCell(props, rowId, columnId, value, EMPTY_TAX_SETTINGS);
  }
  if (isInvoiceTable2Type(type)) {
    return updateInvoice2Cell(props, rowId, columnId, value, EMPTY_TAX_SETTINGS);
  }
  if (isInvoiceTable3Type(type)) {
    return updateInvoice3Cell(props, rowId, columnId, value, EMPTY_TAX_SETTINGS);
  }
  return updateProductCell(props, rowId, columnId, value);
}

export function updateComposerTableCell(
  pages: TemplatePage[],
  pageId: string,
  elementId: string,
  rowId: string,
  columnId: string,
  value: string
): TemplatePage[] {
  return updateElementOnPage(pages, pageId, elementId, (element) => {
    if (!isTableElementType(element.type)) return element;
    const raw = (element.props ?? {}) as Record<string, unknown>;
    const table = normalizeTablePropsForType(element.type, raw);
    const next = updateTableProps(element.type, table, rowId, columnId, value);
    return { ...element, props: productTablePropsToRecord(next) };
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
  elementType: string;
  label: string;
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
  columnType?: string
): boolean {
  if (columnType === 'sr_no') return false;
  if (isInvoiceTable1Type(elementType) && isInvoiceComputedColumn(columnId)) return false;
  if (isInvoiceTable2Type(elementType)) {
    if (isInvoice2SummaryRowId(rowId)) return false;
    if (isInvoice2ComputedColumn(columnId, rowId)) return false;
  }
  if (isInvoiceTable3Type(elementType) && isInvoice3ComputedColumn(columnId)) return false;
  return true;
}

export function scanComposerTables(pages: TemplatePage[]): ScannedTable[] {
  const tables: ScannedTable[] = [];
  pages.forEach((page) => {
    page.elements.forEach((element) => {
      if (element.visible === false || !isTableElementType(element.type)) return;
      const table = normalizeTablePropsForType(
        element.type,
        (element.props ?? {}) as Record<string, unknown>
      );
      tables.push({
        pageId: page.id,
        pageName: page.name,
        elementId: element.id,
        elementType: element.type,
        label: getLayerLabel(element),
        columns: table.columns
          .filter((col) => col.visible !== false)
          .map((col) => ({
            id: col.id,
            label: displayColumnLabel(col),
            columnType: col.columnType,
          })),
        rows: table.rows.map((row) => ({
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
