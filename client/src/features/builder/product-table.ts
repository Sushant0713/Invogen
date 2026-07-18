import { v4 as uuidv4 } from 'uuid';
import { normalizeShowProductSku } from './product-settings';
import { countWrappedLines, measureTextWidth, type MeasureFont } from './text-measure';

export type TableTextAlign = 'left' | 'center' | 'right' | 'justify';

export interface TableCellStyle {
  textAlign?: TableTextAlign;
  fontWeight?: number;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
}

/** Column behavior on the canvas. Default is `na` (plain text). */
export type TableColumnType = 'na' | 'sr_no' | 'product';

export const TABLE_COLUMN_TYPES: TableColumnType[] = ['na', 'sr_no', 'product'];

export const TABLE_COLUMN_TYPE_LABELS: Record<TableColumnType, string> = {
  na: 'NA',
  sr_no: 'Sr.No.',
  product: 'Product',
};

export interface ProductTableColumn {
  id: string;
  label: string;
  widthPx: number;
  /** When false, column is hidden in the table and excluded from invoice calculations. */
  visible?: boolean;
  /** Cell behavior: plain text, auto serial number, or product picker. */
  columnType?: TableColumnType;
}

export interface ProductTableRow {
  id: string;
  name: string;
  cells: Record<string, string>;
  heightPx: number;
}

export interface ProductTableProps {
  columns: ProductTableColumn[];
  rows: ProductTableRow[];
  showHeader: boolean;
  headerHeightPx: number;
  tableColor: string;
  borderOpacity: number;
  borderWidth: number;
  headerStyles?: Record<string, TableCellStyle>;
  cellStyles?: Record<string, TableCellStyle>;
  showGrandTotalFooter?: boolean;
  grandTotalFooterHeightPx?: number;
  /** When true, picked products show as "Name (SKU)" in the product column. */
  showProductSku?: boolean;
}

export const DEFAULT_ROW_HEIGHT_PX = 32;
export const DEFAULT_HEADER_HEIGHT_PX = 32;
export const DEFAULT_TABLE_WIDTH_PX = 500;
export const MIN_COL_WIDTH_PX = 48;
export const MIN_ROW_HEIGHT_PX = 24;
export const DEFAULT_TABLE_COLOR = '#111827';
export const DEFAULT_BORDER_OPACITY = 100;
export const DEFAULT_BORDER_WIDTH_PX = 1;
export const MIN_BORDER_WIDTH_PX = 1;
export const MAX_BORDER_WIDTH_PX = 8;
export const DEFAULT_HEADER_FILL_OPACITY = 12;

export function normalizeColumnType(value: unknown): TableColumnType {
  if (value === 'sr_no' || value === 'product' || value === 'na') return value;
  return 'na';
}

export function getColumnType(col: Pick<ProductTableColumn, 'columnType'>): TableColumnType {
  return normalizeColumnType(col.columnType);
}

export function isSerialColumn(col: Pick<ProductTableColumn, 'columnType'>): boolean {
  return getColumnType(col) === 'sr_no';
}

export function isProductColumn(col: Pick<ProductTableColumn, 'columnType'>): boolean {
  return getColumnType(col) === 'product';
}

/** Product picker + free-text name (catalog or custom) for product/item columns. */
export function isProductLikeColumn(
  col: Pick<ProductTableColumn, 'id' | 'label' | 'columnType'>
): boolean {
  if (isProductColumn(col)) return true;
  if (isSerialColumn(col)) return false;
  const type = getColumnType(col);
  if (type !== 'na' && type !== 'text') return false;
  const token = `${col.id} ${col.label}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  return /\b(item|items|product|products|description|particular|service|name)\b/.test(token);
}

/** Text-heavy columns wrap in preview; numeric/amount columns stay on one line. */
export function isTableWrapFriendlyColumn(
  col: Pick<ProductTableColumn, 'id' | 'label' | 'columnType'>
): boolean {
  if (isSerialColumn(col)) return false;
  if (isProductColumn(col)) return true;

  const token = `${col.id} ${col.label}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  if (
    /\b(qty|quantity|rate|amount|discount|gst|cgst|sgst|igst|tax|total|unit|units|price|mrp|hsn|sac|srno|serial|percent)\b/.test(
      token
    )
  ) {
    return false;
  }
  if (
    /\b(item|items|description|particular|service|product|name|detail|details|remarks|note)\b/.test(
      token
    )
  ) {
    return true;
  }
  return false;
}

/** Default label when a column is first created. NA starts blank so the user names it. */
export function defaultLabelForColumnType(type: TableColumnType, _index?: number): string {
  if (type === 'sr_no') return 'Sr.No.';
  if (type === 'product') return 'Product';
  return '';
}

/** Label shown on the canvas when the stored name is empty. */
export function displayColumnLabel(col: Pick<ProductTableColumn, 'label' | 'columnType'>): string {
  const label = typeof col.label === 'string' ? col.label.trim() : '';
  if (label) return label;
  const type = getColumnType(col);
  if (type === 'sr_no') return 'Sr.No.';
  if (type === 'product') return 'Product';
  return 'Column';
}

export const DEFAULT_PRODUCT_TABLE_PROPS: ProductTableProps = {
  columns: [
    { id: 'col_item', label: 'Item', widthPx: 180, columnType: 'na' },
    { id: 'col_qty', label: 'Qty', widthPx: 80, columnType: 'na' },
    { id: 'col_price', label: 'Price', widthPx: 100, columnType: 'na' },
    { id: 'col_total', label: 'Total', widthPx: 100, columnType: 'na' },
  ],
  rows: [
    {
      id: 'row_1',
      name: 'Row 1',
      heightPx: DEFAULT_ROW_HEIGHT_PX,
      cells: {
        col_item: 'Sample product',
        col_qty: '1',
        col_price: '100',
        col_total: '100',
      },
    },
  ],
  showHeader: true,
  headerHeightPx: DEFAULT_HEADER_HEIGHT_PX,
  tableColor: DEFAULT_TABLE_COLOR,
  borderOpacity: DEFAULT_BORDER_OPACITY,
  borderWidth: DEFAULT_BORDER_WIDTH_PX,
};

function splitEqualWidth(columns: Omit<ProductTableColumn, 'widthPx'>[], totalWidth: number): ProductTableColumn[] {
  const each = Math.max(MIN_COL_WIDTH_PX, Math.floor(totalWidth / columns.length));
  return columns.map((col) => ({ ...col, widthPx: each }));
}

function migrateColumnLabel(col: ProductTableColumn, columnType: TableColumnType): string {
  // Keep empty string if the user cleared the name — never force "Column 1".
  if (typeof col.label === 'string') return col.label;
  return defaultLabelForColumnType(columnType);
}

function migrateColumn(
  col: ProductTableColumn & { widthPercent?: number },
  index: number,
  totalWidth: number
): ProductTableColumn {
  const columnType = normalizeColumnType(col.columnType);
  // Some older templates stored columns without ids; keep them stable across renders.
  const id = String(col.id || `col_${index + 1}`);
  const visible = col.visible !== false;
  const label = migrateColumnLabel(col, columnType);
  if (typeof col.widthPx === 'number' && col.widthPx > 0) {
    return {
      id,
      label,
      widthPx: col.widthPx,
      visible,
      columnType,
    };
  }
  if (typeof col.widthPercent === 'number') {
    return {
      id,
      label,
      widthPx: Math.max(MIN_COL_WIDTH_PX, Math.round((col.widthPercent / 100) * totalWidth)),
      visible,
      columnType,
    };
  }
  return {
    id,
    label,
    widthPx: Math.max(MIN_COL_WIDTH_PX, Math.floor(totalWidth / 4)),
    visible,
    columnType,
  };
}

