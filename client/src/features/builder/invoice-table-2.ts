import { ComponentType } from '@invogen/shared';
import { v4 as uuidv4 } from 'uuid';
import { arrayMove } from '@dnd-kit/sortable';
import {
  type ProductTableColumn,
  type ProductTableProps,
  type ProductTableRow,
  type TableCellRef,
  type TableGridCoord,
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
  getVisibleTableTotalWidth,
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
} from './product-table';
import {
  type InvoiceDiscountMode,
  type InvoiceTaxDisplayMode,
} from './invoice-table';
import { type TaxSettings, EMPTY_TAX_SETTINGS, getCombinedGstRate } from './tax-settings';

export type InvoiceTable2Props = ProductTableProps & {
  discountMode?: InvoiceDiscountMode;
  taxDisplayMode?: InvoiceTaxDisplayMode;
  showSummaryTable?: boolean;
  summaryRowHeightPx?: number;
  summaryGapPx?: number;
  /** Lower summary table rows (label in Discount col, amount in Total col). */
  summaryRows?: ProductTableRow[];
  /** @deprecated Use summaryRows — kept for migration. */
  computedSummaryRows?: Invoice2ComputedSummaryRow[];
};

export type Invoice2ComputedSummaryRow = {
  id: string;
  label: string;
  value: string;
  isTotal?: boolean;
};

export const INVOICE2_COL_ITEMS = 'col_items';
export const INVOICE2_COL_QTY = 'col_qty';
export const INVOICE2_COL_RATE = 'col_rate';
export const INVOICE2_COL_DISCOUNT = 'col_discount';
export const INVOICE2_COL_LINE_TOTAL = 'col_line_total';

const INVOICE2_NUMERIC_COLUMN_IDS = new Set([
  INVOICE2_COL_QTY,
  INVOICE2_COL_RATE,
  INVOICE2_COL_DISCOUNT,
]);

/** Virtual column ids for the disconnected summary block (label | value). */
export const INVOICE2_SUMMARY_COL_LABEL = '__inv2_summary_label';
export const INVOICE2_SUMMARY_COL_VALUE = '__inv2_summary_value';

export const INVOICE2_FIXED_COLUMN_IDS = new Set([
  INVOICE2_COL_DISCOUNT,
  INVOICE2_COL_LINE_TOTAL,
]);

const DEFAULT_FLEX_COLUMNS: ProductTableColumn[] = [
  { id: INVOICE2_COL_QTY, label: 'QTY', widthPx: 72, visible: true },
  { id: INVOICE2_COL_RATE, label: 'Rate', widthPx: 88, visible: true },
];

function discountColumnLabel(mode: InvoiceDiscountMode): string {
  return mode === 'percent' ? 'Discount (%)' : 'Discount';
}

function getFixedColumnDefs(discountMode: InvoiceDiscountMode): ProductTableColumn[] {
  return [
    {
      id: INVOICE2_COL_DISCOUNT,
      label: discountColumnLabel(discountMode),
      widthPx: 88,
      visible: true,
    },
    { id: INVOICE2_COL_LINE_TOTAL, label: 'Total', widthPx: 100, visible: true },
  ];
}

function buildEmptyRowCells(columns: ProductTableColumn[]): Record<string, string> {
  const cells: Record<string, string> = {};
  for (const col of columns) {
    if (col.id === INVOICE2_COL_DISCOUNT || col.id === INVOICE2_COL_LINE_TOTAL) {
      cells[col.id] = '0';
    } else {
      cells[col.id] = '';
    }
  }
  return cells;
}

function emptyRowCells(): Record<string, string> {
  return buildEmptyRowCells([...DEFAULT_FLEX_COLUMNS, ...getFixedColumnDefs('amount')]);
}

export const DEFAULT_INVOICE2_SUMMARY_GAP_PX = 12;

