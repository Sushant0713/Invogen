import { ComponentType } from '@invogen/shared';
import { v4 as uuidv4 } from 'uuid';
import { arrayMove } from '@dnd-kit/sortable';
import {
  type ProductTableColumn,
  type ProductTableProps,
  type ProductTableRow,
  DEFAULT_ROW_HEIGHT_PX,
  DEFAULT_HEADER_HEIGHT_PX,
  DEFAULT_TABLE_COLOR,
  DEFAULT_BORDER_OPACITY,
  DEFAULT_BORDER_WIDTH_PX,
  MIN_COL_WIDTH_PX,
  type TableColumnType,
  defaultLabelForColumnType,
  createEmptyColumn,
  getTableTotalWidth,
  getVisibleTableColumns,
  clampBorderOpacity,
  clampBorderWidth,
  normalizeStyleMap,
  updateColumnLabel,
  updateColumnWidthPx,
  updateHeaderHeight,
  updateRowName,
  updateRowHeight,
  updateCell,
  addRow,
  removeRow,
  computeTableHeight,
  applySerialNumbers,
  allowsEmptyPaginationSegmentRows,
} from './product-table';
import { type InvoiceDiscountMode } from './invoice-table';
import { type TaxSettings, EMPTY_TAX_SETTINGS, getCombinedGstRate, getIgstRate } from './tax-settings';
import { normalizeShowProductSku } from './product-settings';

export type InvoiceTable3Props = ProductTableProps & {
  discountMode?: InvoiceDiscountMode;
  showTotalFooter?: boolean;
  totalFooterGapPx?: number;
  totalFooterHeightPx?: number;
  totalFooterLabel?: string;
};

export const INVOICE3_COL_QTY = 'col_qty';
export const INVOICE3_COL_RATE = 'col_rate';
export const INVOICE3_COL_DISCOUNT = 'col_discount';
export const INVOICE3_COL_GST = 'col_gst';
export const INVOICE3_COL_TOTAL = 'col_total';

export const INVOICE3_FIXED_COLUMN_IDS = new Set([
  INVOICE3_COL_DISCOUNT,
  INVOICE3_COL_GST,
  INVOICE3_COL_TOTAL,
]);

const DEFAULT_FLEX_COLUMNS: ProductTableColumn[] = [
  { id: INVOICE3_COL_QTY, label: 'QTY', widthPx: 72, visible: true },
  { id: INVOICE3_COL_RATE, label: 'Rate', widthPx: 88, visible: true },
];

function discountColumnLabel(mode: InvoiceDiscountMode): string {
  return mode === 'percent' ? 'Discount (%)' : 'Discount';
}

function gstColumnLabel(tax: TaxSettings = EMPTY_TAX_SETTINGS): string {
  if (!tax.isEnabled) return tax.taxDisplayMode === 'igst' ? 'IGST' : 'GST';
  if (tax.taxDisplayMode === 'igst') {
    return `IGST (${getIgstRate(tax)}%)`;
  }
  return `GST (${getCombinedGstRate(tax)}%)`;
}

function getFixedColumnDefs(
  discountMode: InvoiceDiscountMode,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): ProductTableColumn[] {
  return [
    {
      id: INVOICE3_COL_DISCOUNT,
      label: discountColumnLabel(discountMode),
      widthPx: 88,
      visible: true,
    },
    { id: INVOICE3_COL_GST, label: gstColumnLabel(tax), widthPx: 80, visible: true },
    { id: INVOICE3_COL_TOTAL, label: 'Total', widthPx: 100, visible: true },
  ];
}

function buildEmptyRowCells(columns: ProductTableColumn[]): Record<string, string> {
  const cells: Record<string, string> = {};
  for (const col of columns) {
    if (
      col.id === INVOICE3_COL_DISCOUNT
      || col.id === INVOICE3_COL_GST
      || col.id === INVOICE3_COL_TOTAL
    ) {
      cells[col.id] = '0';
    } else {
      cells[col.id] = '';
    }
  }
  return cells;
}

