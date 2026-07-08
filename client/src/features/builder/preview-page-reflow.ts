import { v4 as uuidv4 } from 'uuid';
import { ComponentType } from '@invogen/shared';
import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { getPageDimensions, type PageMargins } from './builder-dnd';
import { isTableElementType, productTablePropsToRecord, resolveBuilderTablePropsForEdit } from './product-table';
import { isCardComponentType, estimateCardBlockHeight } from './card-components';
import {
  resolvePreviewTableFittedLayout,
  fitTableHeightsPreservingWidths,
  resolveTableElementSize,
} from './table-element-size';
import { isInvoiceTable2Type, recalculateInvoiceTable2 } from './invoice-table-2';
import { isInvoiceTable3Type } from './invoice-table-3';
import { normalizeTablePropsForType } from './table-props-normalize';
import type { ProductTableProps, ProductTableRow } from './product-table';
import {
  estimateStructuredBlockHeight,
  estimateTextBlockHeight,
  isStructuredContentType,
} from './structured-content-layout';
import { isTextStylable } from './text-styles';
import { cloneTemplatePages } from '@/features/invoice-composer/invoice-document';

const PUSH_TOLERANCE_PX = 2;
const FLOW_GAP_PX = 12;
const ROW_Y_TOLERANCE_PX = 24;
const PREVIEW_PAGINATION_ROWS_KEY = '__previewPaginationRows';
const PREVIEW_PAGINATION_RANGE_START_KEY = '__previewPaginationStart';
const PREVIEW_PAGINATION_RANGE_END_KEY = '__previewPaginationEnd';
const LOGICAL_FLOW_Y_KEY = '__logicalFlowY';

function getLogicalFlowY(element: CanvasElement): number {
  const props = (element.props ?? {}) as Record<string, unknown>;
  const stored = props[LOGICAL_FLOW_Y_KEY];
  if (typeof stored === 'number' && Number.isFinite(stored)) return stored;
  return element.y;
}

function withLogicalFlowY(element: CanvasElement, logicalY: number): CanvasElement {
  const props = { ...(element.props ?? {}) } as Record<string, unknown>;
  props[LOGICAL_FLOW_Y_KEY] = logicalY;
  return { ...element, props, y: logicalY };
}

/** Record manual canvas position as document-flow order (after drag / resize). */
export function touchLogicalFlowY(element: CanvasElement): CanvasElement {
  return withLogicalFlowY(element, element.y);
}

function cloneElements(elements: CanvasElement[]): CanvasElement[] {
  return elements.map((element) => ({ ...element, props: { ...(element.props ?? {}) } }));
}

/** Background layers only — all other elements participate in document flow. */
export function isPinnedPreviewElement(element: CanvasElement): boolean {
  return element.visible !== false && element.type === ComponentType.WATERMARK;
}

export type PreviewReflowOptions = {
  /** Keep saved table column layout; only grow height from row data (invoice composer). */
  trustTableProps?: boolean;
};

/** Alias for the unified document layout engine options. */
export type DocumentLayoutOptions = PreviewReflowOptions;

function resolveTableExpansion(
  element: CanvasElement,
  options: PreviewReflowOptions
): {
  widthDelta: number;
  heightDelta: number;
  fittedHeight: number;
  fittedWidth: number;
  tableProps?: Record<string, unknown>;
} {
  const raw = (element.props ?? {}) as Record<string, unknown>;

  if (options.trustTableProps) {
    const fitted = fitTableHeightsPreservingWidths(element.type, raw);
    return {
      widthDelta: 0,
      heightDelta: Math.max(0, fitted.height - element.height),
      fittedHeight: fitted.height,
      fittedWidth: element.width,
      tableProps: fitted.tableProps,
    };
  }

  const fitted = resolvePreviewTableFittedLayout(element.type, element.width, raw);
  return {
    widthDelta: Math.max(0, fitted.width - element.width),
    heightDelta: Math.max(0, fitted.height - element.height),
    fittedHeight: fitted.height,
    fittedWidth: fitted.width,
    tableProps: fitted.tableProps,
  };
}

function measureElementExpansion(
  element: CanvasElement,
  options: PreviewReflowOptions = {}
): { widthDelta: number; heightDelta: number; fittedHeight: number } {
  if (element.visible === false) {
    return { widthDelta: 0, heightDelta: 0, fittedHeight: element.height };
  }

  if (isTableElementType(element.type)) {
    const fitted = resolveTableExpansion(element, options);
    return {
      widthDelta: fitted.widthDelta,
      heightDelta: fitted.heightDelta,
      fittedHeight: fitted.fittedHeight,
    };
  }

  if (isStructuredContentType(element.type)) {
    const estimated = estimateStructuredBlockHeight(
      element.type,
      (element.props ?? {}) as Record<string, unknown>,
      element.width,
      element.height
    );
    return {
      widthDelta: 0,
      heightDelta: Math.max(0, estimated - element.height),
      fittedHeight: estimated,
    };
  }

  if (isCardComponentType(element.type)) {
    const fittedHeight = estimateCardBlockHeight(
      element.type,
      (element.props ?? {}) as Record<string, unknown>,
      element.width,
      element.height
    );
    return {
      widthDelta: 0,
      heightDelta: Math.max(0, fittedHeight - element.height),
      fittedHeight,
    };
  }

  if (
    isTextStylable(element.type)
    && !isCardComponentType(element.type)
    && !isStructuredContentType(element.type)
  ) {
    const fittedHeight = estimateTextBlockHeight(
      element.type,
      (element.props ?? {}) as Record<string, unknown>,
      element.width,
      element.height
    );
    return {
      widthDelta: 0,
      heightDelta: Math.max(0, fittedHeight - element.height),
      fittedHeight,
    };
  }

  return { widthDelta: 0, heightDelta: 0, fittedHeight: element.height };
}

function contentOverlapsExpandedBlock(
  page: TemplatePage,
  block: CanvasElement,
  contentHeight: number
): boolean {
  const contentBottom = block.y + contentHeight;

  return page.elements.some((element) => {
    if (element.id === block.id || element.visible === false) return false;
    if (isPinnedPreviewElement(element)) return false;

    const sameRow = Math.abs(element.y - block.y) <= ROW_Y_TOLERANCE_PX;
    if (sameRow) return false;

    if (element.y + element.height <= block.y + PUSH_TOLERANCE_PX) return false;
    if (element.y >= contentBottom - PUSH_TOLERANCE_PX) return false;
    return true;
  });
}

/** True when preview layout must expand tables/blocks or push content below. */
export function pageNeedsReflow(page: TemplatePage, options: PreviewReflowOptions = {}): boolean {
  return page.elements.some((element) => {
    const { heightDelta, fittedHeight } = measureElementExpansion(element, options);
    if (heightDelta > PUSH_TOLERANCE_PX) return true;
    if (isTableElementType(element.type) || isCardComponentType(element.type)) {
      return contentOverlapsExpandedBlock(page, element, fittedHeight);
    }
    return false;
  });
}

export function previewPagesNeedReflow(
  pages: TemplatePage[],
  options: PreviewReflowOptions = {}
): boolean {
  return pages.some((page) => pageNeedsReflow(page, options));
}

/** Set page tab labels and page-number fields to the rendered page index (1-based). */
export function applyPreviewPageNumbers(pages: TemplatePage[]): TemplatePage[] {
  return pages.map((page, index) => ({
    ...page,
    name: `Page ${index + 1}`,
    elements: page.elements.map((element) => {
      if (element.type !== ComponentType.PAGE_NUMBER) return element;
      return {
        ...element,
        props: { ...(element.props ?? {}), value: String(index + 1) },
      };
    }),
  }));
}

function pageHasVisibleContent(page: TemplatePage): boolean {
  return page.elements.some(
    (element) => element.visible !== false && !isPinnedPreviewElement(element)
  );
}