export const DEFAULT_INVOICE_TABLE_2_PROPS: InvoiceTable2Props = {
  columns: [...DEFAULT_FLEX_COLUMNS, ...getFixedColumnDefs('amount')],
  discountMode: 'amount',
  showSummaryTable: true,
  summaryRowHeightPx: DEFAULT_ROW_HEIGHT_PX,
  summaryGapPx: DEFAULT_INVOICE2_SUMMARY_GAP_PX,
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

export function isInvoiceTable2Type(type: string): boolean {
  return type === ComponentType.INVOICE_TABLE_2;
}

export function isInvoice2FixedColumn(columnId: string): boolean {
  return INVOICE2_FIXED_COLUMN_IDS.has(columnId);
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

export function isInvoice2ColumnVisible(
  columns: ProductTableColumn[],
  columnId: string
): boolean {
  const col = columns.find((item) => item.id === columnId);
  return col?.visible !== false;
}

export function getVisibleInvoice2Columns(columns: ProductTableColumn[]): ProductTableColumn[] {
  return getVisibleTableColumns(columns);
}

function normalizeDiscountMode(value: unknown): InvoiceDiscountMode {
  return value === 'percent' ? 'percent' : 'amount';
}

function normalizeTaxDisplayMode(value: unknown): InvoiceTaxDisplayMode {
  return value === 'combined' ? 'combined' : 'split';
}

function normalizeColumns(
  rawColumns: ProductTableColumn[],
  discountMode: InvoiceDiscountMode
): ProductTableColumn[] {
  const source = rawColumns.length > 0 ? rawColumns : DEFAULT_INVOICE_TABLE_2_PROPS.columns;
  const flexible: ProductTableColumn[] = [];
  const seen = new Set<string>();

  for (const col of source) {
    if (isInvoice2FixedColumn(col.id) || seen.has(col.id)) continue;
    flexible.push(migrateColumn(col, flexible.length));
    seen.add(col.id);
  }

  if (flexible.length === 0) {
    flexible.push(...DEFAULT_FLEX_COLUMNS.map((col, index) => migrateColumn(col, index)));
  }

  const fixed = getFixedColumnDefs(discountMode).map((def) => {
    const existing = source.find((col) => col.id === def.id);
    return {
      ...def,
      label:
        existing?.label && def.id !== INVOICE2_COL_DISCOUNT ? existing.label : def.label,
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

/** QTY must be a plain number (item names belong in the Item column). */
export function parseInvoice2Quantity(value: string): number {
  return parseAmount(value);
}

function parseNumericCell(columnId: string, value: string): number {
  if (columnId === INVOICE2_COL_QTY) return parseInvoice2Quantity(value);
  return parseAmount(value);
}

function formatAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function amountForVisibleColumn(
  cells: Record<string, string>,
  columnId: string,
  columns: ProductTableColumn[]
): number {
  if (!isInvoice2ColumnVisible(columns, columnId)) return 0;
  if (!INVOICE2_NUMERIC_COLUMN_IDS.has(columnId)) return 0;
  return parseNumericCell(columnId, cells[columnId] ?? '0');
}

function computeDiscountAmount(
  subtotal: number,
  discountInput: number,
  discountMode: InvoiceDiscountMode,
  columns: ProductTableColumn[]
): number {
  if (!isInvoice2ColumnVisible(columns, INVOICE2_COL_DISCOUNT)) return 0;
  if (discountMode === 'percent') {
    return roundAmount((subtotal * discountInput) / 100);
  }
  return discountInput;
}

/** Line total = (QTY × Rate) − Discount — no per-line tax. */
export function calculateInvoice2LineTotal(
  cells: Record<string, string>,
  columns: ProductTableColumn[] = [],
  discountMode: InvoiceDiscountMode = 'amount'
): number {
  const qty = amountForVisibleColumn(cells, INVOICE2_COL_QTY, columns);
  const rate = amountForVisibleColumn(cells, INVOICE2_COL_RATE, columns);
  const discountInput = amountForVisibleColumn(cells, INVOICE2_COL_DISCOUNT, columns);
  const subtotal = qty * rate;
  const discountAmount = computeDiscountAmount(subtotal, discountInput, discountMode, columns);
  return Math.max(0, roundAmount(subtotal - discountAmount));
}

export type Invoice2Summary = {
  subtotal: number;
  cgst: number;
  sgst: number;
  gst: number;
  total: number;
};

export function computeInvoice2Summary(
  rows: ProductTableRow[],
  tax: TaxSettings = EMPTY_TAX_SETTINGS,
  columns: ProductTableColumn[] = [],
  props: Pick<InvoiceTable2Props, 'discountMode' | 'taxDisplayMode'> = {}
): Invoice2Summary {
  const { discountMode, taxDisplayMode } = resolveInvoice2TaxOptions(
    {
      discountMode: props.discountMode,
      taxDisplayMode: props.taxDisplayMode,
    } as InvoiceTable2Props,
    tax
  );

  const subtotal = roundAmount(
    rows.reduce(
      (sum, row) => sum + calculateInvoice2LineTotal(row.cells, columns, discountMode),
      0
    )
  );

  let cgst = 0;
  let sgst = 0;
  let gst = 0;

  if (tax.isEnabled) {
    if (taxDisplayMode === 'split') {
      cgst = roundAmount((subtotal * tax.cgstRate) / 100);
      sgst = roundAmount((subtotal * tax.sgstRate) / 100);
    } else {
      gst = roundAmount((subtotal * getCombinedGstRate(tax)) / 100);
    }
  }

  const total = roundAmount(subtotal + cgst + sgst + gst);
  return { subtotal, cgst, sgst, gst, total };
}

export type Invoice2SummaryRow = { label: string; value: string };

export function resolveInvoice2TaxOptions(
  props: InvoiceTable2Props,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): {
  discountMode: InvoiceDiscountMode;
  taxDisplayMode: InvoiceTaxDisplayMode;
} {
  return {
    discountMode: normalizeDiscountMode(props.discountMode),
    taxDisplayMode: normalizeTaxDisplayMode(props.taxDisplayMode ?? tax.taxDisplayMode),
  };
}

function cgstSummaryLabel(tax: TaxSettings): string {
  return tax.isEnabled ? `CGST (${tax.cgstRate}%)` : 'CGST';
}

function sgstSummaryLabel(tax: TaxSettings): string {
  return tax.isEnabled ? `SGST (${tax.sgstRate}%)` : 'SGST';
}

function gstSummaryLabel(tax: TaxSettings): string {
  if (!tax.isEnabled) return 'GST';
  const rate = getCombinedGstRate(tax);
  return `GST (${rate}%)`;
}

export function getInvoice2SummaryRows(
  summary: Invoice2Summary,
  tax: TaxSettings = EMPTY_TAX_SETTINGS,
  taxDisplayMode: InvoiceTaxDisplayMode = 'split'
): Invoice2SummaryRow[] {
  if (taxDisplayMode === 'combined') {
    return [
      { label: 'SUBTOTAL', value: formatAmount(summary.subtotal) },
      { label: gstSummaryLabel(tax), value: formatAmount(summary.gst) },
      { label: 'TOTAL', value: formatAmount(summary.total) },
    ];
  }
  return [
    { label: 'SUBTOTAL', value: formatAmount(summary.subtotal) },
    { label: cgstSummaryLabel(tax), value: formatAmount(summary.cgst) },
    { label: sgstSummaryLabel(tax), value: formatAmount(summary.sgst) },
    { label: 'TOTAL', value: formatAmount(summary.total) },
  ];
}

export function getInvoice2SummaryLayout(columns: ProductTableColumn[]): {
  spacerWidthPx: number;
  labelColWidthPx: number;
  valueColWidthPx: number;
} {
  const visible = getVisibleTableColumns(columns);
  const discountIdx = visible.findIndex((col) => col.id === INVOICE2_COL_DISCOUNT);
  const totalIdx = visible.findIndex((col) => col.id === INVOICE2_COL_LINE_TOTAL);

  if (discountIdx >= 0 && totalIdx >= 0) {
    const spacerWidthPx = visible
      .slice(0, discountIdx)
      .reduce((sum, col) => sum + col.widthPx, 0);
    const labelColWidthPx = visible[discountIdx].widthPx;
    const valueColWidthPx = visible[totalIdx].widthPx;
    return { spacerWidthPx, labelColWidthPx, valueColWidthPx };
  }

  const totalW = getVisibleTableTotalWidth(columns);
  const half = Math.floor(totalW / 2);
  return { spacerWidthPx: totalW - half, labelColWidthPx: half, valueColWidthPx: half };
}

export function getInvoice2SummaryGap(props: InvoiceTable2Props): number {
  if (props.showSummaryTable === false) return 0;
  return typeof props.summaryGapPx === 'number' && props.summaryGapPx >= 0
    ? props.summaryGapPx
    : DEFAULT_INVOICE2_SUMMARY_GAP_PX;
}

export function getInvoice2SummaryHeight(props: InvoiceTable2Props): number {
  if (props.showSummaryTable === false) return 0;
  const rowHeight = props.summaryRowHeightPx ?? DEFAULT_ROW_HEIGHT_PX;
  const rowCount =
    props.summaryRows?.length
    ?? props.computedSummaryRows?.length
    ?? (normalizeTaxDisplayMode(props.taxDisplayMode) === 'combined' ? 3 : 4);
  return rowCount * rowHeight;
}

export function computeInvoiceTable2Height(props: InvoiceTable2Props): number {
  const summaryHeight = getInvoice2SummaryHeight(props);
  const summaryGap = getInvoice2SummaryGap(props);
  const summaryBorderPad = summaryHeight > 0 ? 2 : 0;
  return computeTableHeight(props) + summaryGap + summaryHeight + summaryBorderPad;
}

export function recalculateInvoice2Row(
  row: ProductTableRow,
  columns: ProductTableColumn[] = [],
  discountMode: InvoiceDiscountMode = 'amount'
): ProductTableRow {
  const lineTotal = calculateInvoice2LineTotal(row.cells, columns, discountMode);
  return {
    ...row,
    cells: {
      ...row.cells,
      [INVOICE2_COL_LINE_TOTAL]: formatAmount(lineTotal),
    },
  };
}

function buildComputedSummaryRows(
  props: InvoiceTable2Props,
  rows: ProductTableRow[],
  tax: TaxSettings
): Invoice2ComputedSummaryRow[] {
  if (props.showSummaryTable === false) return [];
  const visibleColumns = getVisibleInvoice2Columns(props.columns);
  const taxOptions = resolveInvoice2TaxOptions(props, tax);
  const summary = computeInvoice2Summary(rows, tax, visibleColumns, props);
  return getInvoice2SummaryRows(summary, tax, taxOptions.taxDisplayMode).map((row, index) => ({
    id: `summary_${index}`,
    label: row.label,
    value: row.value,
    isTotal: row.label === 'TOTAL',
  }));
}

function buildSummaryTableRows(
  props: InvoiceTable2Props,
  lineRows: ProductTableRow[],
  tax: TaxSettings
): ProductTableRow[] {
  const computed = buildComputedSummaryRows(props, lineRows, tax);
  const rowHeight = props.summaryRowHeightPx ?? DEFAULT_ROW_HEIGHT_PX;
  return computed.map((row) => ({
    id: row.id,
    name: row.label,
    heightPx: rowHeight,
    cells: {
      [INVOICE2_SUMMARY_COL_LABEL]: row.label,
      [INVOICE2_SUMMARY_COL_VALUE]: row.value,
    },
  }));
}

export function recalculateInvoiceTable2(
  props: InvoiceTable2Props,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTable2Props {
  const withSerial = applySerialNumbers(props);
  const { discountMode } = resolveInvoice2TaxOptions(withSerial, tax);
  const rows = withSerial.rows.map((row) =>
    recalculateInvoice2Row(row, withSerial.columns, discountMode)
  );
  const computedSummaryRows = buildComputedSummaryRows(withSerial, rows, tax);
  const summaryRows = buildSummaryTableRows(withSerial, rows, tax);
  return {
    ...withSerial,
    rows,
    summaryRows,
    computedSummaryRows,
  };
}

function normalizeRows(
  rows: ProductTableRow[],
  columns: ProductTableColumn[],
  discountMode: InvoiceDiscountMode = 'amount'
): ProductTableRow[] {
  const source = rows.length > 0 ? rows : DEFAULT_INVOICE_TABLE_2_PROPS.rows;
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
  return normalized.map((row) => recalculateInvoice2Row(row, columns, discountMode));
}

export function isInvoice2ComputedColumn(columnId: string, rowId?: string | null): boolean {
  if (rowId && isInvoice2SummaryRowId(rowId)) return false;
  return columnId === INVOICE2_COL_LINE_TOTAL;
}

export function updateInvoice2Cell(
  props: InvoiceTable2Props,
  rowId: string,
  columnId: string,
  value: string,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTable2Props {
  if (isInvoice2SummaryRowId(rowId)) {
    return updateInvoice2SummaryCell(props, rowId, columnId, value, tax);
  }
  if (isInvoice2ComputedColumn(columnId, rowId)) return props;
  return recalculateInvoiceTable2(updateCell(props, rowId, columnId, value), tax);
}

/** Apply multiple line/summary cell edits, then recalculate totals and summary rows. */
export function applyInvoice2CellEdits(
  props: InvoiceTable2Props,
  edits: Array<{ rowId: string; columnId: string; value: string }>,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTable2Props {
  if (edits.length === 0) return recalculateInvoiceTable2(props, tax);

  let next: InvoiceTable2Props = props;
  for (const { rowId, columnId, value } of edits) {
    if (isInvoice2SummaryRowId(rowId)) {
      next = updateInvoice2SummaryCell(next, rowId, columnId, value, tax);
      continue;
    }
    if (isInvoice2ComputedColumn(columnId, rowId)) continue;
    next = updateCell(next, rowId, columnId, value) as InvoiceTable2Props;
  }
  return recalculateInvoiceTable2(next, tax);
}

export function updateInvoice2SummaryCell(
  props: InvoiceTable2Props,
  rowId: string,
  columnId: string,
  value: string,
  _tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTable2Props {
  if (!isInvoice2SummaryRowId(rowId)) return props;

  let summaryColumnId = columnId;
  if (columnId === INVOICE2_COL_DISCOUNT) summaryColumnId = INVOICE2_SUMMARY_COL_LABEL;
  if (columnId === INVOICE2_COL_LINE_TOTAL) summaryColumnId = INVOICE2_SUMMARY_COL_VALUE;
  if (
    summaryColumnId !== INVOICE2_SUMMARY_COL_LABEL
    && summaryColumnId !== INVOICE2_SUMMARY_COL_VALUE
  ) {
    return props;
  }

  const summaryRows = (props.summaryRows ?? []).map((row) =>
    row.id === rowId ? { ...row, cells: { ...row.cells, [summaryColumnId]: value } } : row
  );
  return { ...props, summaryRows };
}

export function getInvoice2SummaryCellText(
  row: ProductTableRow,
  columnId: string
): string {
  if (columnId === INVOICE2_SUMMARY_COL_LABEL || columnId === INVOICE2_COL_DISCOUNT) {
    return row.cells[INVOICE2_SUMMARY_COL_LABEL] ?? row.cells[INVOICE2_COL_DISCOUNT] ?? '';
  }
  if (columnId === INVOICE2_SUMMARY_COL_VALUE || columnId === INVOICE2_COL_LINE_TOTAL) {
    return row.cells[INVOICE2_SUMMARY_COL_VALUE] ?? row.cells[INVOICE2_COL_LINE_TOTAL] ?? '';
  }
  return row.cells[columnId] ?? '';
}

export function getInvoice2SummaryColumnIndices(
  displayColumns: ProductTableColumn[]
): { labelColIndex: number; valueColIndex: number } {
  const labelColIndex = displayColumns.findIndex((col) => col.id === INVOICE2_COL_DISCOUNT);
  const valueColIndex = displayColumns.findIndex((col) => col.id === INVOICE2_COL_LINE_TOTAL);
  return { labelColIndex, valueColIndex };
}

export function normalizeInvoiceTable2Props(raw: Record<string, unknown> = {}): InvoiceTable2Props {
  if (!Array.isArray(raw.columns) || raw.columns.length === 0) {
    return structuredClone(DEFAULT_INVOICE_TABLE_2_PROPS);
  }

  const discountMode = normalizeDiscountMode(raw.discountMode);
  const columns = normalizeColumns(raw.columns as ProductTableColumn[], discountMode);
  const base: InvoiceTable2Props = {
    columns,
    discountMode,
    taxDisplayMode: raw.taxDisplayMode !== undefined
      ? normalizeTaxDisplayMode(raw.taxDisplayMode)
      : undefined,
    showSummaryTable: raw.showSummaryTable !== false,
    summaryRowHeightPx:
      typeof raw.summaryRowHeightPx === 'number' && raw.summaryRowHeightPx > 0
        ? raw.summaryRowHeightPx
        : DEFAULT_ROW_HEIGHT_PX,
    summaryGapPx:
      typeof raw.summaryGapPx === 'number' && raw.summaryGapPx >= 0
        ? raw.summaryGapPx
        : DEFAULT_INVOICE2_SUMMARY_GAP_PX,
    rows: normalizeRows(
      Array.isArray(raw.rows) ? (raw.rows as ProductTableRow[]) : [],
      columns,
      discountMode
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
  };
  return recalculateInvoiceTable2(base);
}

function firstFixedColumnIndex(columns: ProductTableColumn[]): number {
  return columns.findIndex((col) => isInvoice2FixedColumn(col.id));
}

export function addInvoice2Column(
  props: InvoiceTable2Props,
  columnType: TableColumnType = 'na'
): InvoiceTable2Props {
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

  const { discountMode } = resolveInvoice2TaxOptions(props);
  const next = {
    ...props,
    columns,
    rows: props.rows.map((row, rowIndex) =>
      recalculateInvoice2Row(
        {
          ...row,
          cells: {
            ...row.cells,
            [column.id]: column.columnType === 'sr_no' ? String(rowIndex + 1) : '',
          },
        },
        columns,
        discountMode
      )
    ),
  };
  return recalculateInvoiceTable2(next);
}

export function removeInvoice2Column(props: InvoiceTable2Props, columnId: string): InvoiceTable2Props {
  if (isInvoice2FixedColumn(columnId)) return props;

  const flexibleCount = props.columns.filter((col) => !isInvoice2FixedColumn(col.id)).length;
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

  const { discountMode } = resolveInvoice2TaxOptions({ ...props, columns });
  const next = {
    ...props,
    columns,
    rows: props.rows.map((row) => {
      const cells = { ...row.cells };
      delete cells[columnId];
      return recalculateInvoice2Row({ ...row, cells }, columns, discountMode);
    }),
  };
  return recalculateInvoiceTable2(next);
}

export function updateInvoice2ColumnLabel(
  props: InvoiceTable2Props,
  columnId: string,
  label: string
): InvoiceTable2Props {
  if (isInvoice2FixedColumn(columnId)) return props;
  return updateColumnLabel(props, columnId, label);
}

export function moveInvoice2Column(
  props: InvoiceTable2Props,
  columnId: string,
  direction: -1 | 1
): InvoiceTable2Props {
  if (isInvoice2FixedColumn(columnId)) return props;

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

export function getInvoice2FlexibleColumnBounds(columns: ProductTableColumn[]): {
  start: number;
  end: number;
} {
  const fixedIndex = firstFixedColumnIndex(columns);
  return { start: 0, end: fixedIndex === -1 ? columns.length : fixedIndex };
}

export function reorderInvoice2FlexibleColumns(
  props: InvoiceTable2Props,
  activeId: string,
  overId: string
): InvoiceTable2Props {
  const { end } = getInvoice2FlexibleColumnBounds(props.columns);
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

export function setInvoice2DiscountMode(
  props: InvoiceTable2Props,
  mode: InvoiceDiscountMode,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTable2Props {
  const columns = props.columns.map((col) =>
    col.id === INVOICE2_COL_DISCOUNT ? { ...col, label: discountColumnLabel(mode) } : col
  );
  return recalculateInvoiceTable2({ ...props, columns, discountMode: mode }, tax);
}

export function setInvoice2TaxDisplayMode(
  props: InvoiceTable2Props,
  mode: InvoiceTaxDisplayMode,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTable2Props {
  return recalculateInvoiceTable2({ ...props, taxDisplayMode: mode }, tax);
}

export function setInvoice2ColumnVisible(
  props: InvoiceTable2Props,
  columnId: string,
  visible: boolean,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTable2Props {
  const visibleCount = props.columns.filter((col) => col.visible !== false).length;
  if (!visible && visibleCount <= 1) return props;

  const columns = props.columns.map((col) =>
    col.id === columnId ? { ...col, visible } : col
  );
  return recalculateInvoiceTable2({ ...props, columns }, tax);
}

export function addInvoice2Row(
  props: InvoiceTable2Props,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTable2Props {
  return recalculateInvoiceTable2(addRow(props), tax);
}

export { updateInvoice2Cell as updateCell };
export { addInvoice2Row as addRow };

export function isInvoice2SummaryRowId(rowId: string): boolean {
  return rowId.startsWith('summary_');
}

export function isInvoice2SummaryCell(rowId: string | null, columnId: string): boolean {
  if (!rowId || !isInvoice2SummaryRowId(rowId)) return false;
  return (
    columnId === INVOICE2_SUMMARY_COL_LABEL
    || columnId === INVOICE2_SUMMARY_COL_VALUE
    || columnId === INVOICE2_COL_DISCOUNT
    || columnId === INVOICE2_COL_LINE_TOTAL
  );
}

export function isInvoice2SummaryColumn(columnId: string): boolean {
  return columnId === INVOICE2_SUMMARY_COL_LABEL
    || columnId === INVOICE2_SUMMARY_COL_VALUE
    || columnId === INVOICE2_COL_DISCOUNT
    || columnId === INVOICE2_COL_LINE_TOTAL;
}

export function getInvoice2SummaryGridRowIndex(
  table: InvoiceTable2Props,
  summaryRowIndex: number
): number {
  return (table.showHeader ? 1 : 0) + table.rows.length + summaryRowIndex;
}

export function getInvoice2DisplayCellsInRect(
  displayColumns: ProductTableColumn[],
  table: InvoiceTable2Props,
  elementId: string,
  anchor: TableGridCoord,
  focus: TableGridCoord,
  summaryRows: ProductTableRow[] = table.summaryRows ?? []
): TableCellRef[] {
  const minRow = Math.min(anchor.rowIndex, focus.rowIndex);
  const maxRow = Math.max(anchor.rowIndex, focus.rowIndex);
  const minCol = Math.min(anchor.colIndex, focus.colIndex);
  const maxCol = Math.max(anchor.colIndex, focus.colIndex);
  const summaryStart = (table.showHeader ? 1 : 0) + table.rows.length;
  const cells: TableCellRef[] = [];

  for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
    for (let colIndex = minCol; colIndex <= maxCol; colIndex += 1) {
      const col = displayColumns[colIndex];
      if (!col) continue;

      if (rowIndex >= summaryStart) {
        const summaryRow = summaryRows[rowIndex - summaryStart];
        if (!summaryRow) continue;
        const { labelColIndex, valueColIndex } = getInvoice2SummaryColumnIndices(displayColumns);
        if (colIndex === labelColIndex) {
          cells.push({
            elementId,
            rowId: summaryRow.id,
            columnId: INVOICE2_SUMMARY_COL_LABEL,
            isHeader: false,
          });
        } else if (colIndex === valueColIndex) {
          cells.push({
            elementId,
            rowId: summaryRow.id,
            columnId: INVOICE2_SUMMARY_COL_VALUE,
            isHeader: false,
          });
        }
        continue;
      }

      if (table.showHeader && rowIndex === 0) {
        cells.push({ elementId, rowId: null, columnId: col.id, isHeader: true });
        continue;
      }

      const dataRowIndex = table.showHeader ? rowIndex - 1 : rowIndex;
      const row = table.rows[dataRowIndex];
      if (!row) continue;
      cells.push({ elementId, rowId: row.id, columnId: col.id, isHeader: false });
    }
  }

  return cells;
}

/** Live summary rows from line items + tax settings (for canvas display). */
export function buildInvoice2SummaryDisplayRows(
  props: InvoiceTable2Props,
  rows: ProductTableRow[],
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): Invoice2ComputedSummaryRow[] {
  return buildComputedSummaryRows(props, rows, tax);
}

export function getInvoice2TableCellFocusOrder(
  table: InvoiceTable2Props,
  elementId: string,
  displayColumns: ProductTableColumn[],
  summaryRows: ProductTableRow[] = table.summaryRows ?? []
): TableCellRef[] {
  const order: TableCellRef[] = [];

  if (table.showHeader) {
    for (const col of displayColumns) {
      order.push({ elementId, rowId: null, columnId: col.id, isHeader: true });
    }
  }

  for (const row of table.rows) {
    for (const col of displayColumns) {
      order.push({ elementId, rowId: row.id, columnId: col.id, isHeader: false });
    }
  }

  if (table.showSummaryTable === false || summaryRows.length === 0) return order;

  for (const row of summaryRows) {
    order.push({
      elementId,
      rowId: row.id,
      columnId: INVOICE2_SUMMARY_COL_LABEL,
      isHeader: false,
    });
    order.push({
      elementId,
      rowId: row.id,
      columnId: INVOICE2_SUMMARY_COL_VALUE,
      isHeader: false,
    });
  }
  return order;
}

export {
  updateColumnWidthPx,
  updateHeaderHeight,
  updateRowName,
  updateRowHeight,
  removeRow,
  getTableTotalWidth,
  getVisibleTableColumns,
  getDisplayTableTotalWidth,
} from './product-table';

export { productTablePropsToRecord } from './product-table';