function emptyRowCells(tax: TaxSettings = EMPTY_TAX_SETTINGS): Record<string, string> {
  return buildEmptyRowCells([...DEFAULT_FLEX_COLUMNS, ...getFixedColumnDefs('amount', tax)]);
}

export const DEFAULT_INVOICE3_TOTAL_FOOTER_GAP_PX = 12;

export const DEFAULT_INVOICE_TABLE_3_PROPS: InvoiceTable3Props = {
  columns: [...DEFAULT_FLEX_COLUMNS, ...getFixedColumnDefs('amount')],
  discountMode: 'amount',
  showTotalFooter: true,
  totalFooterGapPx: DEFAULT_INVOICE3_TOTAL_FOOTER_GAP_PX,
  totalFooterHeightPx: DEFAULT_ROW_HEIGHT_PX,
  totalFooterLabel: 'TOTAL :-',
  rows: [1, 2, 3].map((n) => ({
    id: `row_${n}`,
    name: `Row ${n}`,
    heightPx: DEFAULT_ROW_HEIGHT_PX,
    cells: emptyRowCells(),
  })),
  showHeader: true,
  headerHeightPx: DEFAULT_HEADER_HEIGHT_PX,
  tableColor: DEFAULT_TABLE_COLOR,
  borderOpacity: DEFAULT_BORDER_OPACITY,
  borderWidth: DEFAULT_BORDER_WIDTH_PX,
  showGrandTotalFooter: false,
};

export function isInvoiceTable3Type(type: string): boolean {
  return type === ComponentType.INVOICE_TABLE_3 || type === 'invoice_table_3';
}

export function isInvoice3FixedColumn(columnId: string): boolean {
  return INVOICE3_FIXED_COLUMN_IDS.has(columnId);
}

function migrateColumn(col: ProductTableColumn, index: number): ProductTableColumn {
  const columnType = col.columnType ?? 'na';
  return {
    id: col.id || `col_${index}`,
    label: typeof col.label === 'string' ? col.label : defaultLabelForColumnType(columnType),
    widthPx:
      typeof col.widthPx === 'number' && col.widthPx > 0 ? col.widthPx : MIN_COL_WIDTH_PX,
    visible: col.visible !== false,
    columnType,
  };
}

export function isInvoice3ColumnVisible(
  columns: ProductTableColumn[],
  columnId: string
): boolean {
  const col = columns.find((item) => item.id === columnId);
  if (!col) return false;
  return col.visible !== false;
}

export function getVisibleInvoice3Columns(columns: ProductTableColumn[]): ProductTableColumn[] {
  return getVisibleTableColumns(columns);
}

function normalizeDiscountMode(value: unknown): InvoiceDiscountMode {
  return value === 'percent' ? 'percent' : 'amount';
}

function normalizeColumns(
  rawColumns: ProductTableColumn[],
  discountMode: InvoiceDiscountMode,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): ProductTableColumn[] {
  const source = rawColumns.length > 0 ? rawColumns : DEFAULT_INVOICE_TABLE_3_PROPS.columns;
  const flexible: ProductTableColumn[] = [];
  const seen = new Set<string>();

  for (const col of source) {
    if (isInvoice3FixedColumn(col.id) || seen.has(col.id)) continue;
    flexible.push(migrateColumn(col, flexible.length));
    seen.add(col.id);
  }

  if (flexible.length === 0) {
    flexible.push(...DEFAULT_FLEX_COLUMNS.map((col, index) => migrateColumn(col, index)));
  }

  const fixed = getFixedColumnDefs(discountMode, tax).map((def) => {
    const existing = source.find((col) => col.id === def.id);
    const label =
      def.id === INVOICE3_COL_DISCOUNT
        ? discountColumnLabel(discountMode)
        : def.id === INVOICE3_COL_GST
          ? gstColumnLabel(tax)
          : def.label;
    return {
      ...def,
      label:
        existing?.label && def.id === INVOICE3_COL_TOTAL ? existing.label : label,
      widthPx:
        typeof existing?.widthPx === 'number' && existing.widthPx > 0
          ? existing.widthPx
          : def.widthPx,
      visible: existing?.visible ?? def.visible,
    };
  });

  return [...flexible, ...fixed];
}

