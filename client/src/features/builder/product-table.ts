import { v4 as uuidv4 } from 'uuid';

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

function migrateColumn(col: ProductTableColumn & { widthPercent?: number }, index: number, totalWidth: number): ProductTableColumn {
  const columnType = normalizeColumnType(col.columnType);
  const visible = col.visible !== false;
  const label = migrateColumnLabel(col, columnType);
  if (typeof col.widthPx === 'number' && col.widthPx > 0) {
    return {
      id: col.id,
      label,
      widthPx: col.widthPx,
      visible,
      columnType,
    };
  }
  if (typeof col.widthPercent === 'number') {
    return {
      id: col.id,
      label,
      widthPx: Math.max(MIN_COL_WIDTH_PX, Math.round((col.widthPercent / 100) * totalWidth)),
      visible,
      columnType,
    };
  }
  return {
    id: col.id,
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

function normalizeRows(rows: ProductTableRow[], columns: ProductTableColumn[]): ProductTableRow[] {
  const source = rows.length > 0 ? rows : [createEmptyRow(columns, 1)];
  return source.map((row, index) => {
    const cells: Record<string, string> = {};
    columns.forEach((col) => {
      if (isSerialColumn(col)) {
        cells[col.id] = String(index + 1);
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

export function normalizeProductTableProps(raw: Record<string, unknown> = {}): ProductTableProps {
  if (Array.isArray(raw.columns) && raw.columns.length > 0) {
    const columns = normalizeColumns(raw.columns as Array<ProductTableColumn & { widthPercent?: number }>);
    return {
      columns,
      rows: normalizeRows(Array.isArray(raw.rows) ? (raw.rows as ProductTableRow[]) : [], columns),
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
  if (table.showHeader) {
    for (const col of table.columns) {
      order.push({ elementId, rowId: null, columnId: col.id, isHeader: true });
    }
  }
  for (const row of table.rows) {
    for (const col of table.columns) {
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

export function createEmptyRow(columns: ProductTableColumn[], index: number): ProductTableRow {
  const cells: Record<string, string> = {};
  columns.forEach((col) => {
    cells[col.id] = isSerialColumn(col) ? String(index) : '';
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

export function updateCell(
  props: ProductTableProps,
  rowId: string,
  columnId: string,
  value: string
): ProductTableProps {
  return {
    ...props,
    rows: props.rows.map((row) =>
      row.id === rowId ? { ...row, cells: { ...row.cells, [columnId]: value } } : row
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