function normalizeColumns(
  rawColumns: Array<ProductTableColumn & { widthPercent?: number }>,
  totalWidth = DEFAULT_TABLE_WIDTH_PX
): ProductTableColumn[] {
  if (rawColumns.length === 0) return DEFAULT_PRODUCT_TABLE_PROPS.columns;
  return rawColumns.map((col, index) => migrateColumn(col, index, totalWidth));
}

function normalizeRows(
  rows: ProductTableRow[],
  columns: ProductTableColumn[],
  allowEmpty = false
): ProductTableRow[] {
  if (rows.length === 0 && allowEmpty) return [];
  const source = rows.length > 0 ? rows : [createEmptyRow(columns, 1)];
  return source.map((row, index) => {
    const cells: Record<string, string> = {};
    columns.forEach((col) => {
      if (isSerialColumn(col)) {
        cells[col.id] = String(index + 1);
      } else if (isQuantityColumn(col) && !String(row.cells?.[col.id] ?? '').trim()) {
        cells[col.id] = '1';
      } else {
        cells[col.id] = String(row.cells?.[col.id] ?? '');
      }
    });
    return {
      id: String(row.id || uuidv4()),
      name: String(row.name || `Row ${index + 1}`),
      cells,
      heightPx:
        typeof row.heightPx === 'number' && row.heightPx > 0 ? row.heightPx : DEFAULT_ROW_HEIGHT_PX,
    };
  });
}

/** Renumber every Sr.No. column from 1..n in row order. */
export function applySerialNumbers<T extends ProductTableProps>(props: T): T {
  const serialCols = props.columns.filter((col) => isSerialColumn(col));
  if (serialCols.length === 0) return props;
  return {
    ...props,
    rows: props.rows.map((row, index) => {
      const cells = { ...row.cells };
      for (const col of serialCols) {
        cells[col.id] = String(index + 1);
      }
      return { ...row, cells };
    }),
  };
}

export const PREVIEW_PAGINATION_ROWS_KEY = '__previewPaginationRows';
export const PREVIEW_PAGINATION_RANGE_START_KEY = '__previewPaginationStart';
export const PREVIEW_PAGINATION_RANGE_END_KEY = '__previewPaginationEnd';
export const PREVIEW_PAGINATION_TABLE_ID_KEY = '__previewPaginationTableId';
/** Authored "show totals" intent — survives page-1 segments that force footers off. */
export const PREVIEW_PAGINATION_SHOW_TOTALS_KEY = '__previewPaginationShowTotals';

/** True when this table element is a Page 2+ continuation segment (not the Page 1 head). */
export function isTableContinuationSegment(props: Record<string, unknown>): boolean {
  const start = props[PREVIEW_PAGINATION_RANGE_START_KEY];
  return typeof start === 'number' && start > 0;
}

/** Stable identity for split table segments — survives row add/remove. */
export function resolvePaginationTableId(
  props: Record<string, unknown>,
  elementId: string
): string {
  const stored = props[PREVIEW_PAGINATION_TABLE_ID_KEY];
  if (typeof stored === 'string' && stored.length > 0) return stored;
  return elementId;
}

/** Keep paginated table metadata when props are rewritten (add row, fit heights, etc.). */
export function mergeTablePaginationProps(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  options: { clearSegmentRange?: boolean; anchorElementId?: string } = {}
): Record<string, unknown> {
  const merged = { ...target };
  const hadPagination =
    Array.isArray(source[PREVIEW_PAGINATION_ROWS_KEY])
    || Array.isArray(merged[PREVIEW_PAGINATION_ROWS_KEY]);

  if (options.clearSegmentRange && Array.isArray(merged.rows)) {
    merged[PREVIEW_PAGINATION_ROWS_KEY] = merged.rows;
  } else if (hadPagination) {
    // Keep the full pagination row list — never replace it with a page segment slice
    // (except real add/delete of the full list from the properties editor).
    const sourceAll = Array.isArray(source[PREVIEW_PAGINATION_ROWS_KEY])
      ? (source[PREVIEW_PAGINATION_ROWS_KEY] as unknown[])
      : null;
    const targetAll = Array.isArray(merged[PREVIEW_PAGINATION_ROWS_KEY])
      ? (merged[PREVIEW_PAGINATION_ROWS_KEY] as unknown[])
      : null;
    const displayRows = Array.isArray(merged.rows) ? (merged.rows as unknown[]) : null;

    const rangeStart =
      typeof merged[PREVIEW_PAGINATION_RANGE_START_KEY] === 'number'
        ? (merged[PREVIEW_PAGINATION_RANGE_START_KEY] as number)
        : typeof source[PREVIEW_PAGINATION_RANGE_START_KEY] === 'number'
          ? (source[PREVIEW_PAGINATION_RANGE_START_KEY] as number)
          : null;
    const rangeEnd =
      typeof merged[PREVIEW_PAGINATION_RANGE_END_KEY] === 'number'
        ? (merged[PREVIEW_PAGINATION_RANGE_END_KEY] as number)
        : typeof source[PREVIEW_PAGINATION_RANGE_END_KEY] === 'number'
          ? (source[PREVIEW_PAGINATION_RANGE_END_KEY] as number)
          : null;
    const segmentLen =
      rangeStart != null && rangeEnd != null && rangeEnd > rangeStart
        ? rangeEnd - rangeStart
        : null;

    // Full-list add/delete: `rows` length changed vs stored all-rows, and it is not
    // merely this page's segment (segment-sized writes must not wipe the full list).
    const isFullListStructuralEdit =
      !!displayRows
      && !!sourceAll
      && displayRows.length !== sourceAll.length
      && (segmentLen == null || displayRows.length !== segmentLen);

    if (isFullListStructuralEdit) {
      merged[PREVIEW_PAGINATION_ROWS_KEY] = displayRows;
    } else if (sourceAll && targetAll) {
      // Same length: keep incoming rows (product pick / cell edit). Old code kept
      // source and discarded picks when the full list was rewritten in place.
      if (targetAll.length === sourceAll.length) {
        merged[PREVIEW_PAGINATION_ROWS_KEY] = targetAll;
      } else if (
        targetAll.length < sourceAll.length
        && segmentLen != null
        && targetAll.length === segmentLen
      ) {
        merged[PREVIEW_PAGINATION_ROWS_KEY] = sourceAll;
      } else {
        merged[PREVIEW_PAGINATION_ROWS_KEY] = targetAll;
      }
    } else if (sourceAll) {
      merged[PREVIEW_PAGINATION_ROWS_KEY] = sourceAll;
    } else if (targetAll) {
      merged[PREVIEW_PAGINATION_ROWS_KEY] = targetAll;
    } else if (displayRows) {
      merged[PREVIEW_PAGINATION_ROWS_KEY] = displayRows;
    }

    // Grow when `rows` is already the full list longer than the stored key.
    if (
      displayRows
      && Array.isArray(merged[PREVIEW_PAGINATION_ROWS_KEY])
      && displayRows.length > (merged[PREVIEW_PAGINATION_ROWS_KEY] as unknown[]).length
      && (segmentLen == null || displayRows.length !== segmentLen)
    ) {
      merged[PREVIEW_PAGINATION_ROWS_KEY] = displayRows;
    }
  }

  if (typeof source[PREVIEW_PAGINATION_TABLE_ID_KEY] === 'string') {
    merged[PREVIEW_PAGINATION_TABLE_ID_KEY] = source[PREVIEW_PAGINATION_TABLE_ID_KEY];
  } else if (options.anchorElementId) {
    merged[PREVIEW_PAGINATION_TABLE_ID_KEY] = resolvePaginationTableId(
      source,
      options.anchorElementId
    );
  }

  if (typeof source[PREVIEW_PAGINATION_SHOW_TOTALS_KEY] === 'boolean') {
    merged[PREVIEW_PAGINATION_SHOW_TOTALS_KEY] = source[PREVIEW_PAGINATION_SHOW_TOTALS_KEY];
  } else if (typeof merged[PREVIEW_PAGINATION_SHOW_TOTALS_KEY] === 'boolean') {
    // keep target
  }

  if (options.clearSegmentRange) {
    delete merged[PREVIEW_PAGINATION_RANGE_START_KEY];
    delete merged[PREVIEW_PAGINATION_RANGE_END_KEY];
    // Restoring a full table for reflow — put totals back like a single table.
    if (merged[PREVIEW_PAGINATION_SHOW_TOTALS_KEY] === true) {
      merged.showGrandTotalFooter = true;
      merged.showTotalFooter = true;
      merged.showSummaryTable = true;
    } else if (merged[PREVIEW_PAGINATION_SHOW_TOTALS_KEY] === false) {
      merged.showGrandTotalFooter = false;
      merged.showTotalFooter = false;
      merged.showSummaryTable = false;
    }
  } else {
    if (typeof source[PREVIEW_PAGINATION_RANGE_START_KEY] === 'number') {
      merged[PREVIEW_PAGINATION_RANGE_START_KEY] = source[PREVIEW_PAGINATION_RANGE_START_KEY];
    }
    if (typeof source[PREVIEW_PAGINATION_RANGE_END_KEY] === 'number') {
      merged[PREVIEW_PAGINATION_RANGE_END_KEY] = source[PREVIEW_PAGINATION_RANGE_END_KEY];
    }
  }

  return merged;
}