function parseAmount(value: string): number {
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseInvoice3Quantity(value: string): number {
  return parseAmount(value);
}

function formatAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function getInvoice3FlexibleColumns(columns: ProductTableColumn[]): ProductTableColumn[] {
  const visible = getVisibleTableColumns(columns);
  const discountIdx = visible.findIndex((col) => col.id === INVOICE3_COL_DISCOUNT);
  if (discountIdx >= 0) return visible.slice(0, discountIdx);
  return visible.filter((col) => !isInvoice3FixedColumn(col.id));
}

/** QTY and Rate are the first two visible columns before Discount (matches table layout). */
function resolveInvoice3QtyRate(
  cells: Record<string, string>,
  columns: ProductTableColumn[]
): { qty: number; rate: number } {
  const flexible = getInvoice3FlexibleColumns(columns);
  const qtyCol = flexible.find((col) => col.id === INVOICE3_COL_QTY) ?? flexible[0];
  const rateCol =
    flexible.find((col) => col.id === INVOICE3_COL_RATE)
    ?? flexible.find((col) => col.id !== qtyCol?.id)
    ?? flexible[1];

  const qty = qtyCol ? parseInvoice3Quantity(cells[qtyCol.id] ?? '0') : 0;
  const rate = rateCol ? parseAmount(cells[rateCol.id] ?? '0') : 0;
  return { qty, rate };
}

function resolveInvoice3DiscountInput(
  cells: Record<string, string>,
  columns: ProductTableColumn[]
): number {
  if (!isInvoice3ColumnVisible(columns, INVOICE3_COL_DISCOUNT)) return 0;
  return parseAmount(cells[INVOICE3_COL_DISCOUNT] ?? '0');
}

function computeDiscountAmount(
  subtotal: number,
  discountInput: number,
  discountMode: InvoiceDiscountMode,
  columns: ProductTableColumn[]
): number {
  if (!isInvoice3ColumnVisible(columns, INVOICE3_COL_DISCOUNT)) return 0;
  if (discountMode === 'percent') {
    return roundAmount((subtotal * discountInput) / 100);
  }
  return discountInput;
}

/** Line: taxable = QTY × Rate − Discount; GST/IGST on taxable; Total = taxable + tax. */
export function calculateInvoice3LineAmounts(
  cells: Record<string, string>,
  tax: TaxSettings = EMPTY_TAX_SETTINGS,
  columns: ProductTableColumn[] = [],
  discountMode: InvoiceDiscountMode = 'amount'
): { taxable: number; gst: number; igst: number; total: number } {
  const { qty, rate } = resolveInvoice3QtyRate(cells, columns);
  const discountInput = resolveInvoice3DiscountInput(cells, columns);
  const subtotal = qty * rate;
  const discountAmount = computeDiscountAmount(subtotal, discountInput, discountMode, columns);
  const taxable = Math.max(0, roundAmount(subtotal - discountAmount));

  let gst = 0;
  let igst = 0;
  if (tax.isEnabled && isInvoice3ColumnVisible(columns, INVOICE3_COL_GST)) {
    if (tax.taxDisplayMode === 'igst') {
      igst = roundAmount((taxable * getIgstRate(tax)) / 100);
    } else {
      gst = roundAmount((taxable * getCombinedGstRate(tax)) / 100);
    }
  }

  const total = roundAmount(taxable + gst + igst);
  return { taxable, gst, igst, total };
}

export function getInvoice3GrandTotal(
  rows: ProductTableRow[],
  tax: TaxSettings = EMPTY_TAX_SETTINGS,
  columns: ProductTableColumn[] = [],
  discountMode: InvoiceDiscountMode = 'amount'
): number {
  return roundAmount(
    rows.reduce(
      (sum, row) =>
        sum + calculateInvoice3LineAmounts(row.cells, tax, columns, discountMode).total,
      0
    )
  );
}

export function getInvoice3GrandTotalFormatted(
  rows: ProductTableRow[],
  tax: TaxSettings = EMPTY_TAX_SETTINGS,
  columns: ProductTableColumn[] = [],
  discountMode: InvoiceDiscountMode = 'amount'
): string {
  return formatAmount(getInvoice3GrandTotal(rows, tax, columns, discountMode));
}

export function getInvoice3TotalFooterGap(props: InvoiceTable3Props): number {
  if (props.showTotalFooter === false) return 0;
  return typeof props.totalFooterGapPx === 'number' && props.totalFooterGapPx >= 0
    ? props.totalFooterGapPx
    : DEFAULT_INVOICE3_TOTAL_FOOTER_GAP_PX;
}

export function getInvoice3TotalFooterHeight(props: InvoiceTable3Props): number {
  if (props.showTotalFooter === false) return 0;
  return typeof props.totalFooterHeightPx === 'number' && props.totalFooterHeightPx > 0
    ? props.totalFooterHeightPx
    : DEFAULT_ROW_HEIGHT_PX;
}

export function computeInvoiceTable3Height(props: InvoiceTable3Props): number {
  return (
    computeTableHeight(props)
    + getInvoice3TotalFooterGap(props)
    + getInvoice3TotalFooterHeight(props)
  );
}

export function recalculateInvoice3Row(
  row: ProductTableRow,
  tax: TaxSettings = EMPTY_TAX_SETTINGS,
  columns: ProductTableColumn[] = [],
  discountMode: InvoiceDiscountMode = 'amount'
): ProductTableRow {
  const { gst, igst, total } = calculateInvoice3LineAmounts(row.cells, tax, columns, discountMode);
  return {
    ...row,
    cells: {
      ...row.cells,
      [INVOICE3_COL_GST]: formatAmount(gst + igst),
      [INVOICE3_COL_TOTAL]: formatAmount(total),
    },
  };
}

function syncGstColumnLabel(
  columns: ProductTableColumn[],
  tax: TaxSettings
): ProductTableColumn[] {
  return columns.map((col) =>
    col.id === INVOICE3_COL_GST ? { ...col, label: gstColumnLabel(tax) } : col
  );
}

export function recalculateInvoiceTable3(
  props: InvoiceTable3Props,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTable3Props {
  const withSerial = applySerialNumbers(props);
  const discountMode = normalizeDiscountMode(withSerial.discountMode);
  const columns = syncGstColumnLabel(withSerial.columns, tax);
  const rows = withSerial.rows.map((row) =>
    recalculateInvoice3Row(row, tax, columns, discountMode)
  );
  return { ...withSerial, columns, rows };
}

function normalizeRows(
  rows: ProductTableRow[],
  columns: ProductTableColumn[],
  tax: TaxSettings,
  discountMode: InvoiceDiscountMode = 'amount',
  allowEmpty = false
): ProductTableRow[] {
  if (rows.length === 0 && allowEmpty) return [];
  const source = rows.length > 0 ? rows : DEFAULT_INVOICE_TABLE_3_PROPS.rows;
  const emptyCells = buildEmptyRowCells(columns);
  const normalized = source.map((row, index) => {
    const cells: Record<string, string> = { ...emptyCells };
    columns.forEach((col) => {
      const raw = row.cells?.[col.id];
      if (raw !== undefined && raw !== null) {
        cells[col.id] = String(raw);
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
  return normalized.map((row) => recalculateInvoice3Row(row, tax, columns, discountMode));
}

export function isInvoice3ComputedColumn(columnId: string): boolean {
  return columnId === INVOICE3_COL_GST || columnId === INVOICE3_COL_TOTAL;
}

export function updateInvoice3Cell(
  props: InvoiceTable3Props,
  rowId: string,
  columnId: string,
  value: string,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTable3Props {
  if (isInvoice3ComputedColumn(columnId)) return props;
  return recalculateInvoiceTable3(updateCell(props, rowId, columnId, value), tax);
}

export function applyInvoice3CellEdits(
  props: InvoiceTable3Props,
  edits: Array<{ rowId: string; columnId: string; value: string }>,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTable3Props {
  if (edits.length === 0) return recalculateInvoiceTable3(props, tax);

  let next: InvoiceTable3Props = props;
  for (const { rowId, columnId, value } of edits) {
    if (isInvoice3ComputedColumn(columnId)) continue;
    next = updateCell(next, rowId, columnId, value) as InvoiceTable3Props;
  }
  return recalculateInvoiceTable3(next, tax);
}

export function normalizeInvoiceTable3Props(
  raw: Record<string, unknown> = {},
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTable3Props {
  if (!Array.isArray(raw.columns) || raw.columns.length === 0) {
    return recalculateInvoiceTable3(structuredClone(DEFAULT_INVOICE_TABLE_3_PROPS), tax);
  }

  const discountMode = normalizeDiscountMode(raw.discountMode);
  const columns = normalizeColumns(raw.columns as ProductTableColumn[], discountMode, tax);
  const base: InvoiceTable3Props = {
    columns,
    discountMode,
    showTotalFooter: raw.showTotalFooter !== false,
    totalFooterGapPx:
      typeof raw.totalFooterGapPx === 'number' && raw.totalFooterGapPx >= 0
        ? raw.totalFooterGapPx
        : DEFAULT_INVOICE3_TOTAL_FOOTER_GAP_PX,
    totalFooterHeightPx:
      typeof raw.totalFooterHeightPx === 'number' && raw.totalFooterHeightPx > 0
        ? raw.totalFooterHeightPx
        : DEFAULT_ROW_HEIGHT_PX,
    totalFooterLabel:
      typeof raw.totalFooterLabel === 'string' && raw.totalFooterLabel.trim()
        ? raw.totalFooterLabel
        : 'TOTAL :-',
    rows: normalizeRows(
      Array.isArray(raw.rows) ? (raw.rows as ProductTableRow[]) : [],
      columns,
      tax,
      discountMode,
      allowsEmptyPaginationSegmentRows(raw)
    ),
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
    showGrandTotalFooter: false,
    headerStyles: normalizeStyleMap(raw.headerStyles),
    cellStyles: normalizeStyleMap(raw.cellStyles),
    showProductSku: normalizeShowProductSku(raw.showProductSku),
  };
  return recalculateInvoiceTable3(base, tax);
}

function firstFixedColumnIndex(columns: ProductTableColumn[]): number {
  return columns.findIndex((col) => isInvoice3FixedColumn(col.id));
}

export function addInvoice3Column(
  props: InvoiceTable3Props,
  columnType: TableColumnType = 'na'
): InvoiceTable3Props {
  const fixedIndex = firstFixedColumnIndex(props.columns);
  const insertAt = fixedIndex === -1 ? props.columns.length : fixedIndex;
  const stealSourceIndex = Math.max(0, insertAt - 1);
  const steal = Math.min(60, Math.floor(getTableTotalWidth(props) / (props.columns.length + 1)));
  const column = createEmptyColumn(insertAt + 1, steal, columnType);

  const columns = props.columns.map((col, index) =>
    index === stealSourceIndex
      ? { ...col, widthPx: Math.max(MIN_COL_WIDTH_PX, col.widthPx - steal) }
      : col
  );
  columns.splice(insertAt, 0, column);

  const discountMode = normalizeDiscountMode(props.discountMode);
  const next = {
    ...props,
    columns,
    rows: props.rows.map((row, rowIndex) =>
      recalculateInvoice3Row(
        {
          ...row,
          cells: {
            ...row.cells,
            [column.id]: column.columnType === 'sr_no' ? String(rowIndex + 1) : '',
          },
        },
        EMPTY_TAX_SETTINGS,
        columns,
        discountMode
      )
    ),
  };
  return recalculateInvoiceTable3(next);
}

export function removeInvoice3Column(props: InvoiceTable3Props, columnId: string): InvoiceTable3Props {
  if (isInvoice3FixedColumn(columnId)) return props;

  const flexibleCount = props.columns.filter((col) => !isInvoice3FixedColumn(col.id)).length;
  if (flexibleCount <= 1) return props;

  const removed = props.columns.find((c) => c.id === columnId);
  const columns = props.columns.filter((c) => c.id !== columnId);
  if (removed) {
    const reclaimIndex = Math.max(0, firstFixedColumnIndex(columns) - 1);
    if (columns[reclaimIndex]) {
      columns[reclaimIndex] = {
        ...columns[reclaimIndex],
        widthPx: columns[reclaimIndex].widthPx + removed.widthPx,
      };
    }
  }

  const discountMode = normalizeDiscountMode(props.discountMode);
  const next = {
    ...props,
    columns,
    rows: props.rows.map((row) => {
      const cells = { ...row.cells };
      delete cells[columnId];
      return recalculateInvoice3Row({ ...row, cells }, EMPTY_TAX_SETTINGS, columns, discountMode);
    }),
  };
  return recalculateInvoiceTable3(next);
}

export function updateInvoice3ColumnLabel(
  props: InvoiceTable3Props,
  columnId: string,
  label: string
): InvoiceTable3Props {
  if (isInvoice3FixedColumn(columnId)) return props;
  return updateColumnLabel(props, columnId, label);
}

export function moveInvoice3Column(
  props: InvoiceTable3Props,
  columnId: string,
  direction: -1 | 1
): InvoiceTable3Props {
  if (isInvoice3FixedColumn(columnId)) return props;

  const fixedIndex = firstFixedColumnIndex(props.columns);
  const flexibleEnd = fixedIndex === -1 ? props.columns.length : fixedIndex;
  const index = props.columns.findIndex((col) => col.id === columnId);
  if (index === -1 || index >= flexibleEnd) return props;

  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= flexibleEnd) return props;

  const columns = [...props.columns];
  [columns[index], columns[targetIndex]] = [columns[targetIndex], columns[index]];
  return { ...props, columns };
}

export function getInvoice3FlexibleColumnBounds(columns: ProductTableColumn[]): {
  start: number;
  end: number;
} {
  const fixedIndex = firstFixedColumnIndex(columns);
  return { start: 0, end: fixedIndex === -1 ? columns.length : fixedIndex };
}

export function reorderInvoice3FlexibleColumns(
  props: InvoiceTable3Props,
  activeId: string,
  overId: string
): InvoiceTable3Props {
  const { end } = getInvoice3FlexibleColumnBounds(props.columns);
  const flexible = props.columns.slice(0, end);
  const fixed = props.columns.slice(end);

  const oldIndex = flexible.findIndex((col) => col.id === activeId);
  const newIndex = flexible.findIndex((col) => col.id === overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return props;

  return {
    ...props,
    columns: [...arrayMove(flexible, oldIndex, newIndex), ...fixed],
  };
}

export function setInvoice3DiscountMode(
  props: InvoiceTable3Props,
  mode: InvoiceDiscountMode,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTable3Props {
  const columns = props.columns.map((col) =>
    col.id === INVOICE3_COL_DISCOUNT ? { ...col, label: discountColumnLabel(mode) } : col
  );
  return recalculateInvoiceTable3({ ...props, columns, discountMode: mode }, tax);
}

export function setInvoice3ColumnVisible(
  props: InvoiceTable3Props,
  columnId: string,
  visible: boolean,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTable3Props {
  const visibleCount = props.columns.filter((col) => col.visible !== false).length;
  if (!visible && visibleCount <= 1) return props;

  const columns = props.columns.map((col) =>
    col.id === columnId ? { ...col, visible } : col
  );
  return recalculateInvoiceTable3({ ...props, columns }, tax);
}

export function addInvoice3Row(
  props: InvoiceTable3Props,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTable3Props {
  return recalculateInvoiceTable3(addRow(props), tax);
}

export { updateInvoice3Cell as updateCell };
export { addInvoice3Row as addRow };

export {
  updateColumnWidthPx,
  updateHeaderHeight,
  updateRowName,
  updateRowHeight,
  removeRow,
  getTableTotalWidth,
  getVisibleTableColumns,
  getDisplayTableTotalWidth,
  productTablePropsToRecord,
} from './product-table';
