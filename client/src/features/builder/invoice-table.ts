import { ComponentType } from '@invogen/shared';
import { v4 as uuidv4 } from 'uuid';
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
  getVisibleTableTotalWidth,
  normalizeColumnType,
  normalizeProductTableProps,
  productTablePropsToRecord,
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
  applySerialNumbers,
  allowsEmptyPaginationSegmentRows,
} from './product-table';
import { arrayMove } from '@dnd-kit/sortable';
import { type TaxSettings, EMPTY_TAX_SETTINGS, getCombinedGstRate, getIgstRate, normalizeTaxDisplayMode, resolveLineTaxSettings, PRODUCT_GST_RATE_KEY } from './tax-settings';
import { normalizeShowProductSku } from './product-settings';

export type InvoiceDiscountMode = 'amount' | 'percent';
export type InvoiceTaxDisplayMode = 'split' | 'combined' | 'igst';

export type InvoiceTableProps = ProductTableProps & {
  discountMode?: InvoiceDiscountMode;
  taxDisplayMode?: InvoiceTaxDisplayMode;
};

export const INVOICE_COL_SR_NO = 'col_sr_no';
export const INVOICE_COL_ITEMS = 'col_items';
export const INVOICE_COL_RATE = 'col_rate';
export const INVOICE_COL_UNITS = 'col_units';
export const INVOICE_COL_DISCOUNT = 'col_discount';
export const INVOICE_COL_TAXABLE = 'col_taxable';
export const INVOICE_COL_CGST = 'col_cgst';
export const INVOICE_COL_SGST = 'col_sgst';
export const INVOICE_COL_GST = 'col_gst';
export const INVOICE_COL_IGST = 'col_igst';
export const INVOICE_COL_TOTAL = 'col_total';

export const INVOICE_FIXED_COLUMN_IDS = new Set([
  INVOICE_COL_DISCOUNT,
  INVOICE_COL_TAXABLE,
  INVOICE_COL_CGST,
  INVOICE_COL_SGST,
  INVOICE_COL_GST,
  INVOICE_COL_IGST,
  INVOICE_COL_TOTAL,
]);

function discountColumnLabel(mode: InvoiceDiscountMode): string {
  return mode === 'percent' ? 'Discount (%)' : 'Discount';
}

function getFixedColumnDefs(taxDisplayMode: InvoiceTaxDisplayMode): ProductTableColumn[] {
  return [
    { id: INVOICE_COL_DISCOUNT, label: 'Discount', widthPx: 88, visible: true },
    { id: INVOICE_COL_TAXABLE, label: 'Taxable Amount', widthPx: 108, visible: true },
    { id: INVOICE_COL_CGST, label: 'CGST', widthPx: 80, visible: taxDisplayMode === 'split' },
    { id: INVOICE_COL_SGST, label: 'SGST', widthPx: 80, visible: taxDisplayMode === 'split' },
    { id: INVOICE_COL_GST, label: 'GST', widthPx: 80, visible: taxDisplayMode === 'combined' },
    { id: INVOICE_COL_IGST, label: 'IGST', widthPx: 80, visible: taxDisplayMode === 'igst' },
    { id: INVOICE_COL_TOTAL, label: 'Total Amount', widthPx: 100, visible: true },
  ];
}

const DEFAULT_FLEX_COLUMNS: ProductTableColumn[] = [
  { id: INVOICE_COL_SR_NO, label: 'Sr.No.', widthPx: 52, visible: true, columnType: 'sr_no' },
  { id: INVOICE_COL_ITEMS, label: 'Items', widthPx: 160, visible: true, columnType: 'product' },
  { id: INVOICE_COL_RATE, label: 'Rate', widthPx: 80, visible: true, columnType: 'na' },
  { id: INVOICE_COL_UNITS, label: 'Units', widthPx: 72, visible: true, columnType: 'na' },
];