/** When a table is split across pages, edits must apply to the full row list. */
export function resolveBuilderTablePropsForEdit(
  raw: Record<string, unknown> = {}
): Record<string, unknown> {
  const allRows = raw[PREVIEW_PAGINATION_ROWS_KEY];
  if (Array.isArray(allRows) && allRows.length > 0) {
    return { ...raw, rows: allRows };
  }
  return raw;
}

/** Empty page-2+ window that still owns the table total (no data rows left after delete). */
export function isTotalsOnlyPaginationRange(
  start: unknown,
  end: unknown,
  rowCount: number
): boolean {
  return (
    typeof start === 'number'
    && typeof end === 'number'
    && start === end
    && start === rowCount
    && rowCount >= 0
  );
}

/**
 * Totals-only / empty continuation segments must keep `rows: []`.
 * Normalizers otherwise inject a default "Sample item" row into empty tables.
 */
export function allowsEmptyPaginationSegmentRows(raw: Record<string, unknown> = {}): boolean {
  const allRows = raw[PREVIEW_PAGINATION_ROWS_KEY];
  const start = raw[PREVIEW_PAGINATION_RANGE_START_KEY];
  const end = raw[PREVIEW_PAGINATION_RANGE_END_KEY];
  if (!Array.isArray(allRows)) return false;
  if (typeof start !== 'number' || typeof end !== 'number') return false;
  if (isTotalsOnlyPaginationRange(start, end, allRows.length)) return true;
  return end <= start && start > 0;
}

function paginationWantsTotals(props: Record<string, unknown>): boolean {
  const stored = props[PREVIEW_PAGINATION_SHOW_TOTALS_KEY];
  if (typeof stored === 'boolean') return stored;
  if (props.showGrandTotalFooter === false) return false;
  if (props.showTotalFooter === false) return false;
  if (props.showSummaryTable === false) return false;
  return true;
}

/** Keep every split segment on the same full row list before document re-layout. */
export function syncPaginatedTableRowsAcrossSegments(
  pages: Array<{ elements: Array<{ id: string; type: string; props?: Record<string, unknown> }> }>,
  tableId: string,
  fullRows: ProductTableRow[]
): typeof pages {
  return pages.map((page) => ({
    ...page,
    elements: page.elements.flatMap((element) => {
      if (!isTableElementType(element.type)) return [element];
      const props = (element.props ?? {}) as Record<string, unknown>;
      if (resolvePaginationTableId(props, element.id) !== tableId) return [element];

      // Keep page ranges so page-2 Sr.No. does not reset to 1 after add/delete rows.
      const start = props[PREVIEW_PAGINATION_RANGE_START_KEY];
      const end = props[PREVIEW_PAGINATION_RANGE_END_KEY];
      const wasTotalsOnly = isTotalsOnlyPaginationRange(start, end, Array.isArray(props[PREVIEW_PAGINATION_ROWS_KEY])
        ? (props[PREVIEW_PAGINATION_ROWS_KEY] as ProductTableRow[]).length
        : (Array.isArray(props.rows) ? (props.rows as ProductTableRow[]).length : 0));
      const hasRange =
        typeof start === 'number'
        && typeof end === 'number'
        && (end > start || wasTotalsOnly || isTotalsOnlyPaginationRange(start, end, fullRows.length));
      const clampedStart = hasRange
        ? Math.min(Math.max(0, start), fullRows.length)
        : 0;
      const clampedEnd = hasRange
        ? Math.min(Math.max(clampedStart, end), fullRows.length)
        : fullRows.length;

      // Page-2+ segment has no rows left after delete — keep a totals-only shell when
      // totals still belong on a later page; otherwise remove (do NOT copy full table).
      if (
        hasRange
        && clampedEnd <= clampedStart
        && (clampedStart > 0 || isTableContinuationSegment(props) || wasTotalsOnly)
      ) {
        if (paginationWantsTotals(props)) {
          const nextProps: Record<string, unknown> = {
            ...props,
            [PREVIEW_PAGINATION_ROWS_KEY]: fullRows,
            rows: [],
            [PREVIEW_PAGINATION_RANGE_START_KEY]: fullRows.length,
            [PREVIEW_PAGINATION_RANGE_END_KEY]: fullRows.length,
            [PREVIEW_PAGINATION_SHOW_TOTALS_KEY]: true,
          };
          return [{ ...element, props: nextProps }];
        }
        return [];
      }

      const nextProps: Record<string, unknown> = {
        ...props,
        [PREVIEW_PAGINATION_ROWS_KEY]: fullRows,
        rows:
          hasRange && clampedEnd > clampedStart
            ? fullRows.slice(clampedStart, clampedEnd)
            : fullRows,
      };
      if (hasRange && clampedEnd > clampedStart) {
        nextProps[PREVIEW_PAGINATION_RANGE_START_KEY] = clampedStart;
        nextProps[PREVIEW_PAGINATION_RANGE_END_KEY] = clampedEnd;
      } else if (isTotalsOnlyPaginationRange(clampedStart, clampedEnd, fullRows.length)) {
        nextProps.rows = [];
        nextProps[PREVIEW_PAGINATION_RANGE_START_KEY] = fullRows.length;
        nextProps[PREVIEW_PAGINATION_RANGE_END_KEY] = fullRows.length;
      } else {
        // Single remaining segment owns all rows — clear split metadata.
        delete nextProps[PREVIEW_PAGINATION_RANGE_START_KEY];
        delete nextProps[PREVIEW_PAGINATION_RANGE_END_KEY];
        nextProps.rows = fullRows;
      }

      return [{ ...element, props: nextProps }];
    }),
  }));
}

