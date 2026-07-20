import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import { TableMoveHandle } from './builder-resize-handles';
import {
  updateElement,
  selectTableCell,
  setTableCellsSelection,
  selectElement,
  clearTableCellSelection,
} from '@/store/slices/builderSlice';
import type { SelectedTableCell } from '@/store/slices/builderSlice';
import type { ProductTableRow } from '@/features/builder/product-table';
import {
  DEFAULT_ROW_HEIGHT_PX,
  DEFAULT_AMOUNT_IN_WORDS_HEIGHT_PX,
  TABLE_CELL_LINE_HEIGHT,
  getTableBorderCss,
  getTableCellFocusOrder,
  getTableCellStyle,
  getTableCellsInRect,
  getTableHeaderBackground,
  getDisplayTableTotalWidth,
  getScaledColumnWidths,
  productTablePropsToRecord,
  mergeTablePaginationProps,
  fitTableHeaderHeightToText,
  fitTableRowHeightsToText,
  isTableWrapFriendlyColumn,
  tableCellRefKey,
  updateCell,
  updateColumnLabel,
  isSameTableCell,
  isSerialColumn,
  isProductLikeColumn,
  displayColumnLabel,
  recalculateProductTable,
  tableHasSkuColumn,
  type ProductTableProps,
  type TableCellRef,
  type TableCellStyle,
  type TableGridCoord,
} from './product-table';
import { ProductCellSelect } from './ProductCellSelect';
import { applyProductPickToTable } from './product-cell';
import type { CompanyProductOption } from './use-company-products';
import { normalizeTablePropsForType, resolveTableElementType } from './table-props-normalize';
import { getPageDimensions } from './builder-dnd';
import { refreshTablePropsForLivePreview, isSummaryOnlyTable } from './composer-table-preview';
import {
  updateInvoiceCell,
  isInvoiceComputedColumn,
  isInvoiceTable1Type,
  INVOICE_COL_TOTAL,
  getInvoiceGrandTotalFormatted,
  recalculateInvoiceTable,
  getVisibleInvoiceColumns,
  type InvoiceTableProps,
} from './invoice-table';
import {
  applyInvoice2CellEdits,
  isInvoice2ComputedColumn,
  isInvoice2SummaryRowId,
  isInvoiceTable2Type,
  recalculateInvoiceTable2,
  resolveInvoice2SummaryRows,
  getVisibleInvoice2Columns,
  resolveInvoice2TaxOptions,
  getInvoice2SummaryGap,
  getInvoice2SummaryGridRowIndex,
  getInvoice2SummaryLayout,
  getInvoice2SummaryCellText,
  getInvoice2SummaryColumnIndices,
  getInvoice2TableCellFocusOrder,
  getInvoice2DisplayCellsInRect,
  INVOICE2_SUMMARY_COL_LABEL,
  INVOICE2_SUMMARY_COL_VALUE,
  type InvoiceTable2Props,
} from './invoice-table-2';
import {
  isInvoice3ComputedColumn,
  isInvoiceTable3Type,
  recalculateInvoiceTable3,
  normalizeInvoiceTable3Props,
  getVisibleInvoice3Columns,
  getInvoice3GrandTotalFormatted,
  getInvoice3TotalFooterGap,
  getInvoice3TotalFooterHeight,
  INVOICE3_COL_TOTAL,
  type InvoiceTable3Props,
} from './invoice-table-3';
import { resolveTableElementSize } from './table-element-size';
import { useTaxSettings } from './TaxSettingsProvider';
import { useProductSettings } from './ProductSettingsProvider';
import { resolveShowProductSku } from './product-settings';
import type { TaxSettings } from './tax-settings';
import type { CanvasInteractionMode } from './builder-interaction';
import { amountInWords, parseFormattedAmount } from './amount-in-words';

const PREVIEW_PAGINATION_ROWS_KEY = '__previewPaginationRows';
const PREVIEW_PAGINATION_RANGE_START_KEY = '__previewPaginationStart';
const PREVIEW_PAGINATION_RANGE_END_KEY = '__previewPaginationEnd';
const PREVIEW_PAGINATION_SHOW_TOTALS_KEY = '__previewPaginationShowTotals';

function pendingCellKey(rowId: string, columnId: string) {
  return `${rowId}\0${columnId}`;
}

function mergeFittedRowHeights(
  full: ProductTableProps,
  fittedSegment: ProductTableProps
): ProductTableProps['rows'] {
  const fittedById = new Map(fittedSegment.rows.map((row) => [row.id, row]));
  return full.rows.map((row) => {
    const fitted = fittedById.get(row.id);
    if (!fitted || fitted.heightPx === row.heightPx) return row;
    return { ...row, heightPx: fitted.heightPx };
  });
}

function resolveCellDisplayText(
  rowId: string,
  columnId: string,
  cells: Record<string, string>,
  pending: Record<string, string>
): string {
  const key = pendingCellKey(rowId, columnId);
  if (key in pending) return pending[key];
  return cells[columnId] || '';
}

function applyPendingCellEdits(
  table: ProductTableProps,
  pending: Record<string, string>
): ProductTableProps {
  if (Object.keys(pending).length === 0) return table;
  return {
    ...table,
    rows: table.rows.map((row) => {
      let cells = row.cells;
      for (const col of table.columns) {
        const key = pendingCellKey(row.id, col.id);
        if (key in pending) {
          if (cells === row.cells) cells = { ...row.cells };
          cells[col.id] = pending[key];
        }
      }
      return cells === row.cells ? row : { ...row, cells };
    }),
  };
}

function applyInvoice2PendingEdits(
  props: InvoiceTable2Props,
  pending: Record<string, string>,
  tax: TaxSettings,
  rowsForSummary?: ProductTableRow[]
): InvoiceTable2Props {
  if (Object.keys(pending).length === 0) {
    return recalculateInvoiceTable2(props, tax, rowsForSummary);
  }

  const edits: Array<{ rowId: string; columnId: string; value: string }> = [];
  for (const [key, value] of Object.entries(pending)) {
    const sep = key.indexOf('\0');
    edits.push({
      rowId: key.slice(0, sep),
      columnId: key.slice(sep + 1),
      value,
    });
  }

  const recalculated = applyInvoice2CellEdits(props, edits, tax);
  const hasSummaryPending = edits.some(({ rowId }) => isInvoice2SummaryRowId(rowId));
  if (!hasSummaryPending || !recalculated.summaryRows?.length) {
    return recalculated;
  }

  return recalculated;
}

function applyInvoice3PendingEdits(
  props: InvoiceTable3Props,
  pending: Record<string, string>,
  tax: TaxSettings
): InvoiceTable3Props {
  const withEdits = applyPendingCellEdits(props, pending) as InvoiceTable3Props;
  return recalculateInvoiceTable3(withEdits, tax);
}

function placeCaretFromPointer(el: HTMLElement, clientX: number, clientY: number) {
  el.focus();
  const doc = document;
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(clientX, clientY);
    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
  }
  const pos = (
    doc as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    }
  ).caretPositionFromPoint?.(clientX, clientY);
  if (pos) {
    const range = doc.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
}

interface ProductTableViewProps {
  elementId: string;
  elementType?: string;
  props: Record<string, unknown>;
  containerWidth: number;
  containerHeight: number;
  previewMode?: boolean;
  /** Invoice composer passes pre-calculated table props — skip preview re-normalize/recalc. */
  trustTableProps?: boolean;
  /** Composer live preview: persist cell edits without Redux. */
  onTableCellChange?: (rowId: string, columnId: string, value: string) => void;
  /** Composer live preview: catalog pick updates product + rate together. */
  onTableProductPick?: (
    rowId: string,
    columnId: string,
    product: CompanyProductOption
  ) => void;
  locked?: boolean;
  isSelected?: boolean;
  interactionMode?: CanvasInteractionMode;
  onInteractionModeChange?: (mode: CanvasInteractionMode) => void;
}