export const DEFAULT_INVOICE_TABLE_PROPS: InvoiceTableProps = {
  columns: [
    ...DEFAULT_FLEX_COLUMNS,
    ...getFixedColumnDefs('split'),
  ],
  discountMode: 'amount',
  taxDisplayMode: 'split',
  rows: [
    {
      id: 'row_1',
      name: 'Row 1',
      heightPx: DEFAULT_ROW_HEIGHT_PX,
      cells: {
        [INVOICE_COL_SR_NO]: '1',
        [INVOICE_COL_ITEMS]: 'Sample item',
        [INVOICE_COL_RATE]: '100',
        [INVOICE_COL_UNITS]: '1',
        [INVOICE_COL_DISCOUNT]: '0',
        [INVOICE_COL_TAXABLE]: '100',
        [INVOICE_COL_CGST]: '9',
        [INVOICE_COL_SGST]: '9',
        [INVOICE_COL_GST]: '0',
        [INVOICE_COL_IGST]: '0',
        [INVOICE_COL_TOTAL]: '118',
      },
    },
  ],
  showHeader: true,
  headerHeightPx: DEFAULT_HEADER_HEIGHT_PX,
  tableColor: DEFAULT_TABLE_COLOR,
  borderOpacity: DEFAULT_BORDER_OPACITY,
  borderWidth: DEFAULT_BORDER_WIDTH_PX,
  showGrandTotalFooter: true,
  grandTotalFooterHeightPx: DEFAULT_ROW_HEIGHT_PX,
  showAmountInWords: true,
};

export function isInvoiceTable1Type(type: string): boolean {
  return type === ComponentType.INVOICE_TABLE;
}

export function isInvoiceTableType(type: string): boolean {
  return isInvoiceTable1Type(type);
}

export function isInvoiceFixedColumn(columnId: string): boolean {
  return INVOICE_FIXED_COLUMN_IDS.has(columnId);
}

export function isInvoiceTaxColumn(columnId: string): boolean {
  return (
    columnId === INVOICE_COL_CGST
    || columnId === INVOICE_COL_SGST
    || columnId === INVOICE_COL_GST
    || columnId === INVOICE_COL_IGST
  );
}