/** All canvas elements that belong to the same paginated table (Page 1 anchor + continuations). */
export function collectConnectedTableElementIds(
  pages: Array<{ elements: Array<{ id: string; type: string; props?: Record<string, unknown> }> }>,
  elementId: string
): string[] {
  let tableId = elementId;
  for (const page of pages) {
    const hit = page.elements.find((element) => element.id === elementId);
    if (hit && isTableElementType(hit.type)) {
      tableId = resolvePaginationTableId((hit.props ?? {}) as Record<string, unknown>, hit.id);
      break;
    }
  }

  const ids: string[] = [];
  for (const page of pages) {
    for (const element of page.elements) {
      if (!isTableElementType(element.type)) continue;
      const props = (element.props ?? {}) as Record<string, unknown>;
      if (resolvePaginationTableId(props, element.id) === tableId) {
        ids.push(element.id);
      }
    }
  }

  return ids.length > 0 ? ids : [elementId];
}

export function normalizeProductTableProps(raw: Record<string, unknown> = {}): ProductTableProps {
  if (Array.isArray(raw.columns) && raw.columns.length > 0) {
    const columns = normalizeColumns(raw.columns as Array<ProductTableColumn & { widthPercent?: number }>);
    const paginationRows = raw.__previewPaginationRows;
    const hasPaginationRange =
      typeof raw.__previewPaginationStart === 'number'
      && typeof raw.__previewPaginationEnd === 'number'
      && Array.isArray(paginationRows);
    const resolvedRows = hasPaginationRange
      ? Array.isArray(raw.rows)
        ? (raw.rows as ProductTableRow[])
        : []
      : Array.isArray(paginationRows)
        ? (paginationRows as ProductTableRow[])
        : Array.isArray(raw.rows)
          ? (raw.rows as ProductTableRow[])
          : [];
    return {
      columns,
      rows: normalizeRows(resolvedRows, columns, allowsEmptyPaginationSegmentRows(raw)),
      showHeader: raw.showHeader !== false,
      headerHeightPx:
        typeof raw.headerHeightPx === 'number' && raw.headerHeightPx > 0
          ? raw.headerHeightPx
          : DEFAULT_HEADER_HEIGHT_PX,
      tableColor:
        typeof raw.tableColor === 'string' && raw.tableColor.trim()
          ? raw.tableColor
          : DEFAULT_TABLE_COLOR,
      borderOpacity: clampBorderOpacity(
        typeof raw.borderOpacity === 'number' ? raw.borderOpacity : DEFAULT_BORDER_OPACITY
      ),
      borderWidth: clampBorderWidth(
        typeof raw.borderWidth === 'number' ? raw.borderWidth : DEFAULT_BORDER_WIDTH_PX
      ),
      headerStyles: normalizeStyleMap(raw.headerStyles),
      cellStyles: normalizeStyleMap(raw.cellStyles),
      showProductSku: normalizeShowProductSku(raw.showProductSku),
    };
  }
  return structuredClone(DEFAULT_PRODUCT_TABLE_PROPS);
}

export function clampBorderOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BORDER_OPACITY;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function clampBorderWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BORDER_WIDTH_PX;
  return Math.min(MAX_BORDER_WIDTH_PX, Math.max(MIN_BORDER_WIDTH_PX, Math.round(value)));
}

const VALID_TEXT_ALIGNS = new Set<TableTextAlign>(['left', 'center', 'right', 'justify']);

function normalizeTextAlign(value: unknown): TableTextAlign | undefined {
  if (typeof value === 'string' && VALID_TEXT_ALIGNS.has(value as TableTextAlign)) {
    return value as TableTextAlign;
  }
  return undefined;
}

function normalizeCellStyle(raw: unknown): TableCellStyle {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  return {
    textAlign: normalizeTextAlign(o.textAlign),
    fontWeight: typeof o.fontWeight === 'number' ? o.fontWeight : undefined,
    italic: typeof o.italic === 'boolean' ? o.italic : undefined,
    underline: typeof o.underline === 'boolean' ? o.underline : undefined,
    color: typeof o.color === 'string' ? o.color : undefined,
    fontSize: typeof o.fontSize === 'number' ? o.fontSize : undefined,
    fontFamily: typeof o.fontFamily === 'string' ? o.fontFamily : undefined,
  };
}

export function normalizeStyleMap(raw: unknown): Record<string, TableCellStyle> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, TableCellStyle> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = normalizeCellStyle(value);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function tableCellStyleKey(
  rowId: string | null,
  columnId: string,
  isHeader: boolean
): string {
  return isHeader ? `h:${columnId}` : `${rowId}:${columnId}`;
}

export function getTableCellStyle(
  props: ProductTableProps,
  rowId: string | null,
  columnId: string,
  isHeader: boolean
): TableCellStyle {
  const key = tableCellStyleKey(rowId, columnId, isHeader);
  const map = isHeader ? props.headerStyles : props.cellStyles;
  return map?.[key] ?? {};
}

export function updateTableCellStyle(
  props: ProductTableProps,
  rowId: string | null,
  columnId: string,
  isHeader: boolean,
  patch: Partial<TableCellStyle>
): ProductTableProps {
  const key = tableCellStyleKey(rowId, columnId, isHeader);
  const field = isHeader ? 'headerStyles' : 'cellStyles';
  const currentMap = { ...(props[field] ?? {}) };
  currentMap[key] = { ...(currentMap[key] ?? {}), ...patch };
  return { ...props, [field]: currentMap };
}

export interface TableCellRef {
  elementId: string;
  rowId: string | null;
  columnId: string;
  isHeader: boolean;
}

/** Tab order: header left→right, then each row left→right. */
export function getTableCellFocusOrder(
  table: ProductTableProps,
  elementId: string
): TableCellRef[] {
  const order: TableCellRef[] = [];
  const columns = Array.isArray(table.columns) ? table.columns : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  if (table.showHeader) {
    for (const col of columns) {
      order.push({ elementId, rowId: null, columnId: col.id, isHeader: true });
    }
  }
  for (const row of rows) {
    for (const col of columns) {
      order.push({ elementId, rowId: row.id, columnId: col.id, isHeader: false });
    }
  }
  return order;
}

export function tableCellRefKey(ref: TableCellRef): string {
  return tableCellStyleKey(ref.rowId, ref.columnId, ref.isHeader);
}

export function isSameTableCell(
  a: { rowId: string | null; columnId: string; isHeader: boolean },
  b: { rowId: string | null; columnId: string; isHeader: boolean }
): boolean {
  return (
    a.columnId === b.columnId
    && a.isHeader === b.isHeader
    && (a.isHeader || a.rowId === b.rowId)
  );
}

export interface TableGridCoord {
  rowIndex: number;
  colIndex: number;
}