function pageHasOverlappingFlowElements(page: TemplatePage): boolean {
  const flow = page.elements.filter(
    (element) => element.visible !== false && !isPinnedPreviewElement(element)
  );
  for (let i = 0; i < flow.length; i += 1) {
    for (let j = i + 1; j < flow.length; j += 1) {
      const a = flow[i];
      const b = flow[j];
      const aBottom = a.y + a.height;
      const bBottom = b.y + b.height;
      if (a.y < bBottom - PUSH_TOLERANCE_PX && b.y < aBottom - PUSH_TOLERANCE_PX) {
        return true;
      }
    }
  }
  return false;
}

export function builderPagesNeedLayout(pages: TemplatePage[]): boolean {
  if (previewPagesNeedReflow(pages, { trustTableProps: true })) return true;
  return pages.some(pageHasOverlappingFlowElements);
}

/** Never drop page 1 — only remove empty continuation pages after it. */
function dropEmptyTrailingPages(pages: TemplatePage[]): TemplatePage[] {
  if (pages.length <= 1) return pages;
  const head = [pages[0]];
  const tail = pages.slice(1).filter(pageHasVisibleContent);
  return [...head, ...tail];
}

function repositionForPageTop(elements: CanvasElement[], margins: PageMargins): CanvasElement[] {
  if (elements.length === 0) return elements;
  const minY = Math.min(...elements.map((element) => element.y));
  const offset = margins.top - minY;
  if (Math.abs(offset) <= 1) return elements;
  return elements.map((element) => ({ ...element, y: element.y + offset }));
}

/** Keep document-order Y positions on page 1 (do not collapse everything to the top margin). */
function preserveFlowElementPositions(
  elements: CanvasElement[],
  margins: PageMargins
): CanvasElement[] {
  return elements.map((element) => ({
    ...element,
    y: Math.max(margins.top, getLogicalFlowY(element)),
  }));
}

function fitAllTableHeightsInPages(pages: TemplatePage[]): TemplatePage[] {
  return pages.map((page) => ({
    ...page,
    elements: page.elements.map((element) => {
      if (element.visible === false || !isTableElementType(element.type)) return element;
      const fitted = fitTableHeightsPreservingWidths(
        element.type,
        (element.props ?? {}) as Record<string, unknown>
      );
      return {
        ...element,
        height: Math.max(element.height, fitted.height),
        props: fitted.tableProps,
      };
    }),
  }));
}

/** Stack spilled elements from the top margin in visual order (continuation pages only). */
function stackOverflowElementsAtPageTop(
  elements: CanvasElement[],
  margins: PageMargins
): CanvasElement[] {
  if (elements.length === 0) return elements;
  const sorted = [...elements].sort(
    (a, b) => getLogicalFlowY(a) - getLogicalFlowY(b) || a.x - b.x
  );
  let cursorY = margins.top;
  return sorted.map((element) => {
    const next = withLogicalFlowY({ ...element, y: cursorY }, cursorY);
    cursorY += element.height + FLOW_GAP_PX;
    return next;
  });
}

/** Collect unique elements from every page, sorted by document flow order. */
function gatherReflowElements(pages: TemplatePage[]): {
  elements: CanvasElement[];
  startY: number;
} {
  const byId = new Map<string, CanvasElement>();

  for (const page of pages) {
    for (const element of page.elements) {
      if (element.visible === false || isPinnedPreviewElement(element)) continue;
      if (!byId.has(element.id)) {
        byId.set(element.id, element);
      }
    }
  }

  const elements = Array.from(byId.values()).sort(
    (a, b) => getLogicalFlowY(a) - getLogicalFlowY(b) || a.x - b.x
  );
  const margins = pages[0]?.margins ?? { top: 40, right: 40, bottom: 40, left: 40 };
  const startY =
    elements.length > 0
      ? Math.max(margins.top, Math.min(...elements.map(getLogicalFlowY)))
      : margins.top;

  return { elements, startY };
}

function groupElementsIntoRows(elements: CanvasElement[]): CanvasElement[][] {
  if (elements.length === 0) return [];
  const sorted = [...elements].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: CanvasElement[][] = [];
  let currentRow: CanvasElement[] = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const element = sorted[index];
    const rowAnchorY = currentRow[0].y;
    if (Math.abs(element.y - rowAnchorY) <= ROW_Y_TOLERANCE_PX) {
      currentRow.push(element);
    } else {
      rows.push(currentRow);
      currentRow = [element];
    }
  }
  rows.push(currentRow);
  return rows;
}

/** True when an element sits below an anchor in the same column (not a side-by-side row). */
function shouldFlowBelowAnchor(
  anchor: CanvasElement,
  element: CanvasElement,
  anchorBottom: number
): boolean {
  if (element.id === anchor.id || element.visible === false) return false;
  if (isPinnedPreviewElement(element)) return false;

  // Stacked tables/blocks with similar Y must still reflow when heights overlap.
  const verticallyOverlaps =
    element.y < anchorBottom - PUSH_TOLERANCE_PX
    && element.y + element.height > anchor.y + PUSH_TOLERANCE_PX;
  if (verticallyOverlaps) return true;

  const sameRow = Math.abs(element.y - anchor.y) <= ROW_Y_TOLERANCE_PX;
  if (sameRow) return false;

  if (element.y + element.height <= anchor.y + PUSH_TOLERANCE_PX) return false;

  if (element.y < anchorBottom + PUSH_TOLERANCE_PX) return true;

  return element.y >= anchorBottom - FLOW_GAP_PX - PUSH_TOLERANCE_PX;
}

function isStackedBelow(anchor: CanvasElement, element: CanvasElement): boolean {
  if (element.id === anchor.id || element.visible === false) return false;
  if (isPinnedPreviewElement(element)) return false;
  const anchorBottom = anchor.y + anchor.height;
  const verticallyOverlaps =
    element.y < anchorBottom - PUSH_TOLERANCE_PX
    && element.y + element.height > anchor.y + PUSH_TOLERANCE_PX;
  if (verticallyOverlaps) return true;
  if (Math.abs(element.y - anchor.y) <= ROW_Y_TOLERANCE_PX) return false;
  return element.y + element.height > anchor.y + PUSH_TOLERANCE_PX;
}

type TableMeasureMode = 'full' | 'segment';

function tableHasPaginationSegment(props: Record<string, unknown>): boolean {
  const start = props[PREVIEW_PAGINATION_RANGE_START_KEY];
  const end = props[PREVIEW_PAGINATION_RANGE_END_KEY];
  return typeof start === 'number' && typeof end === 'number' && end > start;
}

function resolveRowsForTableMeasure(
  elementProps: Record<string, unknown>,
  fullTable: ProductTableProps,
  allRows: ProductTableRow[],
  measureMode: TableMeasureMode
): ProductTableRow[] {
  if (measureMode === 'full') return allRows;
  if (tableHasPaginationSegment(elementProps)) {
    const start = elementProps[PREVIEW_PAGINATION_RANGE_START_KEY] as number;
    const end = elementProps[PREVIEW_PAGINATION_RANGE_END_KEY] as number;
    return allRows.slice(start, end);
  }
  if (fullTable.rows.length > 0 && fullTable.rows.length < allRows.length) {
    return fullTable.rows;
  }
  return allRows;
}

function measureTableFittedHeight(
  element: CanvasElement,
  measureMode: TableMeasureMode = tableHasPaginationSegment((element.props ?? {}) as Record<string, unknown>)
    ? 'segment'
    : 'full'
): {
  height: number;
  tableProps: Record<string, unknown>;
  allRows: ProductTableRow[];
} {
  const elementProps = (element.props ?? {}) as Record<string, unknown>;
  const fitted = fitTableHeightsPreservingWidths(element.type, elementProps);
  const fullTable = normalizeTablePropsForType(
    element.type,
    fitted.tableProps
  ) as ProductTableProps;
  const allRows = resolvePaginationAllRows(elementProps, fullTable);
  const rowsForMeasure = resolveRowsForTableMeasure(
    elementProps,
    fullTable,
    allRows,
    measureMode
  );
  const height = resolveTableElementSize(element.type, { ...fullTable, rows: rowsForMeasure }).height;
  return { height, tableProps: fitted.tableProps, allRows };
}