function migrateInvoiceColumn(col: ProductTableColumn, index: number): ProductTableColumn {
  let columnType = normalizeColumnType(col.columnType);
  // Legacy invoice defaults when type was never set.
  if (col.columnType == null || columnType === 'na') {
    if (col.id === INVOICE_COL_SR_NO) columnType = 'sr_no';
    else if (col.id === INVOICE_COL_ITEMS) columnType = 'product';
    else {
      const label = String(col.label ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (label === 'sku') columnType = 'sku';
      else if (label === 'hsn' || label === 'hsnsac' || label === 'sac') columnType = 'hsn';
      else if (col.columnType == null) columnType = 'na';
    }
  }
  return {
    id: col.id || `col_${index}`,
    // Preserve empty labels — do not replace with "Column 1".
    label: typeof col.label === 'string' ? col.label : defaultLabelForColumnType(columnType),
    widthPx:
      typeof col.widthPx === 'number' && col.widthPx > 0
        ? col.widthPx
        : MIN_COL_WIDTH_PX,
    visible: col.visible !== false,
    columnType,
  };
}

export function isInvoiceColumnVisible(
  columns: ProductTableColumn[],
  columnId: string
): boolean {
  const col = columns.find((item) => item.id === columnId);
  return col?.visible !== false;
}

export function getVisibleInvoiceColumns(columns: ProductTableColumn[]): ProductTableColumn[] {
  return getVisibleTableColumns(columns);
}

export function getInvoiceTableDisplayWidth(columns: ProductTableColumn[]): number {
  return getVisibleTableTotalWidth(columns);
}

function normalizeInvoiceTaxDisplayMode(value: unknown): InvoiceTaxDisplayMode {
  return normalizeTaxDisplayMode(value);
}

function normalizeInvoiceDiscountMode(value: unknown): InvoiceDiscountMode {
  return value === 'percent' ? 'percent' : 'amount';
}

function normalizeInvoiceColumns(
  rawColumns: ProductTableColumn[],
  taxDisplayMode: InvoiceTaxDisplayMode,
  discountMode: InvoiceDiscountMode
): ProductTableColumn[] {
  const source = rawColumns.length > 0 ? rawColumns : DEFAULT_INVOICE_TABLE_PROPS.columns;
  const flexible: ProductTableColumn[] = [];
  const seen = new Set<string>();

  for (const col of source) {
    if (isInvoiceFixedColumn(col.id) || seen.has(col.id)) continue;
    flexible.push(migrateInvoiceColumn(col, flexible.length));
    seen.add(col.id);
  }

  if (flexible.length === 0) {
    flexible.push(...DEFAULT_FLEX_COLUMNS.map((col, index) => migrateInvoiceColumn(col, index)));
  } else {
    // Templates sometimes omit Rate/Units from flexible cols; product pick needs them.
    for (const def of DEFAULT_FLEX_COLUMNS) {
      if (flexible.some((col) => col.id === def.id)) continue;
      if (def.id === INVOICE_COL_RATE) {
        const hasRateLabel = flexible.some((col) => {
          const norm = (col.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return /^rate$|unitprice|price|mrp/.test(norm) || norm.includes('rate');
        });
        if (hasRateLabel) continue;
      }
      if (def.id === INVOICE_COL_UNITS) {
        const hasUnitsLabel = flexible.some((col) => {
          const norm = (col.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return /quant|qty|quantity|units?/.test(norm);
        });
        if (hasUnitsLabel) continue;
      }
      flexible.push(migrateInvoiceColumn(def, flexible.length));
    }
  }

  const fixed = getFixedColumnDefs(taxDisplayMode).map((def) => {
    const existing = source.find((col) => col.id === def.id);
    const label =
      def.id === INVOICE_COL_DISCOUNT ? discountColumnLabel(discountMode) : def.label;
    const visibility = isInvoiceTaxColumn(def.id)
      ? def.visible
      : (existing?.visible ?? def.visible);
    return {
      ...def,
      label: existing?.label && def.id !== INVOICE_COL_DISCOUNT ? existing.label : label,
      widthPx:
        typeof existing?.widthPx === 'number' && existing.widthPx > 0
          ? existing.widthPx
          : def.widthPx,
      visible: visibility,
    };
  });

  return [...flexible, ...fixed];
}

function parseInvoiceAmount(value: string): number {
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatInvoiceAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function roundInvoiceAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function amountForVisibleColumn(
  cells: Record<string, string>,
  columnId: string,
  columns: ProductTableColumn[]
): number {
  if (!isInvoiceColumnVisible(columns, columnId)) return 0;
  return parseInvoiceAmount(cells[columnId] ?? '0');
}

function computeDiscountAmount(
  subtotal: number,
  discountInput: number,
  discountMode: InvoiceDiscountMode,
  columns: ProductTableColumn[]
): number {
  if (!isInvoiceColumnVisible(columns, INVOICE_COL_DISCOUNT)) return 0;
  if (discountMode === 'percent') {
    return roundInvoiceAmount((subtotal * discountInput) / 100);
  }
  return discountInput;
}

/** Taxable = (Rate × Units) − Discount; tax as CGST+SGST, combined GST, or IGST. */
export function calculateInvoiceAmounts(
  cells: Record<string, string>,
  tax: TaxSettings = EMPTY_TAX_SETTINGS,
  columns: ProductTableColumn[] = [],
  options: {
    discountMode?: InvoiceDiscountMode;
    taxDisplayMode?: InvoiceTaxDisplayMode;
  } = {}
): {
  taxable: number;
  cgst: number;
  sgst: number;
  gst: number;
  igst: number;
  total: number;
} {
  const discountMode = options.discountMode ?? 'amount';
  const taxDisplayMode = options.taxDisplayMode ?? 'split';
  const lineTax = resolveLineTaxSettings(cells, tax);

  const rate = amountForVisibleColumn(cells, INVOICE_COL_RATE, columns);
  const units = amountForVisibleColumn(cells, INVOICE_COL_UNITS, columns);
  const discountInput = amountForVisibleColumn(cells, INVOICE_COL_DISCOUNT, columns);
  const subtotal = rate * units;
  const discountAmount = computeDiscountAmount(subtotal, discountInput, discountMode, columns);
  const taxable = Math.max(0, subtotal - discountAmount);

  let cgst = 0;
  let sgst = 0;
  let gst = 0;
  let igst = 0;

  if (lineTax.isEnabled) {
    if (taxDisplayMode === 'split') {
      if (isInvoiceColumnVisible(columns, INVOICE_COL_CGST)) {
        cgst = roundInvoiceAmount((taxable * lineTax.cgstRate) / 100);
      }
      if (isInvoiceColumnVisible(columns, INVOICE_COL_SGST)) {
        sgst = roundInvoiceAmount((taxable * lineTax.sgstRate) / 100);
      }
    } else if (taxDisplayMode === 'igst') {
      if (isInvoiceColumnVisible(columns, INVOICE_COL_IGST)) {
        igst = roundInvoiceAmount((taxable * getIgstRate(lineTax)) / 100);
      }
    } else if (isInvoiceColumnVisible(columns, INVOICE_COL_GST)) {
      gst = roundInvoiceAmount((taxable * getCombinedGstRate(lineTax)) / 100);
    }
  }

  const total = getInvoiceLineTotal(
    cells,
    lineTax,
    columns,
    { discountMode, taxDisplayMode },
    { taxable, cgst, sgst, gst, igst }
  );
  return { taxable, cgst, sgst, gst, igst, total };
}

export function getInvoiceLineTotal(
  cells: Record<string, string>,
  tax: TaxSettings = EMPTY_TAX_SETTINGS,
  columns: ProductTableColumn[] = [],
  calcOptions: {
    discountMode?: InvoiceDiscountMode;
    taxDisplayMode?: InvoiceTaxDisplayMode;
  } = {},
  amounts?: { taxable: number; cgst: number; sgst: number; gst: number; igst: number }
): number {
  const taxDisplayMode = calcOptions.taxDisplayMode ?? 'split';
  const computed =
    amounts ??
    calculateInvoiceAmounts(cells, tax, columns, calcOptions);

  const parts: Array<[string, number]> =
    taxDisplayMode === 'split'
      ? [
          [INVOICE_COL_TAXABLE, computed.taxable],
          [INVOICE_COL_CGST, computed.cgst],
          [INVOICE_COL_SGST, computed.sgst],
        ]
      : taxDisplayMode === 'igst'
        ? [
            [INVOICE_COL_TAXABLE, computed.taxable],
            [INVOICE_COL_IGST, computed.igst],
          ]
        : [
            [INVOICE_COL_TAXABLE, computed.taxable],
            [INVOICE_COL_GST, computed.gst],
          ];

  const visibleParts = parts.filter(([columnId]) => isInvoiceColumnVisible(columns, columnId));
  if (visibleParts.length > 0) {
    return roundInvoiceAmount(visibleParts.reduce((sum, [, value]) => sum + value, 0));
  }
  if (isInvoiceColumnVisible(columns, INVOICE_COL_TOTAL)) {
    return roundInvoiceAmount(
      computed.taxable + computed.cgst + computed.sgst + computed.gst + computed.igst
    );
  }
  return 0;
}

export function recalculateInvoiceRow(
  row: ProductTableRow,
  tax: TaxSettings = EMPTY_TAX_SETTINGS,
  columns: ProductTableColumn[] = [],
  calcOptions: {
    discountMode?: InvoiceDiscountMode;
    taxDisplayMode?: InvoiceTaxDisplayMode;
  } = {}
): ProductTableRow {
  const { taxable, cgst, sgst, gst, igst, total } = calculateInvoiceAmounts(
    row.cells,
    tax,
    columns,
    calcOptions
  );
  return {
    ...row,
    cells: {
      ...row.cells,
      [INVOICE_COL_TAXABLE]: formatInvoiceAmount(taxable),
      [INVOICE_COL_CGST]: formatInvoiceAmount(cgst),
      [INVOICE_COL_SGST]: formatInvoiceAmount(sgst),
      [INVOICE_COL_GST]: formatInvoiceAmount(gst),
      [INVOICE_COL_IGST]: formatInvoiceAmount(igst),
      [INVOICE_COL_TOTAL]: formatInvoiceAmount(total),
    },
  };
}

function invoiceCalcOptions(props: InvoiceTableProps) {
  return {
    discountMode: normalizeInvoiceDiscountMode(props.discountMode),
    taxDisplayMode: normalizeInvoiceTaxDisplayMode(props.taxDisplayMode),
  };
}

export function recalculateInvoiceTable(
  props: InvoiceTableProps,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTableProps {
  const calcOptions = invoiceCalcOptions(props);
  const withSerial = applySerialNumbers(props);
  return {
    ...withSerial,
    rows: withSerial.rows.map((row) =>
      recalculateInvoiceRow(row, tax, withSerial.columns, calcOptions)
    ),
  };
}

export function getInvoiceGrandTotal(
  rows: ProductTableRow[],
  tax: TaxSettings = EMPTY_TAX_SETTINGS,
  columns: ProductTableColumn[] = [],
  calcOptions: {
    discountMode?: InvoiceDiscountMode;
    taxDisplayMode?: InvoiceTaxDisplayMode;
  } = {}
): number {
  return rows.reduce(
    (sum, row) => sum + getInvoiceLineTotal(row.cells, tax, columns, calcOptions),
    0
  );
}

export function getInvoiceGrandTotalFormatted(
  rows: ProductTableRow[],
  tax: TaxSettings = EMPTY_TAX_SETTINGS,
  columns: ProductTableColumn[] = [],
  calcOptions: {
    discountMode?: InvoiceDiscountMode;
    taxDisplayMode?: InvoiceTaxDisplayMode;
  } = {}
): string {
  return formatInvoiceAmount(getInvoiceGrandTotal(rows, tax, columns, calcOptions));
}

function normalizeInvoiceRows(
  rows: ProductTableRow[],
  columns: ProductTableColumn[],
  allowEmpty = false
): ProductTableRow[] {
  if (rows.length === 0 && allowEmpty) return [];
  const source = rows.length > 0 ? rows : DEFAULT_INVOICE_TABLE_PROPS.rows;
  const normalized = source.map((row, index) => {
    const cells: Record<string, string> = {};
    // Keep product-pick metadata (e.g. __productGstRate) so GST survives normalize.
    Object.entries(row.cells ?? {}).forEach(([key, value]) => {
      if (key.startsWith('__')) cells[key] = String(value ?? '');
    });
    columns.forEach((col) => {
      cells[col.id] = String(row.cells?.[col.id] ?? '');
    });
    return {
      id: String(row.id || uuidv4()),
      name: String(row.name || `Row ${index + 1}`),
      cells,
      heightPx:
        typeof row.heightPx === 'number' && row.heightPx > 0 ? row.heightPx : DEFAULT_ROW_HEIGHT_PX,
    };
  });
  return normalized.map((row) =>
    recalculateInvoiceRow(row, EMPTY_TAX_SETTINGS, columns, {
      discountMode: 'amount',
      taxDisplayMode: 'split',
    })
  );
}

export function isInvoiceComputedColumn(columnId: string): boolean {
  return (
    columnId === INVOICE_COL_TAXABLE ||
    columnId === INVOICE_COL_CGST ||
    columnId === INVOICE_COL_SGST ||
    columnId === INVOICE_COL_GST ||
    columnId === INVOICE_COL_IGST ||
    columnId === INVOICE_COL_TOTAL
  );
}

export function updateInvoiceCell(
  props: InvoiceTableProps,
  rowId: string,
  columnId: string,
  value: string,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTableProps {
  if (isInvoiceComputedColumn(columnId)) return props;
  return recalculateInvoiceTable(updateCell(props, rowId, columnId, value), tax);
}

export function normalizeInvoiceTableProps(raw: Record<string, unknown> = {}): InvoiceTableProps {
  if (!Array.isArray(raw.columns) || raw.columns.length === 0) {
    return structuredClone(DEFAULT_INVOICE_TABLE_PROPS);
  }

  const discountMode = normalizeInvoiceDiscountMode(raw.discountMode);
  const taxDisplayMode = normalizeInvoiceTaxDisplayMode(raw.taxDisplayMode);
  const columns = normalizeInvoiceColumns(
    raw.columns as ProductTableColumn[],
    taxDisplayMode,
    discountMode
  );
  const base: InvoiceTableProps = {
    columns,
    discountMode,
    taxDisplayMode,
    rows: normalizeInvoiceRows(
      Array.isArray(raw.rows) ? (raw.rows as ProductTableRow[]) : [],
      columns,
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
    showGrandTotalFooter: raw.showGrandTotalFooter !== false,
    showAmountInWords: raw.showAmountInWords !== false,
    grandTotalFooterHeightPx:
      typeof raw.grandTotalFooterHeightPx === 'number' && raw.grandTotalFooterHeightPx > 0
        ? raw.grandTotalFooterHeightPx
        : DEFAULT_ROW_HEIGHT_PX,
    headerStyles: normalizeStyleMap(raw.headerStyles),
    cellStyles: normalizeStyleMap(raw.cellStyles),
    showProductSku: normalizeShowProductSku(raw.showProductSku),
  };
  return recalculateInvoiceTable(base);
}

export const invoiceTablePropsToRecord = productTablePropsToRecord;

function firstFixedColumnIndex(columns: ProductTableColumn[]): number {
  return columns.findIndex((col) => isInvoiceFixedColumn(col.id));
}

export function addInvoiceColumn(
  props: InvoiceTableProps,
  columnType: TableColumnType = 'na'
): InvoiceTableProps {
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

  const rows = props.rows.map((row, rowIndex) =>
    recalculateInvoiceRow(
      {
        ...row,
        cells: {
          ...row.cells,
          [column.id]: column.columnType === 'sr_no' ? String(rowIndex + 1) : '',
        },
      },
      EMPTY_TAX_SETTINGS,
      columns,
      invoiceCalcOptions(props)
    )
  );

  return applySerialNumbers({ ...props, columns, rows });
}

export function removeInvoiceColumn(props: InvoiceTableProps, columnId: string): InvoiceTableProps {
  if (isInvoiceFixedColumn(columnId)) return props;

  const flexibleCount = props.columns.filter((col) => !isInvoiceFixedColumn(col.id)).length;
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

  return {
    ...props,
    columns,
    rows: props.rows.map((row) => {
      const cells = { ...row.cells };
      delete cells[columnId];
      return recalculateInvoiceRow({ ...row, cells }, EMPTY_TAX_SETTINGS, columns, invoiceCalcOptions({
        ...props,
        columns,
      }));
    }),
  };
}

export function updateInvoiceColumnLabel(
  props: InvoiceTableProps,
  columnId: string,
  label: string
): InvoiceTableProps {
  if (isInvoiceFixedColumn(columnId)) return props;
  return updateColumnLabel(props, columnId, label);
}

export function moveInvoiceColumn(
  props: InvoiceTableProps,
  columnId: string,
  direction: -1 | 1
): InvoiceTableProps {
  if (isInvoiceFixedColumn(columnId)) return props;

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

export function getInvoiceFlexibleColumnBounds(columns: ProductTableColumn[]): {
  start: number;
  end: number;
} {
  const fixedIndex = firstFixedColumnIndex(columns);
  return { start: 0, end: fixedIndex === -1 ? columns.length : fixedIndex };
}

export function reorderInvoiceFlexibleColumns(
  props: InvoiceTableProps,
  activeId: string,
  overId: string
): InvoiceTableProps {
  const { end } = getInvoiceFlexibleColumnBounds(props.columns);
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

export function setInvoiceDiscountMode(
  props: InvoiceTableProps,
  mode: InvoiceDiscountMode,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTableProps {
  const columns = props.columns.map((col) =>
    col.id === INVOICE_COL_DISCOUNT
      ? { ...col, label: discountColumnLabel(mode) }
      : col
  );
  return recalculateInvoiceTable({ ...props, columns, discountMode: mode }, tax);
}

export function setInvoiceTaxDisplayMode(
  props: InvoiceTableProps,
  mode: InvoiceTaxDisplayMode,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTableProps {
  const discountMode = normalizeInvoiceDiscountMode(props.discountMode);
  const flexible = props.columns.filter((col) => !isInvoiceFixedColumn(col.id));
  const columns = normalizeInvoiceColumns(
    [...flexible, ...props.columns.filter((col) => isInvoiceFixedColumn(col.id))],
    mode,
    discountMode
  );
  return recalculateInvoiceTable({ ...props, columns, taxDisplayMode: mode }, tax);
}

export function setInvoiceColumnVisible(
  props: InvoiceTableProps,
  columnId: string,
  visible: boolean,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTableProps {
  if (isInvoiceTaxColumn(columnId)) return props;

  const visibleCount = props.columns.filter((col) => col.visible !== false).length;
  if (!visible && visibleCount <= 1) return props;

  const columns = props.columns.map((col) =>
    col.id === columnId ? { ...col, visible } : col
  );
  return recalculateInvoiceTable({ ...props, columns }, tax);
}

function inheritLastRowGstRate(rows: ProductTableRow[]): string | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row && PRODUCT_GST_RATE_KEY in row.cells) {
      const val = row.cells[PRODUCT_GST_RATE_KEY];
      if (val != null && val !== '') return val;
    }
  }
  return null;
}

export function addInvoiceRow(
  props: InvoiceTableProps,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): InvoiceTableProps {
  const base = addRow(props);
  const gstRate = inheritLastRowGstRate(props.rows);
  if (gstRate != null) {
    const newRowIndex = base.rows.length - 1;
    base.rows[newRowIndex] = {
      ...base.rows[newRowIndex],
      cells: {
        ...base.rows[newRowIndex].cells,
        [PRODUCT_GST_RATE_KEY]: gstRate,
      },
    };
  }
  return recalculateInvoiceTable(base, tax);
}

/** Invoice-aware cell update (recalculates taxable/total). */
export { updateInvoiceCell as updateCell };

/** Invoice-aware row add (recalculates amounts). */
export { addInvoiceRow as addRow };

export {
  updateColumnWidthPx,
  updateHeaderHeight,
  updateRowName,
  updateRowHeight,
  removeRow,
  getTableTotalWidth,
  getVisibleTableColumns,
  getDisplayTableTotalWidth,
  MIN_COL_WIDTH_PX,
  MIN_ROW_HEIGHT_PX,
  MIN_BORDER_WIDTH_PX,
  MAX_BORDER_WIDTH_PX,
  clampBorderOpacity,
  clampBorderWidth,
} from './product-table';