export function tableCellToGridCoord(
  table: ProductTableProps,
  ref: Pick<TableCellRef, 'rowId' | 'columnId' | 'isHeader'>
): TableGridCoord | null {
  const colIndex = table.columns.findIndex((c) => c.id === ref.columnId);
  if (colIndex === -1) return null;
  if (ref.isHeader) {
    if (!table.showHeader) return null;
    return { rowIndex: 0, colIndex };
  }
  const rowIndex = table.rows.findIndex((r) => r.id === ref.rowId);
  if (rowIndex === -1) return null;
  return { rowIndex: table.showHeader ? rowIndex + 1 : rowIndex, colIndex };
}

export function gridCoordToTableCell(
  table: ProductTableProps,
  elementId: string,
  coord: TableGridCoord
): TableCellRef | null {
  const col = table.columns[coord.colIndex];
  if (!col) return null;
  if (table.showHeader && coord.rowIndex === 0) {
    return { elementId, rowId: null, columnId: col.id, isHeader: true };
  }
  const dataRowIndex = table.showHeader ? coord.rowIndex - 1 : coord.rowIndex;
  const row = table.rows[dataRowIndex];
  if (!row) return null;
  return { elementId, rowId: row.id, columnId: col.id, isHeader: false };
}

export function getTableCellsInRect(
  table: ProductTableProps,
  elementId: string,
  anchor: TableGridCoord,
  focus: TableGridCoord
): TableCellRef[] {
  const minRow = Math.min(anchor.rowIndex, focus.rowIndex);
  const maxRow = Math.max(anchor.rowIndex, focus.rowIndex);
  const minCol = Math.min(anchor.colIndex, focus.colIndex);
  const maxCol = Math.max(anchor.colIndex, focus.colIndex);
  const cells: TableCellRef[] = [];
  for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
    for (let colIndex = minCol; colIndex <= maxCol; colIndex += 1) {
      const cell = gridCoordToTableCell(table, elementId, { rowIndex, colIndex });
      if (cell) cells.push(cell);
    }
  }
  return cells;
}

export type TableFormatScope = 'cell' | 'column' | 'row' | 'all';

export function resolveTableFormatTargets(
  table: ProductTableProps,
  elementId: string,
  scope: TableFormatScope,
  primaryCell: { rowId: string | null; columnId: string; isHeader: boolean } | null,
  selectedCells: Array<{ rowId: string | null; columnId: string; isHeader: boolean }>
): TableCellRef[] {
  if (scope === 'all') {
    return getTableCellFocusOrder(table, elementId);
  }
  if (scope === 'cell') {
    const source = selectedCells.length > 0 ? selectedCells : primaryCell ? [primaryCell] : [];
    return source.map((c) => ({
      elementId,
      rowId: c.rowId,
      columnId: c.columnId,
      isHeader: c.isHeader,
    }));
  }
  if (!primaryCell) return [];

  if (scope === 'column') {
    const refs: TableCellRef[] = [];
    if (table.showHeader) {
      refs.push({ elementId, rowId: null, columnId: primaryCell.columnId, isHeader: true });
    }
    for (const row of table.rows) {
      refs.push({ elementId, rowId: row.id, columnId: primaryCell.columnId, isHeader: false });
    }
    return refs;
  }

  if (primaryCell.isHeader) {
    if (!table.showHeader) return [];
    return table.columns.map((col) => ({
      elementId,
      rowId: null,
      columnId: col.id,
      isHeader: true,
    }));
  }
  return table.columns.map((col) => ({
    elementId,
    rowId: primaryCell.rowId,
    columnId: col.id,
    isHeader: false,
  }));
}

function mergeCellStylesForPreview(styles: TableCellStyle[]): TableCellStyle {
  if (styles.length === 0) return {};
  const keys: (keyof TableCellStyle)[] = [
    'textAlign',
    'fontWeight',
    'italic',
    'underline',
    'color',
    'fontSize',
    'fontFamily',
  ];
  const result: TableCellStyle = {};
  for (const key of keys) {
    const values = styles.map((s) => s[key]).filter((v) => v !== undefined);
    if (values.length === 0) continue;
    const first = values[0];
    if (values.every((v) => v === first)) {
      (result as Record<string, unknown>)[key] = first;
    }
  }
  return result;
}

export function getTableFormatStylePreview(
  table: ProductTableProps,
  elementId: string,
  scope: TableFormatScope,
  primaryCell: { rowId: string | null; columnId: string; isHeader: boolean } | null,
  selectedCells: Array<{ rowId: string | null; columnId: string; isHeader: boolean }>
): TableCellStyle {
  const targets = resolveTableFormatTargets(table, elementId, scope, primaryCell, selectedCells);
  if (targets.length === 0) return {};
  const styles = targets.map((t) =>
    getTableCellStyle(table, t.rowId, t.columnId, t.isHeader)
  );
  return mergeCellStylesForPreview(styles);
}

export function applyTableStylePatch(
  table: ProductTableProps,
  elementId: string,
  scope: TableFormatScope,
  primaryCell: { rowId: string | null; columnId: string; isHeader: boolean } | null,
  selectedCells: Array<{ rowId: string | null; columnId: string; isHeader: boolean }>,
  patch: Partial<TableCellStyle>
): ProductTableProps {
  const targets = resolveTableFormatTargets(table, elementId, scope, primaryCell, selectedCells);
  let next = table;
  for (const ref of targets) {
    next = updateTableCellStyle(next, ref.rowId, ref.columnId, ref.isHeader, patch);
  }
  return next;
}