function expandVerticalContent(elements: CanvasElement[]): CanvasElement[] {
  return elements.map((element) => {
    if (element.visible === false) return element;
    if (isTableElementType(element.type)) return element;

    let fittedHeight = element.height;
    if (isStructuredContentType(element.type)) {
      fittedHeight = estimateStructuredBlockHeight(
        element.type,
        (element.props ?? {}) as Record<string, unknown>,
        element.width,
        element.height
      );
    } else if (isCardComponentType(element.type)) {
      fittedHeight = estimateCardBlockHeight(
        element.type,
        (element.props ?? {}) as Record<string, unknown>,
        element.width,
        element.height
      );
    }

    if (fittedHeight > element.height + PUSH_TOLERANCE_PX) {
      return { ...element, height: fittedHeight };
    }
    return element;
  });
}

function expandTablesAndPushBelow(
  elements: CanvasElement[],
  options: { measureMode?: TableMeasureMode } = {}
): CanvasElement[] {
  let result = cloneElements(elements);

  for (let pass = 0; pass < 16; pass += 1) {
    let changed = false;
    const tables = result
      .filter((element) => element.visible !== false && isTableElementType(element.type))
      .sort((a, b) => a.y - b.y || a.x - b.x);

    for (const table of tables) {
      const index = result.findIndex((element) => element.id === table.id);
      if (index < 0) continue;

      const current = result[index];
      const currentProps = (current.props ?? {}) as Record<string, unknown>;
      const measureMode =
        options.measureMode
        ?? (tableHasPaginationSegment(currentProps) ? 'segment' : 'full');
      const { height: newHeight, tableProps, allRows } = measureTableFittedHeight(
        current,
        measureMode
      );
      const oldBottom = current.y + current.height;
      const newBottom = current.y + newHeight;
      const delta = newBottom - oldBottom;

      if (Math.abs(current.height - newHeight) > PUSH_TOLERANCE_PX) {
        result[index] = {
          ...current,
          height: newHeight,
          props: {
            ...currentProps,
            ...tableProps,
            [PREVIEW_PAGINATION_ROWS_KEY]: allRows,
          },
        };
        changed = true;
      }

      const anchor = result[index];
      const anchorBottom = anchor.y + anchor.height;
      const minYBelowAnchor = anchorBottom + FLOW_GAP_PX;

      for (let elementIndex = 0; elementIndex < result.length; elementIndex += 1) {
        if (elementIndex === index) continue;
        const element = result[elementIndex];
        if (!isStackedBelow(anchor, element)) continue;

        let targetY = element.y;
        if (Math.abs(delta) > PUSH_TOLERANCE_PX) {
          targetY = element.y + delta;
        }
        targetY = Math.max(targetY, minYBelowAnchor);

        if (Math.abs(element.y - targetY) > PUSH_TOLERANCE_PX) {
          result[elementIndex] = { ...element, y: targetY };
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  return result;
}

/** Ensure stacked elements sit below each table — fixes overlap when Y was never reflowed. */
function enforceStackGapBelowTables(elements: CanvasElement[]): CanvasElement[] {
  let result = cloneElements(elements);
  const tables = result
    .filter((element) => element.visible !== false && isTableElementType(element.type))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  for (const table of tables) {
    const index = result.findIndex((element) => element.id === table.id);
    if (index < 0) continue;

    const anchor = result[index];
    const minYBelow = anchor.y + anchor.height + FLOW_GAP_PX;

    for (let elementIndex = 0; elementIndex < result.length; elementIndex += 1) {
      if (elementIndex === index) continue;
      const element = result[elementIndex];
      if (element.visible === false || isPinnedPreviewElement(element)) continue;
      if (!isStackedBelow(anchor, element)) continue;
      if (element.y + PUSH_TOLERANCE_PX < minYBelow) {
        result[elementIndex] = { ...element, y: minYBelow };
      }
    }
  }

  return result;
}

function sortDocumentFlowElements(elements: CanvasElement[]): CanvasElement[] {
  return elements
    .filter((element) => element.visible !== false && !isPinnedPreviewElement(element))
    .sort((a, b) => getLogicalFlowY(a) - getLogicalFlowY(b) || a.x - b.x);
}

function measureElementForLayout(element: CanvasElement): CanvasElement {
  if (element.visible === false) return element;

  if (isTableElementType(element.type)) {
    const { height, tableProps, allRows } = measureTableFittedHeight(element, 'full');
    const elementProps = (element.props ?? {}) as Record<string, unknown>;
    return {
      ...element,
      height,
      props: {
        ...elementProps,
        ...tableProps,
        [PREVIEW_PAGINATION_ROWS_KEY]: allRows,
      },
    };
  }

  if (isStructuredContentType(element.type)) {
    const height = estimateStructuredBlockHeight(
      element.type,
      (element.props ?? {}) as Record<string, unknown>,
      element.width,
      element.height
    );
    return { ...element, height: Math.max(element.height, height) };
  }

  if (isCardComponentType(element.type)) {
    const height = estimateCardBlockHeight(
      element.type,
      (element.props ?? {}) as Record<string, unknown>,
      element.width,
      element.height
    );
    return { ...element, height: Math.max(element.height, height) };
  }

  if (
    isTextStylable(element.type)
    && !isCardComponentType(element.type)
    && !isStructuredContentType(element.type)
  ) {
    const height = estimateTextBlockHeight(
      element.type,
      (element.props ?? {}) as Record<string, unknown>,
      element.width,
      element.height
    );
    return { ...element, height: Math.max(element.height, height) };
  }

  return element;
}

function tablePropsForPageSegment(
  elementProps: Record<string, unknown>,
  segmentProps: Record<string, unknown>,
  allRows: ProductTableRow[],
  range?: { start: number; end: number }
): Record<string, unknown> {
  const props = {
    ...elementProps,
    ...segmentProps,
    [PREVIEW_PAGINATION_ROWS_KEY]: allRows,
  };
  if (range) {
    props[PREVIEW_PAGINATION_RANGE_START_KEY] = range.start;
    props[PREVIEW_PAGINATION_RANGE_END_KEY] = range.end;
  } else {
    delete props[PREVIEW_PAGINATION_RANGE_START_KEY];
    delete props[PREVIEW_PAGINATION_RANGE_END_KEY];
  }
  return props;
}

function makeTableContinuationElement(
  element: CanvasElement,
  elementProps: Record<string, unknown>,
  segmentProps: Record<string, unknown>,
  allRows: ProductTableRow[],
  rowStart: number,
  rowEnd: number,
  height: number
): CanvasElement {
  return {
    ...element,
    id: uuidv4(),
    x: element.x,
    width: element.width,
    y: element.y,
    height,
    props: tablePropsForPageSegment(elementProps, segmentProps, allRows, {
      start: rowStart,
      end: rowEnd,
    }),
  };
}

/** Word/Canva-style flow: stack top-to-bottom, split table rows when the stack hits the page bottom. */
function paginateTableInDocumentFlow(
  element: CanvasElement,
  cursorY: number,
  contentBottom: number
): { onPage: CanvasElement | null; overflow: CanvasElement[] } {
  const elementProps = (element.props ?? {}) as Record<string, unknown>;
  const fitted = fitTableHeightsPreservingWidths(element.type, elementProps);
  const fullTable = normalizeTablePropsForType(
    element.type,
    fitted.tableProps
  ) as ProductTableProps;
  const allRows = resolvePaginationAllRows(elementProps, fullTable);
  const tableForSplit: ProductTableProps = { ...fullTable, rows: allRows };
  const fullHeight = resolveTableElementSize(element.type, tableForSplit).height;
  const spaceLeft = contentBottom - cursorY;

  if (spaceLeft <= PUSH_TOLERANCE_PX) {
    const continuation = buildTableSegment(
      element.type,
      tableForSplit,
      0,
      allRows.length,
      { showHeader: fullTable.showHeader !== false, isLastSegment: true },
      allRows
    );
    return {
      onPage: null,
      overflow: [
        makeTableContinuationElement(
          element,
          elementProps,
          continuation.tableProps,
          allRows,
          0,
          allRows.length,
          continuation.height
        ),
      ],
    };
  }

  if (fullHeight <= spaceLeft + PUSH_TOLERANCE_PX) {
    return {
      onPage: {
        ...element,
        y: cursorY,
        height: fullHeight,
        props: tablePropsForPageSegment(elementProps, fitted.tableProps, allRows),
      },
      overflow: [],
    };
  }

  const splitIndex = findTableRowSplitIndex(
    element.type,
    tableForSplit,
    spaceLeft,
    allRows
  );

  if (splitIndex <= 0) {
    const continuation = buildTableSegment(
      element.type,
      tableForSplit,
      0,
      allRows.length,
      { showHeader: fullTable.showHeader !== false, isLastSegment: true },
      allRows
    );
    return {
      onPage: null,
      overflow: [
        makeTableContinuationElement(
          element,
          elementProps,
          continuation.tableProps,
          allRows,
          0,
          allRows.length,
          continuation.height
        ),
      ],
    };
  }

  const pageSegment = buildTableSegment(
    element.type,
    tableForSplit,
    0,
    splitIndex,
    { showHeader: fullTable.showHeader !== false, isLastSegment: false },
    allRows
  );
  const continuationSegment = buildTableSegment(
    element.type,
    tableForSplit,
    splitIndex,
    allRows.length,
    { showHeader: true, isLastSegment: true },
    allRows
  );

  return {
    onPage: {
      ...element,
      y: cursorY,
      height: pageSegment.height,
      props: tablePropsForPageSegment(
        elementProps,
        pageSegment.tableProps,
        allRows,
        { start: 0, end: splitIndex }
      ),
    },
    overflow: [
      makeTableContinuationElement(
        element,
        elementProps,
        continuationSegment.tableProps,
        allRows,
        splitIndex,
        allRows.length,
        continuationSegment.height
      ),
    ],
  };
}

function stackFitsAt(
  cursorY: number,
  blocks: CanvasElement[],
  contentBottom: number
): boolean {
  let y = cursorY;
  for (const block of blocks) {
    if (y + block.height > contentBottom + PUSH_TOLERANCE_PX) return false;
    y += block.height + FLOW_GAP_PX;
  }
  return true;
}

function spillRemainingFlow(
  flow: CanvasElement[],
  startIndex: number,
  cursorY: number,
  overflow: CanvasElement[]
): void {
  let y = cursorY;
  for (let index = startIndex; index < flow.length; index += 1) {
    const block = flow[index];
    overflow.push(withLogicalFlowY({ ...block, y }, y));
    y += block.height + FLOW_GAP_PX;
  }
}

function cursorYAfterPlaced(
  onPage: CanvasElement[],
  pinnedCount: number,
  contentTop: number,
  startY: number | undefined,
  flow: CanvasElement[]
): number {
  const placed = onPage.slice(pinnedCount);
  if (placed.length === 0) {
    return startY ?? (flow.length > 0 ? Math.max(contentTop, getLogicalFlowY(flow[0])) : contentTop);
  }
  const last = placed[placed.length - 1];
  return last.y + last.height + FLOW_GAP_PX;
}

/** Spill from flowIndex; pull back a lone non-table block above a table that no longer fits. */
function spillFlowFromIndex(
  flow: CanvasElement[],
  spillIndex: number,
  onPage: CanvasElement[],
  pinnedCount: number,
  overflow: CanvasElement[],
  contentTop: number,
  startY: number | undefined
): void {
  let index = spillIndex;

  if (isTableElementType(flow[index].type) && index > 0) {
    const prev = flow[index - 1];
    if (!isTableElementType(prev.type) && onPage.some((element) => element.id === prev.id)) {
      const prevIdx = onPage.findIndex((element) => element.id === prev.id);
      if (prevIdx >= pinnedCount) {
        onPage.splice(prevIdx, 1);
        index -= 1;
      }
    }
  }

  const spillY = cursorYAfterPlaced(onPage, pinnedCount, contentTop, startY, flow);
  spillRemainingFlow(flow, index, spillY, overflow);
}

/** Move any flow blocks that extend past the page bottom into overflow. */
function enforcePageBottomSpill(
  onPage: CanvasElement[],
  pinnedCount: number,
  flow: CanvasElement[],
  contentTop: number,
  contentBottom: number,
  startY: number | undefined,
  overflow: CanvasElement[]
): CanvasElement[] {
  const flowOnPage = sortDocumentFlowElements(onPage);
  let firstPastBottom = -1;
  for (let index = 0; index < flowOnPage.length; index += 1) {
    const element = flowOnPage[index];
    if (tableHasContinuationInOverflow(element, overflow)) continue;
    if (element.y + element.height > contentBottom + PUSH_TOLERANCE_PX) {
      firstPastBottom = index;
      break;
    }
  }
  if (firstPastBottom < 0) return onPage;

  const flowIndex = flow.findIndex((element) => element.id === flowOnPage[firstPastBottom].id);
  if (flowIndex < 0) return onPage;

  let spillIndex = flowIndex;
  if (isTableElementType(flow[spillIndex].type) && spillIndex > 0) {
    const prev = flow[spillIndex - 1];
    if (!isTableElementType(prev.type) && onPage.some((element) => element.id === prev.id)) {
      spillIndex -= 1;
    }
  }

  const spillIds = new Set(flow.slice(spillIndex).map((element) => element.id));
  const nextOnPage = onPage.filter(
    (element) =>
      element.visible === false
      || isPinnedPreviewElement(element)
      || !spillIds.has(element.id)
  );
  const spillY = cursorYAfterPlaced(nextOnPage, pinnedCount, contentTop, startY, flow);
  spillRemainingFlow(flow, spillIndex, spillY, overflow);
  return nextOnPage;
}

function sortOverflowByFlowOrder(overflow: CanvasElement[]): CanvasElement[] {
  return [...overflow].sort(
    (a, b) => getLogicalFlowY(a) - getLogicalFlowY(b) || a.x - b.x
  );
}

/**
 * Layout one page like Word/Canva:
 * 1. Measure natural heights
 * 2. Stack in document order (top → bottom)
 * 3. Split table rows when the stack reaches the page bottom
 * 4. Spill remaining blocks to the next page
 */
function layoutPageDocumentFlow(
  page: TemplatePage,
  elements: CanvasElement[],
  startY?: number
): { page: TemplatePage; overflow: CanvasElement[] } {
  const { height: pageHeight } = getPageDimensions(page);
  const contentTop = page.margins.top;
  const contentBottom = pageHeight - page.margins.bottom;

  const pinned = elements.filter(
    (element) => element.visible !== false && isPinnedPreviewElement(element)
  );
  const pinnedCount = pinned.length;
  const flow = sortDocumentFlowElements(elements).map(measureElementForLayout);

  const onPage: CanvasElement[] = [...pinned];
  const overflow: CanvasElement[] = [];

  if (flow.length === 0) {
    return { page: { ...page, elements: onPage }, overflow };
  }

  let cursorY = startY ?? Math.max(contentTop, getLogicalFlowY(flow[0]));

  for (let flowIndex = 0; flowIndex < flow.length; flowIndex += 1) {
    const element = flow[flowIndex];
    const remaining = flow.slice(flowIndex);

    if (isTableElementType(element.type)) {
      const paginated = paginateTableInDocumentFlow(element, cursorY, contentBottom);
      if (paginated.onPage === null) {
        spillFlowFromIndex(
          flow,
          flowIndex,
          onPage,
          pinnedCount,
          overflow,
          contentTop,
          startY
        );
        break;
      }

      const placed = withLogicalFlowY(paginated.onPage, cursorY);
      onPage.push(placed);
      cursorY = placed.y + placed.height + FLOW_GAP_PX;

      for (const spill of paginated.overflow) {
        overflow.push(withLogicalFlowY(spill, cursorY));
      }

      const nextIndex = flowIndex + 1;
      if (nextIndex < flow.length) {
        const afterTable = flow.slice(nextIndex);
        if (!stackFitsAt(cursorY, afterTable, contentBottom)) {
          spillRemainingFlow(flow, nextIndex, cursorY, overflow);
          break;
        }
      }
      continue;
    }

    if (!stackFitsAt(cursorY, remaining, contentBottom)) {
      spillRemainingFlow(flow, flowIndex, cursorY, overflow);
      break;
    }

    const placed = withLogicalFlowY({ ...element, y: cursorY }, cursorY);
    onPage.push(placed);
    cursorY += placed.height + FLOW_GAP_PX;
  }

  const trimmedOnPage = enforcePageBottomSpill(
    onPage,
    pinnedCount,
    flow,
    contentTop,
    contentBottom,
    startY,
    overflow
  );

  return {
    page: { ...page, elements: trimmedOnPage },
    overflow: sortOverflowByFlowOrder(overflow),
  };
}

/** Stack blocks below expanded tables/cards while keeping same-row horizontal alignment. */
function flowLayoutBelowExpandables(elements: CanvasElement[]): CanvasElement[] {
  const expandables = elements
    .filter(
      (element) =>
        element.visible !== false
        && (isTableElementType(element.type) || isCardComponentType(element.type))
    )
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (expandables.length === 0) return elements;

  let result = elements.map((element) => ({ ...element }));

  for (let expandableIndex = 0; expandableIndex < expandables.length; expandableIndex += 1) {
    const anchor = result.find((element) => element.id === expandables[expandableIndex].id);
    if (!anchor) continue;

    const anchorBottom = anchor.y + anchor.height;

    const segment = result.filter((element) =>
      shouldFlowBelowAnchor(anchor, element, anchorBottom)
    );

    if (segment.length === 0) continue;

    const rows = groupElementsIntoRows(segment);
    let cursorY = anchorBottom + FLOW_GAP_PX;

    for (const row of rows) {
      const rowHeight = Math.max(...row.map((element) => element.height));
      for (const element of row) {
        const index = result.findIndex((item) => item.id === element.id);
        if (index < 0) continue;
        result[index] = { ...result[index], y: cursorY };
      }
      cursorY += rowHeight + FLOW_GAP_PX;
    }
  }

  return result;
}

function splitOverflowElements(
  elements: CanvasElement[],
  contentBottomLimit: number
): { staying: CanvasElement[]; overflow: CanvasElement[] } {
  const hidden = elements.filter((element) => element.visible === false);
  const pinned = elements.filter(
    (element) => element.visible !== false && isPinnedPreviewElement(element)
  );
  const flow = sortDocumentFlowElements(elements);

  const staying: CanvasElement[] = [...hidden, ...pinned];
  const overflow: CanvasElement[] = [];

  let firstOverflowIndex = -1;
  for (let index = 0; index < flow.length; index += 1) {
    const element = flow[index];
    const extendsPastBottom =
      element.y + element.height > contentBottomLimit + PUSH_TOLERANCE_PX;
    const startsPastBottom = element.y >= contentBottomLimit - PUSH_TOLERANCE_PX;
    if (extendsPastBottom || startsPastBottom) {
      firstOverflowIndex = index;
      break;
    }
  }

  if (firstOverflowIndex < 0) {
    staying.push(...flow);
    return { staying, overflow };
  }

  staying.push(...flow.slice(0, firstOverflowIndex));
  overflow.push(...flow.slice(firstOverflowIndex));
  return { staying, overflow: sortOverflowByFlowOrder(overflow) };
}

function resolvePaginationAllRows(
  props: Record<string, unknown>,
  table: ProductTableProps
): ProductTableRow[] {
  const stored = props[PREVIEW_PAGINATION_ROWS_KEY];
  if (Array.isArray(stored) && stored.length > 0) {
    return stored as ProductTableRow[];
  }
  return table.rows;
}

function mergeSegmentRows(segments: Array<{ element: CanvasElement; allRows: ProductTableRow[] }>): ProductTableRow[] {
  const byId = new Map<string, ProductTableRow>();
  const order: string[] = [];

  for (const segment of segments) {
    const props = resolveBuilderTablePropsForEdit((segment.element.props ?? {}) as Record<string, unknown>);
    const table = normalizeTablePropsForType(segment.element.type, props) as ProductTableProps;
    for (const row of table.rows) {
      if (!byId.has(row.id)) order.push(row.id);
      byId.set(row.id, row);
    }
  }

  for (const row of segments[0].allRows) {
    if (!byId.has(row.id)) {
      order.push(row.id);
      byId.set(row.id, row);
    }
  }

  return order.map((id) => byId.get(id)).filter((row): row is ProductTableRow => !!row);
}

function paginationGroupKey(props: Record<string, unknown>): string | null {
  const stored = props[PREVIEW_PAGINATION_ROWS_KEY];
  if (!Array.isArray(stored) || stored.length === 0) return null;
  return (stored as ProductTableRow[]).map((row) => row.id).join('\0');
}

function tableHasContinuationInOverflow(
  element: CanvasElement,
  overflow: CanvasElement[]
): boolean {
  if (!isTableElementType(element.type)) return false;
  const props = (element.props ?? {}) as Record<string, unknown>;
  const rangeEnd = props[PREVIEW_PAGINATION_RANGE_END_KEY];
  const allRows = props[PREVIEW_PAGINATION_ROWS_KEY];
  if (typeof rangeEnd !== 'number' || !Array.isArray(allRows) || rangeEnd >= allRows.length) {
    return false;
  }
  const key = paginationGroupKey(props);
  if (!key) return false;
  return overflow.some(
    (item) => paginationGroupKey((item.props ?? {}) as Record<string, unknown>) === key
  );
}

/** Merge split table segments back into one table before re-paginating. */
function consolidatePaginatedTablesForReflow(pages: TemplatePage[]): TemplatePage[] {
  type Segment = { pageIndex: number; element: CanvasElement; allRows: ProductTableRow[] };
  const groups = new Map<string, Segment[]>();

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    for (const element of pages[pageIndex].elements) {
      if (!isTableElementType(element.type) || element.visible === false) continue;
      const props = (element.props ?? {}) as Record<string, unknown>;
      const key = paginationGroupKey(props);
      if (!key) continue;
      const allRows = props[PREVIEW_PAGINATION_ROWS_KEY] as ProductTableRow[];
      const list = groups.get(key) ?? [];
      list.push({ pageIndex, element, allRows });
      groups.set(key, list);
    }
  }

  if (groups.size === 0) return pages;

  const next = cloneTemplatePages(pages);

  for (const [, segments] of groups) {
    segments.sort((a, b) => a.pageIndex - b.pageIndex || a.element.y - b.element.y);
    const groupKey = paginationGroupKey((segments[0].element.props ?? {}) as Record<string, unknown>);
    if (!groupKey) continue;

    const mergedRows = mergeSegmentRows(segments);
    const anchorOnFirstPage = segments.find((segment) => segment.pageIndex === 0);
    const anchor = anchorOnFirstPage ?? segments[0];

    for (let pageIndex = 0; pageIndex < next.length; pageIndex += 1) {
      next[pageIndex].elements = next[pageIndex].elements.filter((element) => {
        const key = paginationGroupKey((element.props ?? {}) as Record<string, unknown>);
        return key !== groupKey;
      });
    }

    const props = { ...(anchor.element.props ?? {}) } as Record<string, unknown>;
    delete props[PREVIEW_PAGINATION_RANGE_START_KEY];
    delete props[PREVIEW_PAGINATION_RANGE_END_KEY];
    props[PREVIEW_PAGINATION_ROWS_KEY] = mergedRows;
    props.rows = mergedRows;

    const existingIdx = next[0].elements.findIndex((element) => element.id === anchor.element.id);
    if (existingIdx >= 0) {
      next[0].elements[existingIdx] = { ...next[0].elements[existingIdx], props };
    } else {
      next[0].elements.push({ ...anchor.element, props });
    }
  }

  return next;
}

function buildTableSegment(
  elementType: string,
  fullTable: ProductTableProps,
  rowStart: number,
  rowEnd: number,
  options: { showHeader: boolean; isLastSegment: boolean },
  allRowsForSummary?: ProductTableRow[]
): { tableProps: Record<string, unknown>; height: number } {
  const displayRows = fullTable.rows.slice(rowStart, rowEnd);
  const rowsForSummary = allRowsForSummary ?? fullTable.rows;
  let segmentTable: ProductTableProps = {
    ...fullTable,
    rows: displayRows,
    showHeader: options.showHeader,
  };

  if (isInvoiceTable2Type(elementType)) {
    if (!options.isLastSegment) {
      segmentTable = {
        ...segmentTable,
        showSummaryTable: false,
        summaryRows: [],
        computedSummaryRows: [],
      };
    } else {
      const recalculated = recalculateInvoiceTable2({
        ...fullTable,
        rows: rowsForSummary,
      });
      segmentTable = {
        ...segmentTable,
        showSummaryTable: recalculated.showSummaryTable,
        summaryRows: recalculated.summaryRows,
        computedSummaryRows: recalculated.computedSummaryRows,
      };
    }
  } else if (isInvoiceTable3Type(elementType)) {
    segmentTable = {
      ...segmentTable,
      showTotalFooter:
        options.isLastSegment
        && (fullTable as ProductTableProps & { showTotalFooter?: boolean }).showTotalFooter !== false,
    };
  } else {
    segmentTable = {
      ...segmentTable,
      showGrandTotalFooter: options.isLastSegment && fullTable.showGrandTotalFooter !== false,
    };
  }

  const fitted = fitTableHeightsPreservingWidths(
    elementType,
    productTablePropsToRecord(segmentTable)
  );
  return { tableProps: fitted.tableProps, height: fitted.height };
}

function findTableRowSplitIndex(
  elementType: string,
  table: ProductTableProps,
  availableHeight: number,
  allRowsForSummary?: ProductTableRow[]
): number {
  const totalRows = table.rows.length;
  if (totalRows === 0) return 0;

  for (let rowCount = 1; rowCount <= totalRows; rowCount += 1) {
    const isLast = rowCount === totalRows;
    const { height } = buildTableSegment(
      elementType,
      table,
      0,
      rowCount,
      {
        showHeader: table.showHeader !== false,
        isLastSegment: isLast,
      },
      allRowsForSummary
    );
    if (height > availableHeight + PUSH_TOLERANCE_PX) {
      return Math.max(0, rowCount - 1);
    }
  }

  return totalRows;
}

function getTableContentBottomLimit(
  elements: CanvasElement[],
  table: CanvasElement,
  pageContentBottomLimit: number
): number {
  const tableBottom = table.y + table.height;
  let maxTableBottom = pageContentBottomLimit;

  for (const element of elements) {
    if (element.id === table.id || element.visible === false) continue;
    if (isPinnedPreviewElement(element)) continue;
    if (Math.abs(element.y - table.y) <= ROW_Y_TOLERANCE_PX) continue;
    if (element.y + element.height <= table.y + PUSH_TOLERANCE_PX) continue;
    // Only blockers below the table's current bottom (signature between stacked tables).
    if (element.y < tableBottom - PUSH_TOLERANCE_PX) continue;
    maxTableBottom = Math.min(maxTableBottom, element.y - FLOW_GAP_PX);
  }

  return maxTableBottom;
}

/** Split table rows across pages when the fitted table extends past the page bottom. */
function splitOverflowTables(
  elements: CanvasElement[],
  contentBottomLimit: number
): { elements: CanvasElement[]; overflow: CanvasElement[] } {
  const tables = elements
    .filter((element) => element.visible !== false && isTableElementType(element.type))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  if (tables.length === 0) return { elements, overflow: [] };

  let result = elements.map((element) => ({ ...element, props: { ...(element.props ?? {}) } }));
  const overflow: CanvasElement[] = [];

  for (const table of tables) {
    const index = result.findIndex((element) => element.id === table.id);
    if (index < 0) continue;

    const element = result[index];
    if (element.y >= contentBottomLimit - PUSH_TOLERANCE_PX) {
      continue;
    }

    const elementProps = (element.props ?? {}) as Record<string, unknown>;
    const fitted = fitTableHeightsPreservingWidths(element.type, elementProps);
    const fullTable = normalizeTablePropsForType(
      element.type,
      fitted.tableProps
    ) as ProductTableProps;
    const allRows = resolvePaginationAllRows(elementProps, fullTable);
    const tableForSplit: ProductTableProps = { ...fullTable, rows: allRows };
    const tableBottomLimit = getTableContentBottomLimit(result, element, contentBottomLimit);
    const availableHeight = tableBottomLimit - element.y;
    if (availableHeight <= PUSH_TOLERANCE_PX) {
      continue;
    }

    const fullHeight = resolveTableElementSize(element.type, tableForSplit).height;

    if (fullHeight <= availableHeight + PUSH_TOLERANCE_PX) {
      const props = {
        ...elementProps,
        ...fitted.tableProps,
        [PREVIEW_PAGINATION_ROWS_KEY]: allRows,
      };
      delete props[PREVIEW_PAGINATION_RANGE_START_KEY];
      delete props[PREVIEW_PAGINATION_RANGE_END_KEY];
      result[index] = {
        ...element,
        height: fullHeight,
        props,
      };
      continue;
    }

    const splitIndex = findTableRowSplitIndex(
      element.type,
      tableForSplit,
      availableHeight,
      allRows
    );
    if (splitIndex >= tableForSplit.rows.length) {
      const props = {
        ...elementProps,
        ...fitted.tableProps,
        [PREVIEW_PAGINATION_ROWS_KEY]: allRows,
      };
      delete props[PREVIEW_PAGINATION_RANGE_START_KEY];
      delete props[PREVIEW_PAGINATION_RANGE_END_KEY];
      result[index] = {
        ...element,
        height: fullHeight,
        props,
      };
      continue;
    }

    if (splitIndex <= 0) {
      const continuationSegment = buildTableSegment(
        element.type,
        tableForSplit,
        0,
        tableForSplit.rows.length,
        {
          showHeader: fullTable.showHeader !== false,
          isLastSegment: true,
        },
        allRows
      );
      overflow.push({
        ...element,
        id: uuidv4(),
        height: continuationSegment.height,
        props: {
          ...continuationSegment.tableProps,
          [PREVIEW_PAGINATION_ROWS_KEY]: allRows,
          [PREVIEW_PAGINATION_RANGE_START_KEY]: 0,
          [PREVIEW_PAGINATION_RANGE_END_KEY]: allRows.length,
        },
      });
      result = result.filter((item) => item.id !== element.id);
      continue;
    }

    const pageSegment = buildTableSegment(
      element.type,
      tableForSplit,
      0,
      splitIndex,
      {
        showHeader: fullTable.showHeader !== false,
        isLastSegment: false,
      },
      allRows
    );
    result[index] = {
      ...element,
      height: pageSegment.height,
      props: {
        ...elementProps,
        ...pageSegment.tableProps,
        [PREVIEW_PAGINATION_ROWS_KEY]: allRows,
        [PREVIEW_PAGINATION_RANGE_START_KEY]: 0,
        [PREVIEW_PAGINATION_RANGE_END_KEY]: splitIndex,
      },
    };

    const continuationSegment = buildTableSegment(
      element.type,
      tableForSplit,
      splitIndex,
      tableForSplit.rows.length,
      {
        showHeader: true,
        isLastSegment: true,
      },
      allRows
    );
    overflow.push({
      ...element,
      id: uuidv4(),
      y: element.y,
      height: continuationSegment.height,
      width: element.width,
      x: element.x,
      props: {
        ...continuationSegment.tableProps,
        [PREVIEW_PAGINATION_ROWS_KEY]: allRows,
        [PREVIEW_PAGINATION_RANGE_START_KEY]: splitIndex,
        [PREVIEW_PAGINATION_RANGE_END_KEY]: allRows.length,
      },
    });
  }

  return { elements: result, overflow };
}

/** Bottom edge of visible content on a page (for preview canvas height). */
export function measurePreviewPageContentHeight(page: TemplatePage): number {
  const { height: pageHeight } = getPageDimensions(page);
  let maxBottom = pageHeight;
  for (const element of page.elements) {
    if (element.visible === false) continue;
    maxBottom = Math.max(maxBottom, element.y + element.height);
  }
  return Math.ceil(maxBottom);
}

function reflowSinglePage(
  page: TemplatePage,
  options: PreviewReflowOptions = {}
): { page: TemplatePage; overflow: CanvasElement[] } {
  const { height: pageHeight } = getPageDimensions(page);
  const contentBottomLimit = pageHeight - page.margins.bottom;

  let elements = cloneElements(page.elements);

  const expandables = elements
    .filter(
      (element) =>
        element.visible !== false
        && (isTableElementType(element.type)
          || isStructuredContentType(element.type)
          || isCardComponentType(element.type))
    )
    .sort((a, b) => a.y - b.y || a.x - b.x);

  for (const expandable of expandables) {
    const index = elements.findIndex((element) => element.id === expandable.id);
    if (index < 0) continue;

    const current = elements[index];
    let nextWidth = current.width;
    let nextHeight = current.height;
    let nextProps = current.props;

    if (isTableElementType(current.type)) {
      const fitted = resolveTableExpansion(current, options);
      nextWidth = options.trustTableProps ? current.width : Math.max(current.width, fitted.fittedWidth);
      nextHeight = fitted.fittedHeight;
      nextProps = fitted.tableProps ?? current.props;
    } else if (isStructuredContentType(current.type)) {
      nextHeight = Math.max(
        current.height,
        estimateStructuredBlockHeight(
          current.type,
          (current.props ?? {}) as Record<string, unknown>,
          current.width,
          current.height
        )
      );
    } else if (isCardComponentType(current.type)) {
      nextHeight = estimateCardBlockHeight(
        current.type,
        (current.props ?? {}) as Record<string, unknown>,
        current.width,
        current.height
      );
    }

    elements[index] = {
      ...current,
      width: nextWidth,
      height: nextHeight,
      props: nextProps,
    };
  }

  elements = flowLayoutBelowExpandables(elements);

  const tableSplit = splitOverflowTables(elements, contentBottomLimit);
  elements = tableSplit.elements;
  const tableOverflow = tableSplit.overflow;

  elements = flowLayoutBelowExpandables(elements);

  const spill = splitOverflowElements(elements, contentBottomLimit);
  return {
    page: { ...page, elements: spill.staying },
    overflow: sortOverflowByFlowOrder([...tableOverflow, ...spill.overflow]),
  };
}

/**
 * Per-page layout:
 * 1. Grow tables and push stacked content down
 * 2. Split table rows that cross the page bottom (once)
 * 3. Re-stack content to actual post-split heights
 * 4. Spill elements with no room to the next page
 */
function layoutPageElements(
  page: TemplatePage,
  elements: CanvasElement[],
  startY?: number
): { page: TemplatePage; overflow: CanvasElement[] } {
  return layoutPageDocumentFlow(page, elements, startY);
}

/** Grow tables vertically (fixed width) and push stacked content below — preview-only. */
function reflowSinglePageTablesOnly(page: TemplatePage): {
  page: TemplatePage;
  overflow: CanvasElement[];
} {
  return layoutPageElements(page, page.elements);
}

function pageNeedsTableReflow(page: TemplatePage): boolean {
  const { height: pageHeight } = getPageDimensions(page);
  const contentBottomLimit = pageHeight - page.margins.bottom;

  return page.elements.some((element) => {
    if (!isTableElementType(element.type) || element.visible === false) return false;
    const fitted = fitTableHeightsPreservingWidths(
      element.type,
      (element.props ?? {}) as Record<string, unknown>
    );
    const table = normalizeTablePropsForType(element.type, element.props ?? {}) as ProductTableProps;
    const fittedTable = normalizeTablePropsForType(
      element.type,
      fitted.tableProps
    ) as ProductTableProps;
    const allRows = resolvePaginationAllRows(
      (element.props ?? {}) as Record<string, unknown>,
      fittedTable
    );
    const tableForMeasure: ProductTableProps = { ...fittedTable, rows: allRows };
    const fittedHeight = resolveTableElementSize(element.type, tableForMeasure).height;

    if (fittedHeight > element.height + PUSH_TOLERANCE_PX) return true;
    if (element.y + fittedHeight > contentBottomLimit + PUSH_TOLERANCE_PX) return true;
    if (allRows.length !== table.rows.length) return true;
    if (contentOverlapsExpandedBlock(page, element, fittedHeight)) return true;

    return table.rows.some((row, rowIndex) => {
      const next = fittedTable.rows[rowIndex];
      if (!next) return true;
      return next.heightPx > row.heightPx + PUSH_TOLERANCE_PX;
    });
  });
}

/**
 * Document-style layout (Word / Google Docs / Canva Docs):
 * 1. Measure natural component heights
 * 2. Stack in document order with dynamic Y positions
 * 3. Split table rows at page boundaries (rows are indivisible)
 * 4. Spill whole components to the next page when they do not fit
 * 5. Create continuation pages automatically
 *
 * Multi-page templates from the builder stay page-by-page so authored page 2+
 * content is not merged back onto page 1 in composer / invoice preview.
 */
export function layoutDocumentPages(
  pages: TemplatePage[],
  options: DocumentLayoutOptions = {}
): TemplatePage[] {
  if (pages.length === 0) return pages;

  // Keep intentional multi-page layouts; only consolidate single-page overflow.
  if (pages.length > 1) {
    return reflowPagesForPreview(pages, options);
  }

  const source = consolidatePaginatedTablesForReflow(cloneTemplatePages(pages));
  const hasFlowContent = source.some((page) =>
    page.elements.some(
      (element) => element.visible !== false && !isPinnedPreviewElement(element)
    )
  );
  if (!hasFlowContent) {
    return applyPreviewPageNumbers(dropEmptyTrailingPages(source));
  }

  const { elements: gathered, startY } = gatherReflowElements(source);
  const layoutTemplate = source[0];
  const layoutInput: TemplatePage = {
    ...layoutTemplate,
    elements: gathered,
  };

  const result: TemplatePage[] = [];
  let pendingOverflow: CanvasElement[] = [];

  const flushOverflowPage = () => {
    if (pendingOverflow.length === 0) return;
    const continuationPage: TemplatePage = {
      id: uuidv4(),
      name: `Page ${result.length + 1}`,
      margins: { ...layoutTemplate.margins },
      pageSize: layoutTemplate.pageSize ? { ...layoutTemplate.pageSize } : undefined,
      elements: stackOverflowElementsAtPageTop(pendingOverflow, layoutTemplate.margins),
    };
    const laid = layoutPageElements(continuationPage, continuationPage.elements, layoutTemplate.margins.top);
    result.push(laid.page);
    pendingOverflow = laid.overflow;
  };

  const first = layoutPageElements(layoutInput, gathered, startY);
  result.push(first.page);
  pendingOverflow = first.overflow;

  let guard = 0;
  while (pendingOverflow.length > 0 && guard < 256) {
    guard += 1;
    flushOverflowPage();
  }

  return applyPreviewPageNumbers(dropEmptyTrailingPages(result));
}

/** @deprecated Use layoutDocumentPages */
export const reflowTablesOnlyForPreview = layoutDocumentPages;

/**
 * Builder editor layout — per-page reflow with row splits (matches preview rendering).
 * Gathers flow elements from all pages, stacks them, then paginates page by page.
 * Multi-page templates keep each authored page instead of consolidating to page 1.
 */
export function layoutBuilderPages(pages: TemplatePage[]): TemplatePage[] {
  if (pages.length === 0) return pages;

  // Preserve intentional multi-page authoring (same as preview).
  if (pages.length > 1) {
    return reflowPagesForPreview(pages, { trustTableProps: true });
  }

  const consolidated = consolidatePaginatedTablesForReflow(cloneTemplatePages(pages));
  const source = fitAllTableHeightsInPages(consolidated);
  const hasFlowContent = source.some((page) =>
    page.elements.some(
      (element) => element.visible !== false && !isPinnedPreviewElement(element)
    )
  );
  if (!hasFlowContent) {
    return applyPreviewPageNumbers(dropEmptyTrailingPages(source));
  }

  const { elements: gathered, startY } = gatherReflowElements(source);
  const layoutTemplate = source[0];

  const pinned = layoutTemplate.elements.filter(
    (element) => element.visible !== false && isPinnedPreviewElement(element)
  );
  const flowElements = preserveFlowElementPositions(gathered, layoutTemplate.margins);
  const firstPage: TemplatePage = {
    ...layoutTemplate,
    elements: [...pinned, ...flowElements],
  };

  const result: TemplatePage[] = [];
  let pendingOverflow: CanvasElement[] = [];

  const flushOverflowPage = (anchorPage: TemplatePage) => {
    if (pendingOverflow.length === 0) return;
    const continuationPage = createContinuationPage(
      result.length + 1,
      anchorPage,
      stackOverflowElementsAtPageTop(pendingOverflow, layoutTemplate.margins)
    );
    const laid = layoutPageElements(
      continuationPage,
      continuationPage.elements,
      layoutTemplate.margins.top
    );
    result.push(laid.page);
    pendingOverflow = laid.overflow;
  };

  const first = layoutPageElements(firstPage, firstPage.elements, startY);
  result.push(first.page);
  pendingOverflow = first.overflow;

  let guard = 0;
  while (pendingOverflow.length > 0 && guard < 256) {
    guard += 1;
    flushOverflowPage(result[result.length - 1]);
    if (pendingOverflow.length === 0) break;
  }

  return applyPreviewPageNumbers(dropEmptyTrailingPages(result));
}

export function layoutDocumentPagesForBuilder(pages: TemplatePage[]): TemplatePage[] {
  return layoutBuilderPages(pages);
}

export function prepareDocumentLayoutPages(
  pages: TemplatePage[],
  options: DocumentLayoutOptions = {}
): TemplatePage[] {
  return layoutDocumentPages(pages, options);
}

export function reflowTablesOnlyForBuilder(pages: TemplatePage[]): TemplatePage[] {
  return layoutDocumentPagesForBuilder(pages);
}

function createContinuationPage(
  pageNumber: number,
  sourcePage: TemplatePage,
  overflow: CanvasElement[]
): TemplatePage {
  return {
    id: uuidv4(),
    name: `Page ${pageNumber}`,
    margins: { ...sourcePage.margins },
    pageSize: sourcePage.pageSize ? { ...sourcePage.pageSize } : undefined,
    elements: repositionForPageTop(overflow, sourcePage.margins),
  };
}

function expandPreviewCardHeights(pages: TemplatePage[]): TemplatePage[] {
  let changed = false;
  const nextPages = pages.map((page) => ({
    ...page,
    elements: page.elements.map((element) => {
      if (element.visible === false || !isCardComponentType(element.type)) return element;
      const height = estimateCardBlockHeight(
        element.type,
        (element.props ?? {}) as Record<string, unknown>,
        element.width,
        element.height
      );
      if (height === element.height) return element;
      changed = true;
      return { ...element, height };
    }),
  }));
  return changed ? nextPages : pages;
}

/**
 * Expand tables / structured blocks to their fitted height, push content below
 * downward, and spill past the page bottom onto the next page (creating one if needed).
 * Card heights always expand to fit custom fields even when no table reflow is needed.
 */
function reflowPagesWithExpandedCards(pages: TemplatePage[]): TemplatePage[] {
  return applyPreviewPageNumbers(
    pages.map((page) => ({
      ...page,
      elements: flowLayoutBelowExpandables(page.elements),
    }))
  );
}

/**
 * Grow cards to fit their content and push stacked elements below (invoice composer).
 * Skips table expansion so template table positions stay intact.
 */
export function fitPreviewCardLayout(pages: TemplatePage[]): TemplatePage[] {
  if (pages.length === 0) return pages;
  const withCardHeights = expandPreviewCardHeights(pages);
  if (withCardHeights === pages) return pages;
  return withCardHeights.map((page) => ({
    ...page,
    elements: flowLayoutBelowExpandables(page.elements),
  }));
}

export function reflowPagesForPreview(
  pages: TemplatePage[],
  options: PreviewReflowOptions = {}
): TemplatePage[] {
  if (pages.length === 0) return pages;

  const source = cloneTemplatePages(pages);
  const tableOptions: PreviewReflowOptions = { trustTableProps: true, ...options };

  const needsReflow = previewPagesNeedReflow(source, tableOptions);
  const withCardHeights = expandPreviewCardHeights(source);
  const cardHeightsChanged = withCardHeights !== source;

  if (!needsReflow && !cardHeightsChanged) return source;
  if (!needsReflow && cardHeightsChanged) return reflowPagesWithExpandedCards(withCardHeights);

  const result: TemplatePage[] = [];
  let pendingOverflow: CanvasElement[] = [];

  const flushOverflow = (anchorPage: TemplatePage) => {
    if (pendingOverflow.length === 0) return;
    const continuation = createContinuationPage(result.length + 1, anchorPage, pendingOverflow);
    const reflowed = reflowSinglePage(continuation, tableOptions);
    result.push(reflowed.page);
    pendingOverflow = reflowed.overflow;
  };

  for (const sourcePage of withCardHeights) {
    flushOverflow(result.length > 0 ? result[result.length - 1] : sourcePage);

    const reflowed = reflowSinglePage(sourcePage, tableOptions);
    result.push(reflowed.page);
    pendingOverflow = reflowed.overflow;
  }

  let guard = 0;
  while (pendingOverflow.length > 0 && guard < 8) {
    guard += 1;
    const sourcePage = result[result.length - 1];
    flushOverflow(sourcePage);
    if (pendingOverflow.length === 0) break;
  }

  return applyPreviewPageNumbers(result);
}

/** Apply placeholders/form data then reflow only when content extends past its box. */
export function preparePreviewPages(
  pages: TemplatePage[],
  options: PreviewReflowOptions = {}
): TemplatePage[] {
  return reflowPagesForPreview(pages, options);
}