interface TableEditContextValue {
  registerCell: (key: string, el: HTMLDivElement | null) => void;
  focusAdjacent: (current: TableCellRef, direction: 1 | -1) => void;
  elementId: string;
  locked: boolean;
  interactionMode: CanvasInteractionMode;
  editingCellKey: string | null;
  onCellPointerDown: (
    e: React.PointerEvent,
    cellRef: TableCellRef,
    coord: TableGridCoord,
    editorEl: HTMLDivElement | null
  ) => void;
  onCellPointerEnter: (e: React.PointerEvent, cellRef: TableCellRef, coord: TableGridCoord) => void;
  onSelectCell: (cellRef: TableCellRef, coord: TableGridCoord, extend?: boolean) => void;
  onCellEditEnd: (key: string) => void;
}

const TableEditContext = createContext<TableEditContextValue | null>(null);

function cellTextStyle(style: TableCellStyle, isHeaderRow: boolean): React.CSSProperties {
  const textAlign = style.textAlign ?? 'left';
  return {
    textAlign,
    textJustify: textAlign === 'justify' ? 'inter-word' : undefined,
    fontWeight: style.fontWeight ?? (isHeaderRow ? 600 : 400),
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: style.underline ? 'underline' : 'none',
    color: style.color ?? (isHeaderRow ? '#1f2937' : '#374151'),
    fontSize: style.fontSize ?? 12,
    fontFamily: style.fontFamily ?? 'Inter, sans-serif',
    lineHeight: TABLE_CELL_LINE_HEIGHT,
    userSelect: 'text',
    WebkitUserSelect: 'text',
  };
}

function toSelectedCell(ref: TableCellRef): SelectedTableCell {
  return {
    elementId: ref.elementId,
    rowId: ref.rowId,
    columnId: ref.columnId,
    isHeader: ref.isHeader,
  };
}

interface TableCellProps {
  cellRef: TableCellRef;
  gridCoord: TableGridCoord;
  table: ProductTableProps;
  text: string;
  width: number;
  height: number;
  borderRight?: string;
  borderBottom?: string;
  isHeaderRow?: boolean;
  previewMode: boolean;
  readOnly?: boolean;
  staticText?: boolean;
  editorClassName?: string;
  forceTextAlign?: 'left' | 'right' | 'center';
  /** When false, preview shows a single truncated line (qty, rate, totals, etc.). */
  wrapText?: boolean;
  onLiveChange?: (value: string) => void;
  onCommit: (value: string, options?: { recordHistory?: boolean }) => void;
  /** When false, keystrokes only call onLiveChange; commit happens on blur. */
  commitOnInput?: boolean;
}