function parseHexColor(color: string): { r: number; g: number; b: number } | null {
  const trimmed = color.trim();
  const short = /^#?([0-9a-f]{3})$/i.exec(trimmed);
  if (short) {
    const [r, g, b] = short[1].split('');
    return {
      r: parseInt(r + r, 16),
      g: parseInt(g + g, 16),
      b: parseInt(b + b, 16),
    };
  }
  const full = /^#?([0-9a-f]{6})$/i.exec(trimmed);
  if (!full) return null;
  const hex = full[1];
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function colorWithOpacity(color: string, opacityPercent: number): string {
  const rgb = parseHexColor(color);
  if (!rgb) return color;
  const alpha = clampBorderOpacity(opacityPercent) / 100;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function getTableBorderCss(props: ProductTableProps, scale = 1): string {
  // Whole pixels only — fractional borders render uneven/faint on some columns.
  const width = Math.max(1, Math.round(props.borderWidth * scale));
  const opacity = clampBorderOpacity(props.borderOpacity);
  const rgb = parseHexColor(props.tableColor);
  // Prefer opaque rgb/hex so grid lines stay equally dark (rgba anti-aliases unevenly).
  const color =
    opacity >= 100 && rgb
      ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
      : colorWithOpacity(props.tableColor, opacity);
  return `${width}px solid ${color}`;
}

export function getTableHeaderBackground(props: ProductTableProps): string {
  return colorWithOpacity(props.tableColor, DEFAULT_HEADER_FILL_OPACITY);
}

export function getTableTotalWidth(props: ProductTableProps) {
  return props.columns.reduce((sum, col) => sum + col.widthPx, 0);
}

export function getVisibleTableColumns(columns: ProductTableColumn[]): ProductTableColumn[] {
  return columns.filter((col) => col.visible !== false);
}

/** Width of only visible columns — used for layout and element box sizing. */
export function getVisibleTableTotalWidth(columns: ProductTableColumn[]): number {
  return getVisibleTableColumns(columns).reduce((sum, col) => sum + col.widthPx, 0);
}

export function getDisplayTableTotalWidth(props: ProductTableProps): number {
  return getVisibleTableTotalWidth(props.columns);
}

/** Scaled column widths that sum exactly to the rendered table width (avoids a gap on the right edge). */
export function getScaledColumnWidths(columns: ProductTableColumn[], scale: number): number[] {
  if (columns.length === 0) return [];
  // Integer widths keep vertical borders on whole pixels (avoids faint lines).
  const widths = columns.map((col) => Math.max(1, Math.round(col.widthPx * scale)));
  const targetWidth = Math.round(
    columns.reduce((sum, col) => sum + col.widthPx, 0) * scale
  );
  const sum = widths.reduce((a, b) => a + b, 0);
  const diff = targetWidth - sum;
  if (diff !== 0 && widths.length > 0) {
    widths[widths.length - 1] = Math.max(1, widths[widths.length - 1] + diff);
  }
  return widths;
}

export function computeTableHeight(props: ProductTableProps) {
  const header = props.showHeader ? props.headerHeightPx : 0;
  const body = props.rows.reduce((sum, row) => sum + row.heightPx, 0);
  const footer = props.showGrandTotalFooter
    ? (props.grandTotalFooterHeightPx ?? DEFAULT_ROW_HEIGHT_PX)
    : 0;
  return header + body + footer + 2;
}

const CELL_PADDING_X_PX = 16;
const CELL_PADDING_Y_PX = 8;
/** Must match cellTextStyle's lineHeight in ProductTableView. */
export const TABLE_CELL_LINE_HEIGHT = 1.35;
const DEFAULT_CELL_LINE_HEIGHT_RATIO = TABLE_CELL_LINE_HEIGHT;
const CELL_FONT_FAMILY_FALLBACK = 'Inter, sans-serif';

/** Real cell font for measurement — mirrors cellTextStyle in ProductTableView. */
function cellMeasureFont(style: TableCellStyle, isHeader: boolean): MeasureFont {
  return {
    fontFamily: style.fontFamily ?? CELL_FONT_FAMILY_FALLBACK,
    fontSize: style.fontSize ?? 12,
    fontWeight: style.fontWeight ?? (isHeader ? 600 : 400),
    italic: style.italic === true,
  };
}

function estimateMinColumnWidthPx(text: string, font: MeasureFont): number {
  const trimmed = text.trim();
  if (!trimmed) return MIN_COL_WIDTH_PX;
  return Math.ceil(measureTextWidth(trimmed, font) + CELL_PADDING_X_PX);
}

function maxColumnWidthForPreview(
  containerWidthPx: number,
  columnCount: number,
  minWidthPx: number
): number {
  const share = columnCount <= 3 ? 0.55 : columnCount <= 5 ? 0.42 : 0.35;
  return Math.max(minWidthPx, Math.floor(containerWidthPx * share));
}

function shrinkWidthsToFit(
  widths: number[],
  minWidths: number[],
  targetTotal: number
): number[] {
  let result = widths.map((w, i) => Math.max(minWidths[i], w));
  let total = result.reduce((sum, width) => sum + width, 0);
  if (total <= targetTotal) return result.map((width) => Math.round(width));

  for (let pass = 0; pass < 8 && total > targetTotal; pass += 1) {
    const excess = total - targetTotal;
    const shrinkable = result.reduce(
      (sum, width, index) => sum + Math.max(0, width - minWidths[index]),
      0
    );
    if (shrinkable <= 0) break;
    result = result.map((width, index) => {
      const room = Math.max(0, width - minWidths[index]);
      if (room <= 0) return width;
      return Math.max(minWidths[index], width - (excess * room) / shrinkable);
    });
    total = result.reduce((sum, width) => sum + width, 0);
  }

  return result.map((width) => Math.max(MIN_COL_WIDTH_PX, Math.round(width)));
}

/** Widen visible columns in preview so cell text is not clipped horizontally. */
export function fitTableColumnWidthsForPreview(
  props: ProductTableProps,
  containerWidthPx: number
): ProductTableProps {
  if (containerWidthPx <= 0) return props;

  const visibleColumnEntries = props.columns
    .map((col, index) => ({ col, index }))
    .filter(({ col }) => col.visible !== false);
  if (visibleColumnEntries.length === 0) return props;

  const visibleColumns = visibleColumnEntries.map(({ col }) => col);
  const minWidths = visibleColumns.map((col) => Math.max(MIN_COL_WIDTH_PX, col.widthPx));
  const targetWidths = [...minWidths];

  visibleColumns.forEach((col, index) => {
    const label = displayColumnLabel(col);
    const font = cellMeasureFont(getTableCellStyle(props, null, col.id, true), true);
    const maxWidth = maxColumnWidthForPreview(
      containerWidthPx,
      visibleColumns.length,
      minWidths[index]
    );
    targetWidths[index] = Math.max(
      targetWidths[index],
      Math.min(estimateMinColumnWidthPx(label, font), maxWidth)
    );
  });

  for (const row of props.rows) {
    visibleColumns.forEach((col, index) => {
      if (isSerialColumn(col)) return;
      const raw = String(row.cells[col.id] ?? '');
      if (!raw.trim()) return;
      const font = cellMeasureFont(getTableCellStyle(props, row.id, col.id, false), false);
      const widestLine = raw
        .split('\n')
        .reduce(
          (max, line) => Math.max(max, estimateMinColumnWidthPx(line, font)),
          0
        );
      const maxWidth = maxColumnWidthForPreview(
        containerWidthPx,
        visibleColumns.length,
        minWidths[index]
      );
      targetWidths[index] = Math.max(
        targetWidths[index],
        Math.min(widestLine, maxWidth)
      );
    });
  }

  const fittedWidths = shrinkWidthsToFit(targetWidths, minWidths, containerWidthPx);
  const columns = props.columns.map((col) => ({ ...col }));
  visibleColumnEntries.forEach(({ index }, visibleIndex) => {
    columns[index] = { ...columns[index], widthPx: fittedWidths[visibleIndex] };
  });

  return { ...props, columns };
}

function estimateWrappedLineCount(
  text: string,
  columnWidthPx: number,
  font: MeasureFont
): number {
  if (!text.trim()) return 1;
  const innerWidth = Math.max(20, columnWidthPx - CELL_PADDING_X_PX);
  return countWrappedLines(text, font, innerWidth);
}

function resolveColumnWidths(
  columns: ProductTableColumn[],
  columnWidthsPx?: number[]
): number[] {
  return columns.map((col, index) => columnWidthsPx?.[index] ?? col.widthPx);
}

/** Grow header height so labels like "Discount" are not clipped in preview. */
export function fitTableHeaderHeightToText(
  props: ProductTableProps,
  columnWidthsPx?: number[]
): ProductTableProps {
  if (!props.showHeader) return props;
  const visibleColumns = props.columns.filter((col) => col.visible !== false);
  if (visibleColumns.length === 0) return props;

  const widths = resolveColumnWidths(visibleColumns, columnWidthsPx);
  let maxLines = 1;
  let maxFontSize = 12;
  visibleColumns.forEach((col, index) => {
    const label = displayColumnLabel(col);
    const font = cellMeasureFont(getTableCellStyle(props, null, col.id, true), true);
    maxFontSize = Math.max(maxFontSize, font.fontSize);
    maxLines = Math.max(
      maxLines,
      estimateWrappedLineCount(label, widths[index], font)
    );
  });

  const neededHeight = Math.ceil(maxLines * maxFontSize * DEFAULT_CELL_LINE_HEIGHT_RATIO + CELL_PADDING_Y_PX);
  return {
    ...props,
    headerHeightPx: Math.max(MIN_ROW_HEIGHT_PX, props.headerHeightPx, neededHeight),
  };
}

/** Grow row heights in preview/export so wrapped cell text is not clipped. */
export function fitTableRowHeightsToText(
  props: ProductTableProps,
  columnWidthsPx?: number[],
  options?: { includeAllTextColumns?: boolean }
): ProductTableProps {
  const visibleColumns = props.columns.filter((col) => col.visible !== false);
  if (visibleColumns.length === 0) return props;

  const widths = resolveColumnWidths(visibleColumns, columnWidthsPx);
  const rows = props.rows.map((row) => {
    let maxLines = 1;
    let maxFontSize = 12;
    visibleColumns.forEach((col, index) => {
      if (isSerialColumn(col)) return;
      if (!options?.includeAllTextColumns && !isTableWrapFriendlyColumn(col)) return;
      const cellText = String(row.cells[col.id] ?? '');
      const font = cellMeasureFont(getTableCellStyle(props, row.id, col.id, false), false);
      maxFontSize = Math.max(maxFontSize, font.fontSize);
      maxLines = Math.max(
        maxLines,
        estimateWrappedLineCount(cellText, widths[index], font)
      );
    });
    const lineHeight = maxFontSize * DEFAULT_CELL_LINE_HEIGHT_RATIO;
    const neededHeight = Math.ceil(maxLines * lineHeight + CELL_PADDING_Y_PX);
    return {
      ...row,
      heightPx: Math.max(MIN_ROW_HEIGHT_PX, row.heightPx, neededHeight),
    };
  });

  return { ...props, rows };
}

/** Fit column widths, header, and line rows for preview rendering. */
export function fitTableLayoutForPreview(
  props: ProductTableProps,
  containerWidthPx: number
): ProductTableProps {
  const withWidths = fitTableColumnWidthsForPreview(props, containerWidthPx);
  const visibleColumns = withWidths.columns.filter((col) => col.visible !== false);
  const columnWidths = visibleColumns.map((col) => col.widthPx);
  const withHeader = fitTableHeaderHeightToText(withWidths, columnWidths);
  return fitTableRowHeightsToText(withHeader, columnWidths, { includeAllTextColumns: true });
}

export function productTablePropsToRecord(props: ProductTableProps): Record<string, unknown> {
  return { ...props };
}

export function createEmptyColumn(
  index: number,
  widthPx = MIN_COL_WIDTH_PX,
  columnType: TableColumnType = 'na'
): ProductTableColumn {
  const type = normalizeColumnType(columnType);
  return {
    id: uuidv4(),
    label: defaultLabelForColumnType(type, index),
    widthPx,
    visible: true,
    columnType: type,
  };
}

function isQuantityColumn(col: ProductTableColumn): boolean {
  if (col.id === 'col_units' || col.id === 'col_qty') return true;
  const label = String(col.label ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return /^(qty|quantity|units?)$/.test(label);
}

export function createEmptyRow(columns: ProductTableColumn[], index: number): ProductTableRow {
  const cells: Record<string, string> = {};
  columns.forEach((col) => {
    if (isSerialColumn(col)) {
      cells[col.id] = String(index);
    } else if (isQuantityColumn(col)) {
      cells[col.id] = '1';
    } else {
      cells[col.id] = '';
    }
  });
  return { id: uuidv4(), name: `Row ${index}`, cells, heightPx: DEFAULT_ROW_HEIGHT_PX };
}

export function addColumn(
  props: ProductTableProps,
  columnType: TableColumnType = 'na'
): ProductTableProps {
  const column = createEmptyColumn(props.columns.length + 1, MIN_COL_WIDTH_PX, columnType);
  const steal = Math.min(60, Math.floor(getTableTotalWidth(props) / (props.columns.length + 1)));
  const columns = props.columns.map((col, index) =>
    index === props.columns.length - 1
      ? { ...col, widthPx: Math.max(MIN_COL_WIDTH_PX, col.widthPx - steal) }
      : col
  );
  const next: ProductTableProps = {
    ...props,
    columns: [...columns, { ...column, widthPx: steal }],
    rows: props.rows.map((row, rowIndex) => ({
      ...row,
      cells: {
        ...row.cells,
        [column.id]: isSerialColumn(column) ? String(rowIndex + 1) : '',
      },
    })),
  };
  return applySerialNumbers(next);
}

export function removeColumn(props: ProductTableProps, columnId: string): ProductTableProps {
  if (props.columns.length <= 1) return props;
  const removed = props.columns.find((c) => c.id === columnId);
  const columns = props.columns.filter((c) => c.id !== columnId);
  if (removed && columns.length > 0) {
    columns[columns.length - 1] = {
      ...columns[columns.length - 1],
      widthPx: columns[columns.length - 1].widthPx + removed.widthPx,
    };
  }
  return {
    ...props,
    columns,
    rows: props.rows.map((row) => {
      const cells = { ...row.cells };
      delete cells[columnId];
      return { ...row, cells };
    }),
  };
}

export function updateColumnLabel(
  props: ProductTableProps,
  columnId: string,
  label: string
): ProductTableProps {
  return {
    ...props,
    columns: props.columns.map((col) => (col.id === columnId ? { ...col, label } : col)),
  };
}

export function updateColumnType(
  props: ProductTableProps,
  columnId: string,
  columnType: TableColumnType
): ProductTableProps {
  const type = normalizeColumnType(columnType);
  const columns = props.columns.map((col) =>
    col.id === columnId ? { ...col, columnType: type } : col
  );
  return applySerialNumbers({ ...props, columns });
}

export function updateColumnWidthPx(
  props: ProductTableProps,
  columnId: string,
  widthPx: number
): ProductTableProps {
  const target = props.columns.find((c) => c.id === columnId);
  if (!target) return props;
  const delta = Math.max(MIN_COL_WIDTH_PX, widthPx) - target.widthPx;
  const others = props.columns.filter((c) => c.id !== columnId);
  const last = others[others.length - 1];
  if (!last) return props;
  return {
    ...props,
    columns: props.columns.map((col) => {
      if (col.id === columnId) return { ...col, widthPx: Math.max(MIN_COL_WIDTH_PX, widthPx) };
      if (col.id === last.id) return { ...col, widthPx: Math.max(MIN_COL_WIDTH_PX, col.widthPx - delta) };
      return col;
    }),
  };
}

export function resizeColumnBoundaryPx(
  props: ProductTableProps,
  leftColumnId: string,
  rightColumnId: string,
  leftWidthPx: number,
  rightWidthPx: number
): ProductTableProps {
  return {
    ...props,
    columns: props.columns.map((col) => {
      if (col.id === leftColumnId) return { ...col, widthPx: Math.max(MIN_COL_WIDTH_PX, Math.round(leftWidthPx)) };
      if (col.id === rightColumnId) return { ...col, widthPx: Math.max(MIN_COL_WIDTH_PX, Math.round(rightWidthPx)) };
      return col;
    }),
  };
}

export function addRow(props: ProductTableProps): ProductTableProps {
  return applySerialNumbers({
    ...props,
    rows: [...props.rows, createEmptyRow(props.columns, props.rows.length + 1)],
  });
}

export function removeRow(props: ProductTableProps, rowId: string): ProductTableProps {
  if (props.rows.length <= 1) return props;
  return applySerialNumbers({
    ...props,
    rows: props.rows.filter((r) => r.id !== rowId),
  });
}

export function updateRowName(props: ProductTableProps, rowId: string, name: string): ProductTableProps {
  return {
    ...props,
    rows: props.rows.map((row) => (row.id === rowId ? { ...row, name } : row)),
  };
}

export function updateRowHeight(
  props: ProductTableProps,
  rowId: string,
  heightPx: number
): ProductTableProps {
  return {
    ...props,
    rows: props.rows.map((row) =>
      row.id === rowId
        ? { ...row, heightPx: Math.max(MIN_ROW_HEIGHT_PX, Math.round(heightPx)) }
        : row
    ),
  };
}

export function updateHeaderHeight(props: ProductTableProps, heightPx: number): ProductTableProps {
  return {
    ...props,
    headerHeightPx: Math.max(MIN_ROW_HEIGHT_PX, Math.round(heightPx)),
  };
}

function normalizeProductColumnLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function resolveProductQtyColumnId(
  columns: ProductTableColumn[],
  sampleCells?: Record<string, string>
): string | null {
  const id = pickProductNumericColumn(columns, sampleCells, /quant|qty|quantity/, 'col_qty');
  return id;
}

export function resolveProductRateColumnId(
  columns: ProductTableColumn[],
  sampleCells?: Record<string, string>
): string | null {
  return pickProductNumericColumn(
    columns,
    sampleCells,
    (norm) => /^rate$|unitprice|price|mrp/.test(norm) || norm.includes('rate'),
    'col_rate'
  ) ?? pickProductNumericColumn(columns, sampleCells, /price/, 'col_price');
}

function pickProductNumericColumn(
  columns: ProductTableColumn[],
  sampleCells: Record<string, string> | undefined,
  matcher: RegExp | ((norm: string) => boolean),
  standardId: string
): string | null {
  const matches = (norm: string) =>
    typeof matcher === 'function' ? matcher(norm) : matcher.test(norm);

  const candidates = columns.filter((col) => {
    if (col.visible === false || isSerialColumn(col)) return false;
    return matches(normalizeProductColumnLabel(col.label));
  });

  const standard = columns.find((col) => col.id === standardId);
  const pool = candidates.length > 0 ? candidates : standard ? [standard] : [];
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0].id;

  if (sampleCells) {
    const withValues = pool
      .map((col) => ({ col, value: parseProductAmount(sampleCells[col.id] ?? '0') }))
      .filter((item) => item.value > 0);
    if (withValues.length > 0) {
      withValues.sort((a, b) => b.value - a.value);
      const nonStandard = withValues.find((item) => item.col.id !== standardId);
      return (nonStandard ?? withValues[0]).col.id;
    }
  }

  const nonStandard = pool.find((col) => col.id !== standardId);
  return nonStandard?.id ?? pool[pool.length - 1].id;
}

export function resolveProductAmountColumnIds(columns: ProductTableColumn[]): string[] {
  const ids = new Set<string>();
  for (const col of columns) {
    if (col.visible === false || isSerialColumn(col)) continue;
    const norm = normalizeProductColumnLabel(col.label);
    if (/^amount$|^total$|^lineamount$|^linetotal$/.test(norm)) ids.add(col.id);
  }
  if (ids.size === 0) {
    const fallback = columns.find((col) => col.id === 'col_total');
    if (fallback) ids.add(fallback.id);
  }
  return [...ids];
}

function parseProductAmount(value: string): number {
  const cleaned = value.replace(/[,₹\s]/g, '').trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatProductAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function isEmbeddedSummaryRow(row: ProductTableRow): boolean {
  const nameToken = normalizeProductColumnLabel(row.name ?? '');
  if (/^(subtotal|cgst|sgst|igst|gst|total|final|amount|tax)$/.test(nameToken)) return true;
  for (const value of Object.values(row.cells ?? {})) {
    const token = normalizeProductColumnLabel(String(value));
    if (/^(subtotal|cgst|sgst|igst|gst|total|final)$/.test(token)) return true;
  }
  return false;
}

/** Recompute amount/total columns from qty × rate for plain product tables. */
export function recalculateProductTable(props: ProductTableProps): ProductTableProps {
  const qtyCol = resolveProductQtyColumnId(props.columns);
  const rateCol = resolveProductRateColumnId(props.columns);
  const amountCols = resolveProductAmountColumnIds(props.columns);
  if (!qtyCol || !rateCol || amountCols.length === 0) return props;

  const rows = props.rows.map((row) => {
    if (isEmbeddedSummaryRow(row)) return row;
    const qtyCol = resolveProductQtyColumnId(props.columns, row.cells);
    const rateCol = resolveProductRateColumnId(props.columns, row.cells);
    if (!qtyCol || !rateCol) return row;
    const qty = parseProductAmount(row.cells[qtyCol] ?? '0');
    const rate = parseProductAmount(row.cells[rateCol] ?? '0');
    const amount = formatProductAmount(Math.max(0, Math.round(qty * rate * 100) / 100));
    const cells = { ...row.cells };
    for (const columnId of amountCols) {
      cells[columnId] = amount;
    }
    return { ...row, cells };
  });

  return { ...props, rows };
}

export function isProductComputedAmountLabel(label: string): boolean {
  const norm = normalizeProductColumnLabel(label);
  return /^amount$|^total$|^lineamount$|^linetotal$/.test(norm);
}

export function updateCell(
  props: ProductTableProps,
  rowId: string,
  columnId: string,
  value: string
): ProductTableProps {
  const targetId = String(rowId);
  return {
    ...props,
    rows: props.rows.map((row) =>
      String(row.id) === targetId ? { ...row, cells: { ...row.cells, [columnId]: value } } : row
    ),
  };
}

export function isTableElementType(type: string) {
  return (
    type === 'product_table'
    || type === 'table'
    || type === 'invoice_table'
    || type === 'invoice_table_2'
    || type === 'invoice_table_3'
  );
}

export const TABLE_RESIZE_HANDLE_CLASS = 'builder-table-resize-handle';

export function scaleTableLayout(
  props: ProductTableProps,
  scaleX: number,
  scaleY: number
): ProductTableProps {
  return {
    ...props,
    headerHeightPx: Math.max(
      MIN_ROW_HEIGHT_PX,
      Math.round(props.headerHeightPx * scaleY)
    ),
    columns: props.columns.map((col) => ({
      ...col,
      widthPx: Math.max(MIN_COL_WIDTH_PX, Math.round(col.widthPx * scaleX)),
    })),
    rows: props.rows.map((row) => ({
      ...row,
      heightPx: Math.max(MIN_ROW_HEIGHT_PX, Math.round(row.heightPx * scaleY)),
    })),
  };
}

export function fitTableElementSize(props: ProductTableProps) {
  return {
    width: getDisplayTableTotalWidth(props) + 2,
    height: computeTableHeight(props),
  };
}