function TableCell({
  cellRef,
  gridCoord,
  table,
  text,
  width,
  height,
  borderRight,
  borderBottom,
  isHeaderRow,
  previewMode,
  readOnly = false,
  staticText = false,
  editorClassName,
  forceTextAlign,
  wrapText = true,
  onLiveChange,
  onCommit,
  commitOnInput = true,
}: TableCellProps) {
  const dispatch = useAppDispatch();
  const ctx = useContext(TableEditContext);
  const editorRef = useRef<HTMLDivElement>(null);
  const key = tableCellRefKey(cellRef);
  const style = {
    ...getTableCellStyle(table, cellRef.rowId, cellRef.columnId, cellRef.isHeader),
    ...(forceTextAlign ? { textAlign: forceTextAlign } : {}),
  };
  const isTableSelected = useAppSelector((s) =>
    s.builder.selectedElementIds.includes(cellRef.elementId)
  );
  const isCellSelected = useAppSelector((s) =>
    s.builder.selectedTableCells.some(
      (c) => c.elementId === cellRef.elementId && isSameTableCell(c, cellRef)
    )
  );
  const isEditing = ctx?.editingCellKey === key;
  const editStartValueRef = useRef(text);

  useEffect(() => {
    if (isEditing) editStartValueRef.current = text;
  }, [isEditing]);

  useEffect(() => {
    if (ctx) ctx.registerCell(key, editorRef.current);
    return () => ctx?.registerCell(key, null);
  }, [ctx, key]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || document.activeElement === el) return;
    el.textContent = text || '';
  }, [text]);

  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => editorRef.current?.focus());
    }
  }, [isEditing]);

  const isComputed = (readOnly || staticText) && !isHeaderRow;

  if (previewMode || staticText) {
    const compact = !wrapText;
    return (
      <div
        className="builder-table-cell box-border shrink-0 overflow-hidden"
        style={{
          width,
          height,
          borderRight,
          borderBottom,
        }}
      >
        <div
          ref={editorRef}
          className={`builder-table-cell-editor flex w-full h-full min-h-0 px-2 py-1 outline-none ${
            compact ? 'items-center' : 'items-start'
          } ${isHeaderRow ? 'font-semibold' : ''} ${editorClassName ?? ''} ${
            isComputed ? 'bg-gray-50 text-gray-700' : ''
          } ${isCellSelected ? 'bg-primary/10 ring-1 ring-inset ring-primary/35' : ''}`}
          style={{
            ...cellTextStyle(style, !!isHeaderRow),
            whiteSpace: compact ? 'nowrap' : 'pre-wrap',
            wordBreak: compact ? 'normal' : 'break-word',
            overflowWrap: compact ? undefined : 'anywhere',
            overflow: compact ? 'hidden' : 'hidden',
            textOverflow: compact ? 'ellipsis' : undefined,
            cursor: ctx?.locked || previewMode ? 'default' : 'cell',
          }}
          title={compact && text ? text : undefined}
          onPointerDown={(e) => {
            if (!ctx || ctx.locked || previewMode) return;
            if (ctx.interactionMode === 'move') return;
            e.stopPropagation();
            ctx.onSelectCell(cellRef, gridCoord, e.shiftKey);
          }}
          onPointerEnter={(e) => {
            if (!ctx || ctx.locked || !isTableSelected || previewMode) return;
            if (ctx.interactionMode === 'move') return;
            ctx.onCellPointerEnter(e, cellRef, gridCoord);
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className={`block w-full min-w-0 ${compact ? 'truncate' : ''} ${
              forceTextAlign === 'right' ? 'text-right tabular-nums' : ''
            } ${forceTextAlign === 'center' ? 'text-center' : ''}`}
          >
            {text || '\u00a0'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="builder-table-cell box-border shrink-0 overflow-hidden"
      style={{ width, height, borderRight, borderBottom }}
    >
      <div
        ref={editorRef}
        contentEditable={!ctx?.locked && isEditing && !isComputed}
        suppressContentEditableWarning
        tabIndex={isEditing && !isComputed ? 0 : -1}
        className={`builder-table-cell-editor h-full min-h-0 w-full overflow-hidden px-2 py-1 outline-none ${
          isHeaderRow ? 'font-semibold' : ''
        } ${editorClassName ?? ''} ${isComputed ? 'bg-gray-50 text-gray-700' : ''} ${
          isCellSelected && !isEditing ? 'bg-primary/10 ring-1 ring-inset ring-primary/35' : ''
        } ${isEditing ? 'bg-primary/5 ring-2 ring-inset ring-primary/50' : ''}`}
        style={{
          ...cellTextStyle(style, !!isHeaderRow),
          cursor:
            ctx?.locked || isComputed
              ? 'default'
              : ctx?.interactionMode === 'move'
                ? 'move'
                : isEditing
                  ? 'text'
                  : 'cell',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          userSelect: ctx?.interactionMode === 'move' || !isEditing ? 'none' : 'text',
          WebkitUserSelect: ctx?.interactionMode === 'move' || !isEditing ? 'none' : 'text',
        }}
        onPointerDown={(e) => {
          if (!ctx || ctx.locked) return;
          if (ctx.interactionMode === 'move') return;
          if (isComputed) {
            e.stopPropagation();
            ctx.onSelectCell(cellRef, gridCoord, e.shiftKey);
            return;
          }
          e.stopPropagation();
          if (isEditing) {
            return;
          }
          ctx.onCellPointerDown(e, cellRef, gridCoord, editorRef.current);
        }}
        onPointerEnter={(e) => {
          if (!ctx || ctx.locked || !isTableSelected || ctx.interactionMode === 'move') return;
          ctx.onCellPointerEnter(e, cellRef, gridCoord);
        }}
        onClick={(e) => {
          if (ctx?.interactionMode === 'move') return;
          e.stopPropagation();
        }}
        onInput={(e) => {
          if (isComputed) return;
          const value = e.currentTarget.textContent ?? '';
          onLiveChange?.(value);
          if (commitOnInput) {
            onCommit(value, { recordHistory: false });
          }
        }}
        onBlur={(e) => {
          if (isComputed) return;
          const value = e.currentTarget.textContent ?? '';
          if (value !== editStartValueRef.current) {
            onCommit(value, { recordHistory: true });
          }
          ctx?.onCellEditEnd?.(key);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Tab' && ctx) {
            e.preventDefault();
            ctx.focusAdjacent(cellRef, e.shiftKey ? -1 : 1);
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            dispatch(clearTableCellSelection());
            editorRef.current?.blur();
          }
        }}
      />
    </div>
  );
}

export function ProductTableView({
  elementId,
  elementType = 'product_table',
  props,
  containerWidth,
  containerHeight,
  previewMode = false,
  trustTableProps = false,
  onTableCellChange,
  onTableProductPick,
  locked = false,
  isSelected = false,
  interactionMode = 'move',
  onInteractionModeChange,
}: ProductTableViewProps) {
  const dispatch = useAppDispatch();
  const cellRegistry = useRef<Map<string, HTMLDivElement>>(new Map());
  const gridRef = useRef<HTMLDivElement>(null);
  const selectionAnchorRef = useRef<TableGridCoord | null>(null);
  const dragSessionRef = useRef<{
    pointerId: number;
    anchor: TableGridCoord;
    focus: TableGridCoord;
    focusRef: TableCellRef;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const [pendingCellEdits, setPendingCellEdits] = useState<Record<string, string>>({});
  const pendingEditsRef = useRef<Record<string, string>>({});
  const prevInteractionModeRef = useRef(interactionMode);

  const queuePendingEdit = useCallback((rowId: string, columnId: string, value: string) => {
    const key = pendingCellKey(rowId, columnId);
    const next = { ...pendingEditsRef.current, [key]: value };
    pendingEditsRef.current = next;
    flushSync(() => {
      setPendingCellEdits(next);
    });
  }, []);

  const isTableSelected = useAppSelector((s) =>
    s.builder.selectedElementIds.includes(elementId)
  );
  const { activePage, canvasElement } = useAppSelector((s) => {
    const page = s.builder.pages[s.builder.activePageIndex];
    return {
      activePage: page,
      canvasElement: page?.elements.find((el) => el.id === elementId),
    };
  });
  const resolvedElementType = resolveTableElementType(elementType ?? '', props);
  const isInvoiceTable1 = isInvoiceTable1Type(resolvedElementType);
  const isInvoiceTable2 = isInvoiceTable2Type(resolvedElementType);
  const isInvoiceTable3 = isInvoiceTable3Type(resolvedElementType);
  const isInvoiceLineTable = isInvoiceTable2 || isInvoiceTable3;
  const taxSettings = useTaxSettings();
  const productSettings = useProductSettings();
  const productPickerInteractive = !previewMode || !!onTableCellChange;

  useEffect(() => {
    pendingEditsRef.current = pendingCellEdits;
  }, [pendingCellEdits]);

  const table = useMemo(() => {
    if (trustTableProps && previewMode && Object.keys(pendingCellEdits).length === 0) {
      const previewTable = props as unknown as ProductTableProps;
      if (
        isSummaryOnlyTable(previewTable)
        && Array.isArray(previewTable.columns)
        && Array.isArray(previewTable.rows)
      ) {
        return previewTable;
      }
      return refreshTablePropsForLivePreview(elementType ?? '', props, taxSettings);
    }

    const base = isInvoiceTable3
      ? normalizeInvoiceTable3Props(props, taxSettings)
      : normalizeTablePropsForType(resolvedElementType, props);
    if (isInvoiceTable2) {
      const table2Base = base as InvoiceTable2Props;
      // On a split table this segment holds only its slice of rows — summarize
      // the whole table so the continuation page shows real totals, not 0.
      const summaryRows = resolveInvoice2SummaryRows(
        props as Record<string, unknown>,
        table2Base,
        table2Base.columns,
        table2Base.discountMode ?? 'amount'
      );
      if (previewMode && Object.keys(pendingCellEdits).length === 0) {
        return recalculateInvoiceTable2(table2Base, taxSettings, summaryRows);
      }
      return applyInvoice2PendingEdits(
        table2Base,
        pendingCellEdits,
        taxSettings,
        summaryRows
      );
    }
    if (isInvoiceTable3) {
      if (previewMode && Object.keys(pendingCellEdits).length === 0) {
        return base as InvoiceTable3Props;
      }
      return applyInvoice3PendingEdits(base as InvoiceTable3Props, pendingCellEdits, taxSettings);
    }
    const withEdits = applyPendingCellEdits(base, pendingCellEdits);
    if (isInvoiceTable1) {
      if (previewMode && Object.keys(pendingCellEdits).length === 0) {
        return withEdits;
      }
      return recalculateInvoiceTable(withEdits, taxSettings);
    }
    if (previewMode && Object.keys(pendingCellEdits).length === 0) {
      return withEdits;
    }
    return recalculateProductTable(withEdits);
  }, [
    elementType,
    props,
    isInvoiceTable1,
    isInvoiceTable2,
    isInvoiceTable3,
    taxSettings,
    pendingCellEdits,
    previewMode,
    trustTableProps,
  ]);

  const table2Props = isInvoiceTable2 ? (table as InvoiceTable2Props) : null;
  const table3Props = isInvoiceTable3 ? (table as InvoiceTable3Props) : null;
  const invoice2SummaryRows = table2Props?.summaryRows ?? [];

  useEffect(() => {
    setPendingCellEdits((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const base = isInvoiceTable3
        ? normalizeInvoiceTable3Props(props, taxSettings)
        : normalizeTablePropsForType(resolvedElementType, props);
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(prev)) {
        const sep = key.indexOf('\0');
        const rowId = key.slice(0, sep);
        const columnId = key.slice(sep + 1);
        const lineRow = base.rows.find((r) => r.id === rowId);
        const summaryRow =
          isInvoiceTable2Type(elementType ?? '')
            ? ((base as InvoiceTable2Props).summaryRows ?? []).find((r) => r.id === rowId)
            : undefined;
        const row = lineRow ?? summaryRow;
        if (row && row.cells[columnId] === prev[key]) {
          delete next[key];
          changed = true;
        }
      }
      if (changed) pendingEditsRef.current = next;
      return changed ? next : prev;
    });
  }, [props, elementType, isInvoiceTable3, taxSettings]);

  const safeColumns = Array.isArray(table.columns) ? table.columns : [];
  const safeRows = Array.isArray(table.rows) ? table.rows : [];
  const paginationAllRows = useMemo(() => {
    const raw = props as Record<string, unknown>;
    const stored = raw[PREVIEW_PAGINATION_ROWS_KEY];
    return Array.isArray(stored) ? (stored as ProductTableProps['rows']) : null;
  }, [props]);
  const paginationStart = useMemo(() => {
    const raw = props as Record<string, unknown>;
    const value = raw[PREVIEW_PAGINATION_RANGE_START_KEY];
    return typeof value === 'number' && value >= 0 ? Math.floor(value) : null;
  }, [props]);
  const paginationEnd = useMemo(() => {
    const raw = props as Record<string, unknown>;
    const value = raw[PREVIEW_PAGINATION_RANGE_END_KEY];
    return typeof value === 'number' && value >= 0 ? Math.floor(value) : null;
  }, [props]);
  const isPaginatedSegment =
    !!paginationAllRows
    && paginationStart != null
    && paginationEnd != null
    && paginationEnd >= paginationStart;
  /** Last page of a split table — show total once for the whole table. */
  const segmentFooterExplicitlyOff = isInvoiceTable2
    ? table2Props?.showSummaryTable === false
    : isInvoiceTable3
      ? table3Props?.showTotalFooter === false
      : table.showGrandTotalFooter === false;
  const isLastPaginationSegment =
    !isPaginatedSegment
    || (
      !!paginationAllRows
      && paginationEnd != null
      && paginationEnd >= paginationAllRows.length
      // Page-1 may hold every data row (end === rowCount) while a totals-only page-2
      // shell still owns the footer — honor explicit footer-off from pagination build.
      && !(
        paginationStart != null
        && paginationStart < paginationEnd
        && paginationEnd === paginationAllRows.length
        && segmentFooterExplicitlyOff
      )
    );
  const paginationShowTotals = useMemo(() => {
    const raw = props as Record<string, unknown>;
    const stored = raw[PREVIEW_PAGINATION_SHOW_TOTALS_KEY];
    if (typeof stored === 'boolean') return stored;
    // Split tables clear footers on page 1 — without the key, still treat as one table with totals.
    if (isPaginatedSegment) return true;
    if (isInvoiceTable2) return table2Props?.showSummaryTable !== false;
    if (isInvoiceTable3) return table3Props?.showTotalFooter !== false;
    return table.showGrandTotalFooter !== false;
  }, [
    props,
    isPaginatedSegment,
    isInvoiceTable2,
    isInvoiceTable3,
    table2Props,
    table3Props,
    table.showGrandTotalFooter,
  ]);
  const tableForEdit = useMemo(() => {
    if (!isPaginatedSegment || !paginationAllRows) return table;
    return { ...table, rows: paginationAllRows };
  }, [table, isPaginatedSegment, paginationAllRows]);
  const rowsForDisplay = useMemo(() => {
    if (!isPaginatedSegment || paginationStart == null || paginationEnd == null) return safeRows;
    // Totals-only page-2 shell after deleting the only continuation row — never show
    // a default Sample item body (normalizers used to inject one into rows: []).
    if (
      paginationAllRows
      && paginationStart === paginationEnd
      && paginationEnd === paginationAllRows.length
    ) {
      return [];
    }
    const source = paginationAllRows ?? safeRows;
    return source.slice(paginationStart, paginationEnd);
  }, [safeRows, isPaginatedSegment, paginationStart, paginationEnd, paginationAllRows]);
  const showProductSku = useMemo(
    () =>
      tableHasSkuColumn(table.columns)
        ? false
        : resolveShowProductSku(table.showProductSku, productSettings),
    [table.columns, table.showProductSku, productSettings]
  );

  const displayColumns = useMemo(() => {
    if (isInvoiceTable2) return getVisibleInvoice2Columns(safeColumns);
    if (isInvoiceTable3) return getVisibleInvoice3Columns(safeColumns);
    if (isInvoiceTable1) return getVisibleInvoiceColumns(safeColumns);
    return safeColumns;
  }, [isInvoiceTable1, isInvoiceTable2, isInvoiceTable3, safeColumns]);

  const displayTable = useMemo(() => {
    const base =
      displayColumns === safeColumns
        ? { ...tableForEdit, columns: safeColumns, rows: rowsForDisplay }
        : { ...tableForEdit, columns: displayColumns, rows: rowsForDisplay };
    const withRepeatedHeader =
      isPaginatedSegment && tableForEdit.showHeader !== false
        ? { ...base, showHeader: true }
        : base;
    // One table across pages: totals on the last segment (or totals-only page-2 shell).
    const isTotalsOnly =
      !!paginationAllRows
      && paginationStart != null
      && paginationEnd != null
      && paginationStart === paginationEnd
      && paginationEnd === paginationAllRows.length;
    const showTotalsHere =
      paginationShowTotals && (isTotalsOnly || isLastPaginationSegment);
    const withTotalsPolicy = {
      ...withRepeatedHeader,
      showGrandTotalFooter: isInvoiceTable1 ? showTotalsHere : withRepeatedHeader.showGrandTotalFooter,
      showTotalFooter: isInvoiceTable3 ? showTotalsHere : (withRepeatedHeader as InvoiceTable3Props).showTotalFooter,
      showSummaryTable: isInvoiceTable2 ? showTotalsHere : (withRepeatedHeader as InvoiceTable2Props).showSummaryTable,
      ...(isInvoiceTable2 && !showTotalsHere
        ? { summaryRows: [], computedSummaryRows: [] }
        : {}),
    };
    const columnWidths = displayColumns.map((col) => col.widthPx);
    let fitted = fitTableHeaderHeightToText(withTotalsPolicy, columnWidths);
    fitted = fitTableRowHeightsToText(fitted, columnWidths, { includeAllTextColumns: true });
    return fitted;
  }, [
    displayColumns,
    safeColumns,
    rowsForDisplay,
    tableForEdit,
    isPaginatedSegment,
    isLastPaginationSegment,
    paginationShowTotals,
    paginationAllRows,
    paginationStart,
    paginationEnd,
    isInvoiceTable1,
    isInvoiceTable2,
    isInvoiceTable3,
  ]);

  const displayRows = Array.isArray(displayTable.rows) ? displayTable.rows : [];
  const serialNumberOffset = paginationStart ?? 0;

  const tableCellFocusOrder = useMemo(
    () =>
      isInvoiceTable2 && table2Props
        ? getInvoice2TableCellFocusOrder(table2Props, elementId, displayColumns, invoice2SummaryRows)
        : getTableCellFocusOrder(displayTable, elementId),
    [isInvoiceTable2, table2Props, elementId, displayColumns, invoice2SummaryRows, displayTable]
  );

  const fittedElementSize = useMemo(
    () => resolveTableElementSize(elementType, displayTable),
    [elementType, displayTable]
  );

  const rowHeightSyncKey = useMemo(() => {
    const header = displayTable.headerHeightPx ?? 0;
    const rows = displayTable.rows.map((row) => `${row.id}:${row.heightPx}`).join('\0');
    return `${header}\0${rows}`;
  }, [displayTable]);

  const prevRowHeightSyncKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (previewMode || locked) return;
    const isFirstLayout = prevRowHeightSyncKeyRef.current === null;
    const heightsChanged = prevRowHeightSyncKeyRef.current !== rowHeightSyncKey;
    if (!isFirstLayout && !heightsChanged) return;
    prevRowHeightSyncKeyRef.current = rowHeightSyncKey;

    const heightDiff = Math.abs(containerHeight - fittedElementSize.height);
    if (heightDiff <= 1) return;

    const pageHeight = activePage ? getPageDimensions(activePage).height : 1123;
    const contentBottom = pageHeight - (activePage?.margins.bottom ?? 40);
    const elementY = canvasElement?.y ?? 0;
    const extendsPastPage =
      elementY + fittedElementSize.height > contentBottom + 1;

    dispatch(
      updateElement({
        id: elementId,
        changes: {
          props: mergeTablePaginationProps(
            props as Record<string, unknown>,
            productTablePropsToRecord(
              isPaginatedSegment && paginationAllRows
                ? { ...tableForEdit, rows: mergeFittedRowHeights(tableForEdit, displayTable) }
                : displayTable
            )
          ),
          height: fittedElementSize.height,
        },
        replaceProps: false,
        recordHistory: false,
        skipTableReflow: true,
        skipDocumentLayout: true,
      })
    );
  }, [
    rowHeightSyncKey,
    fittedElementSize.height,
    previewMode,
    locked,
    elementId,
    dispatch,
    containerHeight,
    displayTable,
    tableForEdit,
    isPaginatedSegment,
    paginationAllRows,
    activePage,
    canvasElement?.y,
  ]);

  const layoutTable = previewMode ? displayTable : table;
  const intrinsicWidth = Math.max(getDisplayTableTotalWidth(layoutTable), 1);
  const intrinsicHeight = Math.max(fittedElementSize.height, 1);
  const widthScale = containerWidth / intrinsicWidth || 1;
  const heightScale = containerHeight / intrinsicHeight || 1;
  const scale =
    previewMode && trustTableProps
      ? Math.min(widthScale, 1) || 1
      : previewMode
        ? Math.min(widthScale, heightScale, 1) || 1
        : Math.min(widthScale, heightScale, 1);

  const borderStyle = getTableBorderCss(table, scale);
  const scaledColumnWidths = useMemo(
    () => getScaledColumnWidths(displayColumns, scale),
    [displayColumns, scale]
  );
  // Match grid width to integer column widths so vertical borders stay crisp.
  const renderedWidth = useMemo(
    () => scaledColumnWidths.reduce((sum, w) => sum + w, 0),
    [scaledColumnWidths]
  );
  const renderedHeight = Math.round(intrinsicHeight * scale);
  const headerBackground = getTableHeaderBackground(table);
  const lastRowIndex = displayRows.length - 1;
  const isTotalsOnlySegment =
    !!paginationAllRows
    && paginationStart != null
    && paginationEnd != null
    && paginationStart === paginationEnd
    && paginationEnd === paginationAllRows.length;
  const showGrandTotalFooterHere =
    isInvoiceTable1
    && paginationShowTotals
    && (isTotalsOnlySegment || isLastPaginationSegment);
  const footerHeightPx = showGrandTotalFooterHere
    ? (table.grandTotalFooterHeightPx ?? DEFAULT_ROW_HEIGHT_PX)
    : 0;
  // Total for the whole table (all rows), not just this page's segment.
  const rowsForGrandTotal = paginationAllRows ?? displayRows;
  const grandTotalText = isInvoiceTable1
    ? getInvoiceGrandTotalFormatted(rowsForGrandTotal, taxSettings, safeColumns, {
        discountMode: (table as InvoiceTableProps).discountMode ?? 'amount',
        taxDisplayMode: (table as InvoiceTableProps).taxDisplayMode ?? 'split',
      })
    : '';

  const invoice2SummaryRowHeightPx = table2Props?.summaryRowHeightPx ?? DEFAULT_ROW_HEIGHT_PX;

  const showInvoice2Summary =
    isInvoiceTable2
    && (isTotalsOnlySegment || isLastPaginationSegment)
    && paginationShowTotals
    && (displayTable as InvoiceTable2Props).showSummaryTable !== false
    && invoice2SummaryRows.length > 0;
  const invoice2SummaryGapPx = showInvoice2Summary
    ? getInvoice2SummaryGap(table2Props!)
    : 0;
  const invoice2SummaryLayout = useMemo(
    () => (table2Props ? getInvoice2SummaryLayout(table2Props.columns) : null),
    [table2Props]
  );
  const invoice2SummaryColumnIndices = useMemo(
    () => getInvoice2SummaryColumnIndices(displayColumns),
    [displayColumns]
  );

  const invoice3GrandTotalText = useMemo(() => {
    if (!isInvoiceTable3 || !table3Props) return '';
    return getInvoice3GrandTotalFormatted(
      paginationAllRows ?? table3Props.rows,
      taxSettings,
      table3Props.columns,
      table3Props.discountMode ?? 'amount'
    );
  }, [isInvoiceTable3, table3Props, taxSettings, paginationAllRows]);

  const showInvoice3TotalFooter =
    isInvoiceTable3
    && (isTotalsOnlySegment || isLastPaginationSegment)
    && paginationShowTotals
    && (displayTable as InvoiceTable3Props).showTotalFooter !== false;
  const invoice3TotalFooterGapPx = showInvoice3TotalFooter && table3Props
    ? getInvoice3TotalFooterGap(table3Props)
    : 0;
  const invoice3TotalFooterHeightPx = showInvoice3TotalFooter && table3Props
    ? getInvoice3TotalFooterHeight(table3Props)
    : 0;
  const invoice3TotalFooterLabel = table3Props?.totalFooterLabel ?? 'TOTAL :-';
  const invoice2TotalText =
    invoice2SummaryRows.find(
      (row) =>
        getInvoice2SummaryCellText(row, INVOICE2_SUMMARY_COL_LABEL).trim().toUpperCase() === 'TOTAL'
    )
      ? getInvoice2SummaryCellText(
          invoice2SummaryRows.find(
            (row) =>
              getInvoice2SummaryCellText(row, INVOICE2_SUMMARY_COL_LABEL)
                .trim()
                .toUpperCase() === 'TOTAL'
          )!,
          INVOICE2_SUMMARY_COL_VALUE
        )
      : invoice2SummaryRows.length
        ? getInvoice2SummaryCellText(
            invoice2SummaryRows[invoice2SummaryRows.length - 1],
            INVOICE2_SUMMARY_COL_VALUE
          )
        : '';
  const amountInWordsText = amountInWords(
    parseFormattedAmount(
      isInvoiceTable1
        ? grandTotalText
        : isInvoiceTable2
          ? invoice2TotalText
          : invoice3GrandTotalText
    )
  );
  const showAmountInWords =
    table.showAmountInWords !== false
    && (showGrandTotalFooterHere || showInvoice2Summary || showInvoice3TotalFooter);

  const rowHasBottomBorder = (rowIndex: number) => {
    if (isInvoiceLineTable) return rowIndex < lastRowIndex;
    return rowIndex < lastRowIndex || showGrandTotalFooterHere;
  };

  const applyCellRange = useCallback(
    (anchor: TableGridCoord, focus: TableGridCoord, primary?: TableCellRef) => {
      const cells =
        isInvoiceTable2 && table2Props
          ? getInvoice2DisplayCellsInRect(
              displayColumns,
              table2Props,
              elementId,
              anchor,
              focus,
              invoice2SummaryRows
            )
          : getTableCellsInRect(displayTable, elementId, anchor, focus);
      const selected = cells.map(toSelectedCell);
      const primaryCell = primary ?? cells[cells.length - 1];
      dispatch(
        setTableCellsSelection({
          elementId,
          cells: selected,
          primary: primaryCell ? toSelectedCell(primaryCell) : undefined,
        })
      );
      selectionAnchorRef.current = anchor;
    },
    [
      dispatch,
      elementId,
      displayTable,
      displayColumns,
      isInvoiceTable2,
      table2Props,
      invoice2SummaryRows,
    ]
  );

  const selectAllCells = useCallback(() => {
    const order = tableCellFocusOrder;
    dispatch(
      setTableCellsSelection({
        elementId,
        cells: order.map(toSelectedCell),
        primary: order.length > 0 ? toSelectedCell(order[order.length - 1]) : undefined,
      })
    );
    setEditingCellKey(null);
    (document.activeElement as HTMLElement | null)?.blur?.();
  }, [dispatch, elementId, tableCellFocusOrder]);

  const finishDragSession = useCallback((dragging: boolean) => {
    if (dragging) {
      setEditingCellKey(null);
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  }, []);

  const onCellPointerDown = useCallback(
    (e: React.PointerEvent, cellRef: TableCellRef, coord: TableGridCoord, editorEl: HTMLDivElement | null) => {
      if (locked) return;

      if (e.shiftKey && selectionAnchorRef.current) {
        applyCellRange(selectionAnchorRef.current, coord, cellRef);
        setEditingCellKey(null);
        (document.activeElement as HTMLElement | null)?.blur?.();
        dragSessionRef.current = null;
        return;
      }

      const key = tableCellRefKey(cellRef);
      flushSync(() => {
        setEditingCellKey(key);
      });
      dispatch(selectTableCell({ cell: toSelectedCell(cellRef), extend: false }));
      applyCellRange(coord, coord, cellRef);

      requestAnimationFrame(() => {
        if (editorEl) {
          placeCaretFromPointer(editorEl, e.clientX, e.clientY);
        }
      });

      dragSessionRef.current = {
        pointerId: e.pointerId,
        anchor: coord,
        focus: coord,
        focusRef: cellRef,
        startX: e.clientX,
        startY: e.clientY,
        dragging: false,
      };
    },
    [applyCellRange, dispatch, locked]
  );

  const onSelectCell = useCallback(
    (cellRef: TableCellRef, coord: TableGridCoord, extend = false) => {
      if (locked) return;
      setEditingCellKey(null);
      if (extend && selectionAnchorRef.current) {
        applyCellRange(selectionAnchorRef.current, coord, cellRef);
        return;
      }
      dispatch(selectTableCell({ cell: toSelectedCell(cellRef), extend }));
      applyCellRange(coord, coord, cellRef);
      dragSessionRef.current = null;
    },
    [applyCellRange, dispatch, locked]
  );

  const onCellPointerEnter = useCallback(
    (e: React.PointerEvent, cellRef: TableCellRef, coord: TableGridCoord) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== e.pointerId || e.buttons !== 1) return;

      const sameCell =
        coord.rowIndex === session.anchor.rowIndex
        && coord.colIndex === session.anchor.colIndex;
      if (sameCell) return;

      session.dragging = true;
      session.focus = coord;
      session.focusRef = cellRef;
      setEditingCellKey(null);
      (document.activeElement as HTMLElement | null)?.blur?.();
      applyCellRange(session.anchor, coord, cellRef);
    },
    [applyCellRange]
  );

  useEffect(() => {
    if (previewMode || locked) return;

    const onPointerUp = (e: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;

      finishDragSession(session.dragging);
      dragSessionRef.current = null;
    };

    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [finishDragSession, locked, previewMode]);

  useEffect(() => {
    if (previewMode || locked) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'a') return;
      if (!isTableSelected) return;

      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select')) return;
      const editor = target.closest('[contenteditable="true"]');
      if (editor && !editor.classList.contains('builder-table-cell-editor')) return;

      e.preventDefault();
      e.stopPropagation();
      selectAllCells();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isTableSelected, locked, previewMode, selectAllCells]);

  useEffect(() => {
    if (prevInteractionModeRef.current !== 'move' && interactionMode === 'move') {
      setEditingCellKey(null);
    }
    prevInteractionModeRef.current = interactionMode;
  }, [interactionMode]);

  useEffect(() => {
    if (interactionMode !== 'edit' || !isTableSelected || previewMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setEditingCellKey(null);
      dispatch(clearTableCellSelection());
      onInteractionModeChange?.('move');
      (document.activeElement as HTMLElement | null)?.blur?.();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [interactionMode, isTableSelected, previewMode, onInteractionModeChange, dispatch]);

  const onCellEditEnd = useCallback((key: string) => {
    if (editingCellKey === key) {
      setEditingCellKey(null);
    }
  }, [editingCellKey]);

  const commitTable = useCallback(
    (next: ProductTableProps, recordHistory = true) => {
      let persisted = next;
      if (isInvoiceTable2) {
        persisted = recalculateInvoiceTable2(next as InvoiceTable2Props, taxSettings);
      } else if (isInvoiceTable3) {
        persisted = recalculateInvoiceTable3(next as InvoiceTable3Props, taxSettings);
      } else if (isInvoiceTable1) {
        persisted = recalculateInvoiceTable(next, taxSettings);
      }
      // Persist full row set when editing a paginated segment (including add/delete).
      if (isPaginatedSegment && paginationAllRows) {
        const segmentLen =
          paginationStart != null && paginationEnd != null
            ? paginationEnd - paginationStart
            : null;
        const isFullListEdit =
          next.rows.length === paginationAllRows.length
          || (segmentLen == null || next.rows.length !== segmentLen);
        if (isFullListEdit) {
          // Keep pagination range / table id from current props; only replace row lists.
          const record = {
            ...(props as Record<string, unknown>),
            ...productTablePropsToRecord(persisted),
          } as Record<string, unknown>;
          record.rows = persisted.rows;
          record[PREVIEW_PAGINATION_ROWS_KEY] = persisted.rows;
          dispatch(
            updateElement({
              id: elementId,
              changes: { props: record },
              replaceProps: true,
              recordHistory,
            })
          );
          return;
        }
      }
      dispatch(
        updateElement({
          id: elementId,
          changes: { props: productTablePropsToRecord(persisted) },
          replaceProps: true,
          recordHistory,
        })
      );
    },
    [
      dispatch,
      elementId,
      isInvoiceTable2,
      isInvoiceTable3,
      isInvoiceTable1,
      taxSettings,
      isPaginatedSegment,
      paginationAllRows,
      paginationStart,
      paginationEnd,
      props,
    ]
  );

  const commitInvoice3Pending = useCallback(
    (extra?: { rowId: string; columnId: string; value: string }, recordHistory = true) => {
      const merged = { ...pendingEditsRef.current };
      if (extra) {
        merged[pendingCellKey(extra.rowId, extra.columnId)] = extra.value;
      }
      if (Object.keys(merged).length === 0) return;

      const base = normalizeInvoiceTable3Props(props, taxSettings);
      const withEdits = applyPendingCellEdits(base, merged) as InvoiceTable3Props;

      pendingEditsRef.current = {};
      setPendingCellEdits({});
      commitTable(recalculateInvoiceTable3(withEdits, taxSettings), recordHistory);
    },
    [commitTable, elementType, props, taxSettings]
  );

  const commitInvoice2Pending = useCallback(
    (extra?: { rowId: string; columnId: string; value: string }, recordHistory = true) => {
      const merged = { ...pendingEditsRef.current };
      if (extra) {
        merged[pendingCellKey(extra.rowId, extra.columnId)] = extra.value;
      }
      if (Object.keys(merged).length === 0) return;

      const base = normalizeTablePropsForType(
        resolveTableElementType(elementType ?? '', props),
        props
      ) as InvoiceTable2Props;
      const edits = Object.entries(merged).map(([key, value]) => {
        const sep = key.indexOf('\0');
        return {
          rowId: key.slice(0, sep),
          columnId: key.slice(sep + 1),
          value,
        };
      });

      pendingEditsRef.current = {};
      setPendingCellEdits({});
      commitTable(applyInvoice2CellEdits(base, edits, taxSettings), recordHistory);
    },
    [commitTable, elementType, props, taxSettings]
  );

  const handleProductPick = useCallback(
    (rowId: string, columnId: string, product: CompanyProductOption) => {
      if (onTableProductPick) {
        onTableProductPick(rowId, columnId, product);
        return;
      }

      // Full row list when paginated — same as cell commits (segment-only misses other rows).
      let baseTable = tableForEdit;
      if (isInvoiceTable2 && Object.keys(pendingEditsRef.current).length > 0) {
        const base = normalizeTablePropsForType(
          resolveTableElementType(elementType ?? '', props),
          props
        ) as InvoiceTable2Props;
        baseTable = applyInvoice2PendingEdits(
          base,
          pendingEditsRef.current,
          taxSettings
        );
        pendingEditsRef.current = {};
        setPendingCellEdits({});
      } else if (
        (isInvoiceTable1 || isInvoiceTable3)
        && Object.keys(pendingEditsRef.current).length > 0
      ) {
        baseTable = applyPendingCellEdits(tableForEdit, pendingEditsRef.current);
        pendingEditsRef.current = {};
        setPendingCellEdits({});
      }

      const next = applyProductPickToTable(
        resolvedElementType,
        baseTable,
        rowId,
        columnId,
        product,
        showProductSku,
        taxSettings
      );
      commitTable(next, true);
    },
    [
      commitTable,
      elementType,
      isInvoiceTable1,
      isInvoiceTable2,
      isInvoiceTable3,
      onTableProductPick,
      props,
      resolvedElementType,
      tableForEdit,
      taxSettings,
      showProductSku,
    ]
  );

  const registerCell = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) cellRegistry.current.set(key, el);
    else cellRegistry.current.delete(key);
  }, []);

  const focusAdjacent = useCallback(
    (current: TableCellRef, direction: 1 | -1) => {
      const order = tableCellFocusOrder;
      const idx = order.findIndex(
        (c) =>
          c.columnId === current.columnId
          && c.isHeader === current.isHeader
          && c.rowId === current.rowId
      );
      if (idx === -1) return;
      const next = order[idx + direction];
      if (!next) return;
      const key = tableCellRefKey(next);
      const isSummaryCell =
        isInvoiceTable2
        && next.rowId
        && isInvoice2SummaryRowId(next.rowId)
        && (
          next.columnId === INVOICE2_SUMMARY_COL_LABEL
          || next.columnId === INVOICE2_SUMMARY_COL_VALUE
        );
      const nextCol = displayColumns.find((col) => col.id === next.columnId);
      const isComputedTarget =
        (nextCol != null && isSerialColumn(nextCol))
        || (nextCol != null && isProductLikeColumn(nextCol))
        || (isInvoiceTable1 && isInvoiceComputedColumn(next.columnId))
        || (isInvoiceTable2 && isInvoice2ComputedColumn(next.columnId, next.rowId, displayColumns))
        || (isInvoiceTable3 && isInvoice3ComputedColumn(next.columnId))
        || isSummaryCell;
      if (isComputedTarget) {
        setEditingCellKey(null);
        dispatch(selectTableCell({ cell: toSelectedCell(next), extend: false }));
        requestAnimationFrame(() => cellRegistry.current.get(key)?.focus());
        return;
      }
      setEditingCellKey(key);
      dispatch(selectTableCell({ cell: toSelectedCell(next), extend: false }));
      requestAnimationFrame(() => cellRegistry.current.get(key)?.focus());
    },
    [dispatch, tableCellFocusOrder, displayColumns, isInvoiceTable1, isInvoiceTable2, isInvoiceTable3]
  );

  const ctxValue: TableEditContextValue = {
    registerCell,
    focusAdjacent,
    elementId,
    locked,
    interactionMode,
    editingCellKey,
    onCellPointerDown,
    onCellPointerEnter,
    onSelectCell,
    onCellEditEnd,
  };

  const showChrome = (isSelected || isTableSelected) && !previewMode && !locked;
  const isMoveMode = interactionMode === 'move';

  return (
    <TableEditContext.Provider value={ctxValue}>
      <div
        data-table-id={elementId}
        className="builder-table-surface relative h-full w-full overflow-visible text-xs"
        onPointerDown={(e) => {
          if (previewMode) return;
          // Move only via the bottom move control — never drag from the table body.
          if ((e.target as HTMLElement).closest('.builder-table-move-handle')) return;
          if (isMoveMode) {
            if ((e.target as HTMLElement).closest('.builder-table-product-cell, .product-cell-select')) return;
            // Select on press; do not start a table-body drag.
            dispatch(selectElement(elementId));
            dispatch(clearTableCellSelection());
            setEditingCellKey(null);
            return;
          }
          if ((e.target as HTMLElement).closest('.builder-table-cell-editor, .builder-table-product-cell, .product-cell-select')) {
            return;
          }
          dispatch(clearTableCellSelection());
          dispatch(selectElement(elementId));
          setEditingCellKey(null);
        }}
        onDoubleClick={(e) => {
          if (previewMode || locked || !isMoveMode) return;
          e.stopPropagation();
          onInteractionModeChange?.('edit');
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!previewMode && !locked) {
            dispatch(selectElement(elementId));
          }
        }}
      >
        {showChrome && (
          <div
            className="pointer-events-auto absolute left-1/2 z-[100] -translate-x-1/2"
            style={{ bottom: -52 }}
          >
            <TableMoveHandle />
          </div>
        )}

        <div
          ref={gridRef}
          className="builder-table-grid builder-table-no-drag absolute left-0 top-0 flex flex-col box-border"
          style={
            isInvoiceLineTable
              ? { width: renderedWidth, height: renderedHeight }
              : {
                  width: renderedWidth,
                  height: renderedHeight,
                  borderTop: borderStyle,
                  borderLeft: borderStyle,
                  borderBottom: borderStyle,
                }
          }
        >
          <div
            className="flex shrink-0 flex-col box-border"
            style={
              isInvoiceLineTable
                ? {
                    width: renderedWidth,
                    borderTop: borderStyle,
                    borderLeft: borderStyle,
                    borderBottom: borderStyle,
                  }
                : undefined
            }
          >
          {table.showHeader && (
            <div
              className="relative flex shrink-0"
              style={{
                height: layoutTable.headerHeightPx * scale,
                backgroundColor: headerBackground,
              }}
            >
              {displayColumns.map((col, colIndex) => {
                const cellRef: TableCellRef = {
                  elementId,
                  rowId: null,
                  columnId: col.id,
                  isHeader: true,
                };
                const gridCoord: TableGridCoord = { rowIndex: 0, colIndex };
                return (
                  <TableCell
                    key={col.id}
                    cellRef={cellRef}
                    gridCoord={gridCoord}
                    table={displayTable}
                    isHeaderRow
                    text={displayColumnLabel(col)}
                    width={scaledColumnWidths[colIndex]}
                    height={layoutTable.headerHeightPx * scale}
                    borderRight={borderStyle}
                    borderBottom={borderStyle}
                    previewMode={previewMode}
                    wrapText
                    onCommit={(value, options) => {
                      // Keep user-entered names; only fall back when the header was never named.
                      const fallback = displayColumnLabel(col);
                      const nextLabel =
                        value.trim() === fallback && !(col.label || '').trim()
                          ? (col.label || '')
                          : value;
                      commitTable(
                        updateColumnLabel(tableForEdit, col.id, nextLabel),
                        options?.recordHistory ?? true
                      );
                    }}
                  />
                );
              })}
            </div>
          )}

          {displayRows.map((row, rowIndex) => (
            <div
              key={row.id}
              className="relative flex shrink-0 items-stretch"
              style={{ height: row.heightPx * scale }}
            >
              {displayColumns.map((col, colIndex) => {
                const gridCoord: TableGridCoord = {
                  rowIndex: table.showHeader ? rowIndex + 1 : rowIndex,
                  colIndex,
                };
                const cellRef: TableCellRef = {
                  elementId,
                  rowId: row.id,
                  columnId: col.id,
                  isHeader: false,
                };
                const isSerial = isSerialColumn(col);
                const isProduct = isProductLikeColumn(col);
                const computed =
                  isSerial
                  || (isInvoiceTable1 && isInvoiceComputedColumn(col.id))
                  || (isInvoiceTable2 && isInvoice2ComputedColumn(col.id, row.id, displayColumns))
                  || (isInvoiceTable3 && isInvoice3ComputedColumn(col.id));
                const isInvoiceEditableTable = isInvoiceTable1 || isInvoiceTable2 || isInvoiceTable3;
                // Continue Sr.No. across paginated table segments (Page 2 starts at 4, etc.).
                const cellText = isSerial
                  ? String(serialNumberOffset + rowIndex + 1)
                  : isProduct || computed
                    ? row.cells[col.id] || ''
                    : resolveCellDisplayText(row.id, col.id, row.cells, pendingCellEdits);

                const commitProductValue = (value: string) => {
                  if (onTableCellChange) {
                    onTableCellChange(row.id, col.id, value);
                    return;
                  }
                  if (isInvoiceTable2) {
                    commitInvoice2Pending(
                      { rowId: row.id, columnId: col.id, value },
                      true
                    );
                    return;
                  }
                  if (isInvoiceTable3) {
                    commitInvoice3Pending(
                      { rowId: row.id, columnId: col.id, value },
                      true
                    );
                    return;
                  }
                  let nextTable: ProductTableProps = tableForEdit;
                  if (isInvoiceTable1) {
                    nextTable = updateInvoiceCell(tableForEdit, row.id, col.id, value, taxSettings);
                  } else {
                    nextTable = updateCell(tableForEdit, row.id, col.id, value);
                  }
                  commitTable(nextTable, true);
                };

                if (isProduct) {
                  return (
                    <div
                      key={`${row.id}:${col.id}:product`}
                      className="builder-table-cell builder-table-product-cell shrink-0 overflow-visible"
                      style={{
                        width: scaledColumnWidths[colIndex],
                        height: row.heightPx * scale,
                        borderRight: borderStyle,
                        borderBottom: rowHasBottomBorder(rowIndex) ? borderStyle : undefined,
                      }}
                    >
                      <ProductCellSelect
                        value={cellText}
                        width={scaledColumnWidths[colIndex]}
                        height={row.heightPx * scale}
                        previewMode={!productPickerInteractive}
                        disabled={locked}
                        showSku={showProductSku}
                        onChange={commitProductValue}
                        onProductSelect={(product) =>
                          handleProductPick(row.id, col.id, product)
                        }
                      />
                    </div>
                  );
                }

                return (
                  <TableCell
                    key={`${row.id}:${col.id}:${computed ? row.cells[col.id] : 'edit'}`}
                    cellRef={cellRef}
                    gridCoord={gridCoord}
                    table={displayTable}
                    text={cellText}
                    width={scaledColumnWidths[colIndex]}
                    height={row.heightPx * scale}
                    borderRight={borderStyle}
                    borderBottom={rowHasBottomBorder(rowIndex) ? borderStyle : undefined}
                    previewMode={previewMode}
                    readOnly={computed}
                    staticText={computed}
                    wrapText={
                      previewMode
                        ? !computed && !isSerial && isTableWrapFriendlyColumn(col)
                        : isProduct || isTableWrapFriendlyColumn(col)
                    }
                    forceTextAlign={isSerial ? 'center' : undefined}
                    onLiveChange={(value) => {
                      if (!isInvoiceEditableTable || computed) return;
                      queuePendingEdit(row.id, col.id, value);
                    }}
                    commitOnInput={!isInvoiceEditableTable}
                    onCommit={(value, options) => {
                      if (isInvoiceEditableTable && !computed) {
                        if (!options?.recordHistory) return;
                        if (isInvoiceTable2) {
                          commitInvoice2Pending(
                            { rowId: row.id, columnId: col.id, value },
                            options?.recordHistory ?? true
                          );
                          return;
                        }
                        if (isInvoiceTable3) {
                          commitInvoice3Pending(
                            { rowId: row.id, columnId: col.id, value },
                            options?.recordHistory ?? true
                          );
                          return;
                        }
                        setPendingCellEdits((prev) => {
                          const key = pendingCellKey(row.id, col.id);
                          if (!(key in prev)) return prev;
                          const next = { ...prev };
                          delete next[key];
                          pendingEditsRef.current = next;
                          return next;
                        });
                      }
                      let nextTable: ProductTableProps = tableForEdit;
                      if (isInvoiceTable1) {
                        nextTable = updateInvoiceCell(tableForEdit, row.id, col.id, value, taxSettings);
                      } else {
                        nextTable = updateCell(tableForEdit, row.id, col.id, value);
                      }
                      commitTable(nextTable, options?.recordHistory ?? true);
                    }}
                  />
                );
              })}
            </div>
          ))}

          </div>

          {showInvoice3TotalFooter && (() => {
            const totalColIndex = displayColumns.findIndex((col) => col.id === INVOICE3_COL_TOTAL);
            const leadingWidth =
              totalColIndex > 0
                ? scaledColumnWidths
                    .slice(0, totalColIndex)
                    .reduce((sum, widthPx) => sum + widthPx, 0)
                : 0;
            const totalColWidth =
              totalColIndex >= 0 ? scaledColumnWidths[totalColIndex] : 96 * scale;

            return (
            <>
              <div
                className="shrink-0"
                style={{ height: invoice3TotalFooterGapPx * scale }}
                aria-hidden
              />
              <div
                className="flex shrink-0 items-center"
                style={{
                  width: renderedWidth,
                  height: invoice3TotalFooterHeightPx * scale,
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 12 * scale,
                  color: '#111827',
                }}
              >
                <div style={{ width: leadingWidth }} aria-hidden />
                <div
                  className="flex h-full items-center justify-end gap-2 px-2"
                  style={{ width: totalColWidth }}
                >
                  <span className="font-semibold whitespace-nowrap">{invoice3TotalFooterLabel}</span>
                  <span
                    className="inline-block min-w-[4.5rem] font-semibold tabular-nums text-right"
                    style={{
                      paddingBottom: 2 * scale,
                      borderBottom: borderStyle.replace(
                        /^\d+(\.\d+)?px/,
                        `${Math.max(2, table.borderWidth * scale)}px`
                      ),
                    }}
                  >
                    {invoice3GrandTotalText}
                  </span>
                </div>
              </div>
            </>
            );
          })()}

          {showInvoice2Summary && invoice2SummaryLayout && (
            <>
              <div
                className="shrink-0"
                style={{ height: invoice2SummaryGapPx * scale }}
                aria-hidden
              />
              <div
                className="flex shrink-0"
                style={{ width: renderedWidth }}
              >
                <div
                  className="shrink-0"
                  style={{ width: invoice2SummaryLayout.spacerWidthPx * scale }}
                  aria-hidden
                />
                <div
                  className="flex shrink-0 flex-col box-border"
                  style={{
                    width:
                      (invoice2SummaryLayout.labelColWidthPx
                        + invoice2SummaryLayout.valueColWidthPx)
                      * scale,
                    borderTop: borderStyle,
                    borderLeft: borderStyle,
                    borderBottom: borderStyle,
                  }}
                >
                  {invoice2SummaryRows.map((row, summaryRowIndex) => {
                    const gridRowIndex = getInvoice2SummaryGridRowIndex(
                      table2Props!,
                      summaryRowIndex
                    );
                    const labelText = getInvoice2SummaryCellText(row, INVOICE2_SUMMARY_COL_LABEL);
                    const valueText = getInvoice2SummaryCellText(row, INVOICE2_SUMMARY_COL_VALUE);
                    const isTotalRow = labelText === 'TOTAL';
                    const labelWidth = invoice2SummaryLayout.labelColWidthPx * scale;
                    const valueWidth = invoice2SummaryLayout.valueColWidthPx * scale;

                    const labelCellRef: TableCellRef = {
                      elementId,
                      rowId: row.id,
                      columnId: INVOICE2_SUMMARY_COL_LABEL,
                      isHeader: false,
                    };
                    const valueCellRef: TableCellRef = {
                      elementId,
                      rowId: row.id,
                      columnId: INVOICE2_SUMMARY_COL_VALUE,
                      isHeader: false,
                    };

                    return (
                      <div
                        key={row.id}
                        className="relative flex shrink-0"
                        style={{ height: invoice2SummaryRowHeightPx * scale }}
                      >
                        <TableCell
                          key={`${row.id}:label`}
                          cellRef={labelCellRef}
                          gridCoord={{
                            rowIndex: gridRowIndex,
                            colIndex: invoice2SummaryColumnIndices.labelColIndex,
                          }}
                          table={displayTable}
                          text={labelText}
                          width={labelWidth}
                          height={invoice2SummaryRowHeightPx * scale}
                          borderRight={borderStyle}
                          borderBottom={
                            summaryRowIndex < invoice2SummaryRows.length - 1
                              ? borderStyle
                              : undefined
                          }
                          previewMode={previewMode}
                          forceTextAlign="left"
                          editorClassName="font-semibold uppercase"
                          commitOnInput={false}
                          onLiveChange={(value) => {
                            queuePendingEdit(row.id, INVOICE2_SUMMARY_COL_LABEL, value);
                          }}
                          onCommit={(value, options) => {
                            if (!options?.recordHistory) return;
                            commitInvoice2Pending(
                              {
                                rowId: row.id,
                                columnId: INVOICE2_SUMMARY_COL_LABEL,
                                value,
                              },
                              options?.recordHistory ?? true
                            );
                          }}
                        />
                        <TableCell
                          key={`${row.id}:value`}
                          cellRef={valueCellRef}
                          gridCoord={{
                            rowIndex: gridRowIndex,
                            colIndex: invoice2SummaryColumnIndices.valueColIndex,
                          }}
                          table={displayTable}
                          text={valueText}
                          width={valueWidth}
                          height={invoice2SummaryRowHeightPx * scale}
                          borderRight={borderStyle}
                          borderBottom={
                            summaryRowIndex < invoice2SummaryRows.length - 1
                              ? borderStyle
                              : undefined
                          }
                          previewMode={previewMode}
                          readOnly
                          forceTextAlign="right"
                          editorClassName={
                            isTotalRow ? 'font-semibold tabular-nums' : 'tabular-nums'
                          }
                          commitOnInput={false}
                          onCommit={() => {}}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {showGrandTotalFooterHere && displayColumns.some((col) => col.id === INVOICE_COL_TOTAL) && (
            <div
              className="relative flex shrink-0 bg-gray-50/90"
              style={{ height: footerHeightPx * scale }}
            >
              {displayColumns.map((col, colIndex) => {
                const isTotalCol = col.id === INVOICE_COL_TOTAL;
                return (
                  <div
                    key={`grand-total-${col.id}`}
                    className={`flex shrink-0 items-center overflow-hidden px-2 ${
                      isTotalCol ? 'justify-end font-semibold text-gray-900' : ''
                    }`}
                    style={{
                      width: scaledColumnWidths[colIndex],
                      height: footerHeightPx * scale,
                      borderRight: borderStyle,
                      fontSize: 12,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {isTotalCol ? (
                      <span className="truncate">{grandTotalText}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {showAmountInWords && (
            <div
              className="flex shrink-0 items-center px-2 text-gray-900 box-border"
              style={{
                width: renderedWidth,
                height: DEFAULT_AMOUNT_IN_WORDS_HEIGHT_PX * scale,
                // Table 1 already has outer left/bottom borders — only continue the grid.
                // Table 2/3 sit outside the body box, so draw a matching frame.
                ...(isInvoiceTable1
                  ? {
                      borderTop: borderStyle,
                      borderRight: borderStyle,
                    }
                  : {
                      borderTop: borderStyle,
                      borderLeft: borderStyle,
                      borderRight: borderStyle,
                      borderBottom: borderStyle,
                    }),
                fontFamily: 'Inter, sans-serif',
                fontSize: 11 * scale,
              }}
            >
              <span className="font-semibold">Amount in words:&nbsp;</span>
              <span>{amountInWordsText}</span>
            </div>
          )}
        </div>
      </div>
    </TableEditContext.Provider>
  );
}
