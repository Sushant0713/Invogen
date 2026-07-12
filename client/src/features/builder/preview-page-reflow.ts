import { v4 as uuidv4 } from 'uuid';
import { ComponentType } from '@invogen/shared';
import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { getPageDimensions, type PageMargins } from './builder-dnd';
import { isTableElementType, productTablePropsToRecord, resolveBuilderTablePropsForEdit, PREVIEW_PAGINATION_ROWS_KEY, PREVIEW_PAGINATION_RANGE_START_KEY, PREVIEW_PAGINATION_RANGE_END_KEY, PREVIEW_PAGINATION_TABLE_ID_KEY, resolvePaginationTableId, isTableContinuationSegment } from './product-table';
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
import {
  appendFootersFromMasterPage,
  getFlowContentBottomLimit,
  isDocumentFooterElement,
  normalizeDocumentFooters,
} from './document-footer';

const PUSH_TOLERANCE_PX = 2;
const FLOW_GAP_PX = 12;
const ROW_Y_TOLERANCE_PX = 24;
const LOGICAL_FLOW_Y_KEY = '__logicalFlowY';

/** Word-style: repeat column titles on Page 1 and every continuation page. */
function resolvePaginatedSegmentShowHeader(
  fullTable: Pick<ProductTableProps, 'showHeader'>
): boolean {
  return fullTable.showHeader !== false;
}

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

/** Background / fixed layers — do not participate in document flow. */
export function isPinnedPreviewElement(element: CanvasElement): boolean {
  if (element.visible === false) return false;
  if (element.type === ComponentType.WATERMARK) return true;
  if (isDocumentFooterElement(element)) return true;
  // Invoice watermarks are often plain IMAGE/STAMP — keep authored x/y during reflow.
  if (element.type === ComponentType.IMAGE || element.type === ComponentType.STAMP) {
    return true;
  }
  return false;
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

function pageContentOverflows(page: TemplatePage): boolean {
  const contentBottom = getFlowContentBottomLimit(page);
  return page.elements.some((element) => {
    if (element.visible === false || isPinnedPreviewElement(element)) return false;
    return element.y + element.height > contentBottom + PUSH_TOLERANCE_PX;
  });
}

/** True when preview layout must expand tables/blocks, push content below, or paginate. */
export function pageNeedsReflow(page: TemplatePage, options: PreviewReflowOptions = {}): boolean {
  if (pageContentOverflows(page)) return true;
  if (pageNeedsTableReflow(page)) return true;

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

/** Keep user tabs and pages with flow content; drop footer-only auto pages. */
function shouldKeepTrailingPage(page: TemplatePage): boolean {
  // Explicitly added page tabs stay, even if currently empty.
  if (page.userAuthored) return true;
  // Auto pages need real document-flow content (not only footer/watermark).
  return pageHasVisibleContent(page);
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

/** Remove empty continuation pages and renumber tabs for the editor. */
export function normalizeBuilderPagesForEditor(pages: TemplatePage[]): TemplatePage[] {
  return applyPreviewPageNumbers(dropEmptyTrailingPages(pages));
}

/** Never drop page 1 — only remove empty auto-generated continuation pages after it. */
function dropEmptyTrailingPages(pages: TemplatePage[]): TemplatePage[] {
  if (pages.length <= 1) return pages;
  const head = [pages[0]];
  const tail = pages.slice(1).filter(shouldKeepTrailingPage);
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

/** Stack spilled elements from the top margin in document order (continuation pages only). */
function stackOverflowElementsAtPageTop(
  elements: CanvasElement[],
  margins: PageMargins
): CanvasElement[] {
  if (elements.length === 0) return elements;

  const ordered = [...elements].sort(
    (a, b) => getLogicalFlowY(a) - getLogicalFlowY(b) || a.x - b.x
  );

  let cursorY = margins.top;
  return ordered.map((element) => {
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

function elementsShareColumn(a: CanvasElement, b: CanvasElement): boolean {
  // Require real horizontal overlap so side-by-side columns (logo / invoice meta
  // beside a company card) are not treated as stacked document flow.
  const overlap =
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  return overlap > Math.min(a.width, b.width) * 0.15;
}

function isStackedBelow(anchor: CanvasElement, element: CanvasElement): boolean {
  if (element.id === anchor.id || element.visible === false) return false;
  if (isPinnedPreviewElement(element)) return false;

  const anchorBottom = anchor.y + anchor.height;

  // Side-by-side on the same row — not "below" for flow purposes.
  if (Math.abs(element.y - anchor.y) <= ROW_Y_TOLERANCE_PX) return false;

  // Entirely above the anchor.
  if (element.y + element.height <= anchor.y + PUSH_TOLERANCE_PX) return false;

  // Starts at or below the anchor bottom (Word-style flow).
  if (element.y >= anchorBottom - ROW_Y_TOLERANCE_PX) return true;

  // Vertically overlapping the expanded box: only push if in the same column.
  // Otherwise invoice # / date / logo beside a growing card get dragged down and collide.
  const verticallyOverlaps =
    element.y < anchorBottom - PUSH_TOLERANCE_PX
    && element.y + element.height > anchor.y + PUSH_TOLERANCE_PX;
  return verticallyOverlaps && elementsShareColumn(anchor, element);
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

function pushStackedElementsBelowAnchor(
  elements: CanvasElement[],
  anchorIndex: number,
  heightDelta: number
): { elements: CanvasElement[]; changed: boolean } {
  const anchor = elements[anchorIndex];
  const anchorBottom = anchor.y + anchor.height;
  const minYBelowAnchor = anchorBottom + FLOW_GAP_PX;

  const below = elements.filter(
    (element) => element.id !== anchor.id && isStackedBelow(anchor, element)
  );
  if (below.length === 0) return { elements, changed: false };

  const needsOverlapFix = below.some(
    (element) =>
      element.y < anchorBottom - PUSH_TOLERANCE_PX
      && element.y + element.height > anchor.y + PUSH_TOLERANCE_PX
  );
  // Still resolve overlaps when height was already expanded in a prior pass.
  if (Math.abs(heightDelta) <= PUSH_TOLERANCE_PX && !needsOverlapFix) {
    return { elements, changed: false };
  }

  let result = elements;
  let changed = false;
  const rows = groupElementsIntoRows(below);

  for (const row of rows) {
    const rowTop = Math.min(...row.map((element) => element.y));
    let rowDelta = heightDelta;

    // Resolve overlap only — preserve authored spacing when already clear.
    const overlapsAnchor = row.some(
      (element) =>
        element.y < anchorBottom - PUSH_TOLERANCE_PX
        && element.y + element.height > anchor.y + PUSH_TOLERANCE_PX
    );
    const projectedTop = rowTop + rowDelta;
    if (overlapsAnchor || projectedTop < minYBelowAnchor - PUSH_TOLERANCE_PX) {
      rowDelta = Math.max(rowDelta, minYBelowAnchor - rowTop);
    }

    if (Math.abs(rowDelta) <= PUSH_TOLERANCE_PX) continue;

    for (const element of row) {
      const index = result.findIndex((item) => item.id === element.id);
      if (index < 0) continue;
      const targetY = result[index].y + rowDelta;
      if (Math.abs(result[index].y - targetY) > PUSH_TOLERANCE_PX) {
        result[index] = withLogicalFlowY({ ...result[index], y: targetY }, targetY);
        changed = true;
      }
    }
  }

  return { elements: result, changed };
}

type ElementGeometry = { y: number; height: number };

function snapshotElementGeometry(elements: CanvasElement[]): Map<string, ElementGeometry> {
  return new Map(elements.map((element) => [element.id, { y: element.y, height: element.height }]));
}

/** Push rows below each table after page-aware split — avoids gap from expand-then-split. */
function pushBelowTablesFromBaselines(
  elements: CanvasElement[],
  baselines: Map<string, ElementGeometry>
): CanvasElement[] {
  let result = elements;
  const tables = result
    .filter((element) => element.visible !== false && isTableElementType(element.type))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  for (const table of tables) {
    const index = result.findIndex((element) => element.id === table.id);
    if (index < 0) continue;
    const baseline = baselines.get(table.id);
    if (!baseline) continue;
    const current = result[index];
    const heightDelta = current.height - baseline.height;
    const push = pushStackedElementsBelowAnchor(result, index, heightDelta);
    result = push.elements;
  }

  return result;
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
      const heightDelta = newHeight - current.height;

      if (Math.abs(heightDelta) > PUSH_TOLERANCE_PX) {
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

      const push = pushStackedElementsBelowAnchor(result, index, heightDelta);
      result = push.elements;
      if (push.changed) changed = true;
    }

    if (!changed) break;
  }

  return result;
}

function expandCardsAndPushBelow(elements: CanvasElement[]): CanvasElement[] {
  let result = cloneElements(elements);

  for (let pass = 0; pass < 16; pass += 1) {
    let changed = false;
    const cards = result
      .filter((element) => element.visible !== false && isCardComponentType(element.type))
      .sort((a, b) => a.y - b.y || a.x - b.x);

    for (const card of cards) {
      const index = result.findIndex((element) => element.id === card.id);
      if (index < 0) continue;

      const current = result[index];
      const newHeight = estimateCardBlockHeight(
        current.type,
        (current.props ?? {}) as Record<string, unknown>,
        current.width,
        current.height
      );
      const heightDelta = newHeight - current.height;

      if (Math.abs(heightDelta) > PUSH_TOLERANCE_PX) {
        result[index] = { ...current, height: newHeight };
        changed = true;
      }

      const push = pushStackedElementsBelowAnchor(result, index, heightDelta);
      result = push.elements;
      if (push.changed) changed = true;
    }

    if (!changed) break;
  }

  return result;
}

function expandStructuredBlocksAndPushBelow(elements: CanvasElement[]): CanvasElement[] {
  let result = cloneElements(elements);

  for (let pass = 0; pass < 16; pass += 1) {
    let changed = false;
    const blocks = result
      .filter((element) => element.visible !== false && isStructuredContentType(element.type))
      .sort((a, b) => a.y - b.y || a.x - b.x);

    for (const block of blocks) {
      const index = result.findIndex((element) => element.id === block.id);
      if (index < 0) continue;

      const current = result[index];
      const newHeight = estimateStructuredBlockHeight(
        current.type,
        (current.props ?? {}) as Record<string, unknown>,
        current.width,
        current.height
      );
      const heightDelta = newHeight - current.height;

      if (Math.abs(heightDelta) > PUSH_TOLERANCE_PX) {
        result[index] = { ...current, height: newHeight };
        changed = true;
      }

      const push = pushStackedElementsBelowAnchor(result, index, heightDelta);
      result = push.elements;
      if (push.changed) changed = true;
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
        result[elementIndex] = withLogicalFlowY({ ...element, y: minYBelow }, minYBelow);
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
  anchorElementId: string,
  range?: { start: number; end: number }
): Record<string, unknown> {
  const props = {
    ...elementProps,
    ...segmentProps,
    [PREVIEW_PAGINATION_ROWS_KEY]: allRows,
    [PREVIEW_PAGINATION_TABLE_ID_KEY]: resolvePaginationTableId(elementProps, anchorElementId),
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
  const anchorId = resolvePaginationTableId(elementProps, element.id);
  return {
    ...element,
    id: uuidv4(),
    x: element.x,
    width: element.width,
    y: element.y,
    height,
    props: tablePropsForPageSegment(elementProps, segmentProps, allRows, anchorId, {
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
      { showHeader: resolvePaginatedSegmentShowHeader(fullTable), isLastSegment: true },
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
        props: tablePropsForPageSegment(elementProps, fitted.tableProps, allRows, element.id),
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
      { showHeader: resolvePaginatedSegmentShowHeader(fullTable), isLastSegment: true },
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
    { showHeader: resolvePaginatedSegmentShowHeader(fullTable), isLastSegment: false },
    allRows
  );
  const continuationSegment = buildTableSegment(
    element.type,
    tableForSplit,
    splitIndex,
    allRows.length,
    { showHeader: resolvePaginatedSegmentShowHeader(fullTable), isLastSegment: true },
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
        element.id,
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
  const contentBottom = getFlowContentBottomLimit(page);

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

  if (flow.length === 0) {
    return { staying, overflow };
  }

  // Per-element spill — never drop a whole "row" of siblings when one tall table
  // overflows. (Row-based spill was removing headers/components above the table
  // when they shared a Y-band within ROW_Y_TOLERANCE, or sat after an unsplit table.)
  for (const element of flow) {
    const top = element.y;
    const bottom = element.y + element.height;
    const startsPastBottom = top >= contentBottomLimit - PUSH_TOLERANCE_PX;
    const extendsPastBottom = bottom > contentBottomLimit + PUSH_TOLERANCE_PX;

    if (startsPastBottom || extendsPastBottom) {
      overflow.push(element);
    } else {
      staying.push(element);
    }
  }

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
  const paginationIdLists = segments.map((segment) => {
    const props = resolveBuilderTablePropsForEdit((segment.element.props ?? {}) as Record<string, unknown>);
    const stored = props[PREVIEW_PAGINATION_ROWS_KEY];
    if (Array.isArray(stored) && stored.length > 0) {
      return (stored as ProductTableRow[]).map((row) => row.id);
    }
    const table = normalizeTablePropsForType(segment.element.type, props) as ProductTableProps;
    return table.rows.map((row) => row.id);
  });

  let authoritativeIds = paginationIdLists[0] ?? [];
  for (let index = 1; index < paginationIdLists.length; index += 1) {
    const ids = paginationIdLists[index];
    if (ids.length === 0) continue;
    const allowed = new Set(ids);
    authoritativeIds = authoritativeIds.filter((id) => allowed.has(id));
    if (authoritativeIds.length === 0) {
      authoritativeIds = ids;
    }
  }

  for (const segment of segments) {
    const props = resolveBuilderTablePropsForEdit((segment.element.props ?? {}) as Record<string, unknown>);
    const table = normalizeTablePropsForType(segment.element.type, props) as ProductTableProps;
    for (const row of table.rows) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
    const stored = props[PREVIEW_PAGINATION_ROWS_KEY];
    if (Array.isArray(stored)) {
      for (const row of stored as ProductTableRow[]) {
        byId.set(row.id, row);
      }
    }
  }

  const order =
    authoritativeIds.length > 0
      ? authoritativeIds
      : segments[0].allRows.map((row) => row.id);

  return order.map((id) => byId.get(id)).filter((row): row is ProductTableRow => !!row);
}

function paginationGroupKey(props: Record<string, unknown>): string | null {
  const tableId = props[PREVIEW_PAGINATION_TABLE_ID_KEY];
  if (typeof tableId === 'string' && tableId.length > 0) {
    return `table:${tableId}`;
  }
  const stored = props[PREVIEW_PAGINATION_ROWS_KEY];
  if (!Array.isArray(stored) || stored.length === 0) return null;
  return `rows:${(stored as ProductTableRow[]).map((row) => row.id).join('\0')}`;
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
      const allRows = resolvePaginationAllRows(
        props,
        normalizeTablePropsForType(element.type, props) as ProductTableProps
      );
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

    // Only merge real cross-page continuations. Independent page-2/3 tables must
    // stay put — previously every paginated table was forced onto page 1.
    const hasCrossPageContinuation =
      segments.length > 1
      || segments.some((segment) =>
        isTableContinuationSegment((segment.element.props ?? {}) as Record<string, unknown>)
      );
    if (!hasCrossPageContinuation) continue;

    const groupTableId = (segments[0].element.props ?? {})[PREVIEW_PAGINATION_TABLE_ID_KEY];
    const mergedRows = mergeSegmentRows(segments);

    // Prefer the page-1 head; otherwise keep the table on its own page.
    const primary =
      segments.find((segment) => segment.pageIndex === 0)
      ?? segments.find(
        (segment) =>
          !isTableContinuationSegment((segment.element.props ?? {}) as Record<string, unknown>)
      )
      ?? segments[0];
    const targetPageIndex = primary.pageIndex;

    for (let pageIndex = 0; pageIndex < next.length; pageIndex += 1) {
      next[pageIndex].elements = next[pageIndex].elements.filter((element) => {
        const props = (element.props ?? {}) as Record<string, unknown>;
        const key = paginationGroupKey(props);
        if (key === groupKey) return false;
        if (
          typeof groupTableId === 'string'
          && props[PREVIEW_PAGINATION_TABLE_ID_KEY] === groupTableId
        ) {
          return false;
        }
        return true;
      });
    }

    const props = { ...(primary.element.props ?? {}) } as Record<string, unknown>;
    delete props[PREVIEW_PAGINATION_RANGE_START_KEY];
    delete props[PREVIEW_PAGINATION_RANGE_END_KEY];
    props[PREVIEW_PAGINATION_ROWS_KEY] = mergedRows;
    props[PREVIEW_PAGINATION_TABLE_ID_KEY] = resolvePaginationTableId(
      props,
      primary.element.id
    );
    props.rows = mergedRows;

    const targetPage = next[targetPageIndex];
    if (!targetPage) continue;

    const existingIdx = targetPage.elements.findIndex(
      (element) => element.id === primary.element.id
    );
    const restored = {
      ...primary.element,
      props,
      y: primary.element.y,
    };
    if (existingIdx >= 0) {
      targetPage.elements[existingIdx] = {
        ...targetPage.elements[existingIdx],
        ...restored,
      };
    } else {
      targetPage.elements.push(restored);
    }
  }

  return next;
}

/**
 * After a continuation page is deleted, keep the Page 1 anchor showing only rows that fit
 * on that page. Remaining rows stay in pagination metadata until the next layout pass.
 */
function fitPaginatedTableAnchorWithoutContinuation(pages: TemplatePage[]): TemplatePage[] {
  if (pages.length === 0) return pages;
  const next = cloneTemplatePages(pages);
  const page = next[0];
  const contentBottomLimit = getFlowContentBottomLimit(page);

  let elements = cloneElements(page.elements);
  const tables = elements
    .filter((element) => element.visible !== false && isTableElementType(element.type))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  for (const table of tables) {
    const index = elements.findIndex((element) => element.id === table.id);
    if (index < 0) continue;

    const element = elements[index];
    const elementProps = (element.props ?? {}) as Record<string, unknown>;
    const fitted = fitTableHeightsPreservingWidths(element.type, elementProps);
    const fullTable = normalizeTablePropsForType(
      element.type,
      fitted.tableProps
    ) as ProductTableProps;
    const allRows = resolvePaginationAllRows(elementProps, fullTable);
    if (allRows.length === 0) continue;

    const tableForMeasure = { ...fullTable, rows: allRows };
    const tableBottomLimit = getTableContentBottomLimit(elements, element, contentBottomLimit);
    const availableHeight = tableBottomLimit - element.y;
    if (availableHeight <= PUSH_TOLERANCE_PX) continue;

    let rowCount = findTableRowSplitIndex(
      element.type,
      tableForMeasure,
      availableHeight,
      allRows
    );
    if (rowCount <= 0) rowCount = 1;
    rowCount = Math.min(rowCount, allRows.length);

    const pageSegment = buildTableSegment(
      element.type,
      tableForMeasure,
      0,
      rowCount,
      {
        showHeader: resolvePaginatedSegmentShowHeader(fullTable),
        isLastSegment: rowCount >= allRows.length,
      },
      allRows
    );
    const anchorId = resolvePaginationTableId(elementProps, element.id);
    elements[index] = {
      ...element,
      height: pageSegment.height,
      props: tablePropsForPageSegment(
        elementProps,
        pageSegment.tableProps,
        allRows,
        anchorId,
        rowCount < allRows.length ? { start: 0, end: rowCount } : undefined
      ),
    };
  }

  return [{ ...page, elements }, ...next.slice(1)];
}

/** Merge split table rows onto Page 1 after a continuation page tab is removed. */
export function absorbPaginationAfterPageDelete(pages: TemplatePage[]): TemplatePage[] {
  const consolidated = consolidatePaginatedTablesForReflow(cloneTemplatePages(pages));
  return fitPaginatedTableAnchorWithoutContinuation(consolidated);
}

/** Page 1 may only host the anchor segment — never a continuation copy at the top. */
function sanitizeAnchorPageTableDuplicates(pages: TemplatePage[]): TemplatePage[] {
  if (pages.length === 0 || !pages[0]) return pages;

  const page0 = pages[0];
  const byTableId = new Map<string, CanvasElement[]>();

  for (const element of page0.elements) {
    if (!isTableElementType(element.type) || element.visible === false) continue;
    const tableId = resolvePaginationTableId((element.props ?? {}) as Record<string, unknown>, element.id);
    const group = byTableId.get(tableId) ?? [];
    group.push(element);
    byTableId.set(tableId, group);
  }

  const removeIds = new Set<string>();

  for (const [, group] of byTableId) {
    if (group.length === 1) {
      const element = group[0];
      if (isTableContinuationSegment((element.props ?? {}) as Record<string, unknown>)) {
        removeIds.add(element.id);
      }
      continue;
    }

    const sorted = [...group].sort((a, b) => b.y - a.y);
    const anchor =
      sorted.find((element) => {
        const start = (element.props ?? {})[PREVIEW_PAGINATION_RANGE_START_KEY];
        return typeof start !== 'number' || start === 0;
      }) ?? sorted[0];

    for (const element of group) {
      if (element.id !== anchor.id) removeIds.add(element.id);
    }
  }

  if (removeIds.size === 0) return pages;

  return [
    {
      ...page0,
      elements: page0.elements.filter((element) => !removeIds.has(element.id)),
    },
    ...pages.slice(1),
  ];
}

/** Rebuild Page 2+ when row metadata overflows but no continuation tab exists. */
function ensureMissingTableContinuationPages(pages: TemplatePage[]): TemplatePage[] {
  if (pages.length === 0 || !pages[0]) return pages;

  const page0 = pages[0];
  let next = pages;
  let changed = false;

  for (const element of page0.elements) {
    if (!isTableElementType(element.type) || element.visible === false) continue;

    const elementProps = (element.props ?? {}) as Record<string, unknown>;
    const rangeEnd = elementProps[PREVIEW_PAGINATION_RANGE_END_KEY];
    const allRows = elementProps[PREVIEW_PAGINATION_ROWS_KEY];
    if (typeof rangeEnd !== 'number' || !Array.isArray(allRows) || rangeEnd >= allRows.length) {
      continue;
    }

    const tableId = resolvePaginationTableId(elementProps, element.id);
    const hasLaterPage = next.slice(1).some((page) =>
      page.elements.some(
        (candidate) =>
          isTableElementType(candidate.type)
          && resolvePaginationTableId((candidate.props ?? {}) as Record<string, unknown>, candidate.id)
            === tableId
      )
    );
    if (hasLaterPage) continue;

    const fullTable = normalizeTablePropsForType(
      element.type,
      resolveBuilderTablePropsForEdit(elementProps)
    ) as ProductTableProps;
    const rows = allRows as ProductTableRow[];
    const continuationSegment = buildTableSegment(
      element.type,
      { ...fullTable, rows },
      rangeEnd,
      rows.length,
      {
        showHeader: resolvePaginatedSegmentShowHeader(fullTable),
        isLastSegment: true,
      },
      rows
    );
    const continuation = makeTableContinuationElement(
      element,
      elementProps,
      continuationSegment.tableProps,
      rows,
      rangeEnd,
      rows.length,
      continuationSegment.height
    );
    const continuationPage = createContinuationPage(next.length + 1, page0, [continuation], page0);
    next = [...next, continuationPage];
    changed = true;
  }

  return changed ? applyPreviewPageNumbers(dropEmptyTrailingPages(next)) : next;
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
        showHeader: resolvePaginatedSegmentShowHeader(table),
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
  // Use the table's current box — not its full fitted height — so content that will be
  // pushed/spilled (logo below a growing table) does not permanently cap row capacity.
  const tableBottom = table.y + table.height;
  let maxTableBottom = pageContentBottomLimit;

  const tablesFurtherBelow = elements.filter(
    (element) =>
      element.id !== table.id
      && element.visible !== false
      && isTableElementType(element.type)
      && element.y >= tableBottom - PUSH_TOLERANCE_PX
  );

  for (const element of elements) {
    if (element.id === table.id || element.visible === false) continue;
    if (isPinnedPreviewElement(element)) continue;
    if (Math.abs(element.y - table.y) <= ROW_Y_TOLERANCE_PX) continue;
    if (element.y + element.height <= table.y + PUSH_TOLERANCE_PX) continue;
    // Only blockers below the table's current bottom.
    if (element.y < tableBottom - PUSH_TOLERANCE_PX) continue;

    if (isTableElementType(element.type)) {
      maxTableBottom = Math.min(maxTableBottom, element.y - FLOW_GAP_PX);
      continue;
    }

    // Non-table (logo/signature/text) caps this table only when another table sits
    // further below — i.e. content between stacked tables. Trailing logos flow.
    const hasTableFurtherBelow = tablesFurtherBelow.some(
      (candidate) => candidate.y >= element.y + element.height - PUSH_TOLERANCE_PX
    );
    if (hasTableFurtherBelow) {
      maxTableBottom = Math.min(maxTableBottom, element.y - FLOW_GAP_PX);
    }
  }

  return maxTableBottom;
}

function resolveTableRowsForPageSegment(
  elementProps: Record<string, unknown>,
  fullTable: ProductTableProps,
  allRows: ProductTableRow[]
): ProductTableProps {
  const start = elementProps[PREVIEW_PAGINATION_RANGE_START_KEY];
  const end = elementProps[PREVIEW_PAGINATION_RANGE_END_KEY];
  if (typeof start === 'number' && typeof end === 'number' && end > start) {
    const segmentRows = allRows.slice(start, end);
    return { ...fullTable, rows: segmentRows };
  }
  const rows = fullTable.rows.length > 0 ? fullTable.rows : allRows;
  return { ...fullTable, rows };
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
    const elementProps = (element.props ?? {}) as Record<string, unknown>;
    const fitted = fitTableHeightsPreservingWidths(element.type, elementProps);
    const fullTable = normalizeTablePropsForType(
      element.type,
      fitted.tableProps
    ) as ProductTableProps;
    const allRows = resolvePaginationAllRows(elementProps, fullTable);
    const tableForSplit = resolveTableRowsForPageSegment(elementProps, fullTable, allRows);
    const isPaginatedSegment = tableHasPaginationSegment(elementProps);
    const segmentRowStart = isPaginatedSegment
      ? (elementProps[PREVIEW_PAGINATION_RANGE_START_KEY] as number)
      : 0;
    const segmentRowEnd = isPaginatedSegment
      ? (elementProps[PREVIEW_PAGINATION_RANGE_END_KEY] as number)
      : allRows.length;

    const spillEntireTableToOverflow = () => {
      const continuationSegment = buildTableSegment(
        element.type,
        tableForSplit,
        0,
        tableForSplit.rows.length,
        {
          showHeader: resolvePaginatedSegmentShowHeader(fullTable),
          isLastSegment: segmentRowStart + tableForSplit.rows.length >= allRows.length,
        },
        allRows
      );
      overflow.push(
        makeTableContinuationElement(
          element,
          elementProps,
          continuationSegment.tableProps,
          allRows,
          segmentRowStart,
          segmentRowStart + tableForSplit.rows.length,
          continuationSegment.height
        )
      );
      result = result.filter((item) => item.id !== element.id);
    };

    if (element.y >= contentBottomLimit - PUSH_TOLERANCE_PX) {
      spillEntireTableToOverflow();
      continue;
    }

    const tableBottomLimit = getTableContentBottomLimit(result, element, contentBottomLimit);
    const availableHeight = tableBottomLimit - element.y;
    if (availableHeight <= PUSH_TOLERANCE_PX) {
      spillEntireTableToOverflow();
      continue;
    }

    const fullHeight = resolveTableElementSize(element.type, tableForSplit).height;

    const anchorId = resolvePaginationTableId(elementProps, element.id);

    if (fullHeight <= availableHeight + PUSH_TOLERANCE_PX) {
      result[index] = {
        ...element,
        height: fullHeight,
        props: tablePropsForPageSegment(
          elementProps,
          {
            ...fitted.tableProps,
            showHeader: resolvePaginatedSegmentShowHeader(fullTable),
          },
          allRows,
          anchorId,
          isPaginatedSegment ? { start: segmentRowStart, end: segmentRowEnd } : undefined
        ),
      };
      continue;
    }

    let splitIndex = findTableRowSplitIndex(
      element.type,
      tableForSplit,
      availableHeight,
      allRows
    );
    if (splitIndex >= tableForSplit.rows.length) {
      result[index] = {
        ...element,
        height: fullHeight,
        props: tablePropsForPageSegment(
          elementProps,
          {
            ...fitted.tableProps,
            showHeader: resolvePaginatedSegmentShowHeader(fullTable),
          },
          allRows,
          anchorId,
          isPaginatedSegment ? { start: segmentRowStart, end: segmentRowEnd } : undefined
        ),
      };
      continue;
    }

    if (splitIndex <= 0) {
      if (
        tableForSplit.rows.length > 1
        && element.y < contentBottomLimit - PUSH_TOLERANCE_PX
      ) {
        splitIndex = 1;
      } else {
        const continuationSegment = buildTableSegment(
          element.type,
          tableForSplit,
          0,
          tableForSplit.rows.length,
          {
            showHeader: resolvePaginatedSegmentShowHeader(fullTable),
            isLastSegment: segmentRowStart + tableForSplit.rows.length >= allRows.length,
          },
          allRows
        );
        overflow.push(
          makeTableContinuationElement(
            element,
            elementProps,
            continuationSegment.tableProps,
            allRows,
            segmentRowStart,
            segmentRowStart + tableForSplit.rows.length,
            continuationSegment.height
          )
        );
        result = result.filter((item) => item.id !== element.id);
        continue;
      }
    }

    const pageSegment = buildTableSegment(
      element.type,
      tableForSplit,
      0,
      splitIndex,
      {
        showHeader: resolvePaginatedSegmentShowHeader(fullTable),
        isLastSegment: false,
      },
      allRows
    );
    result[index] = {
      ...element,
      height: pageSegment.height,
      props: tablePropsForPageSegment(elementProps, pageSegment.tableProps, allRows, anchorId, {
        start: segmentRowStart,
        end: segmentRowStart + splitIndex,
      }),
    };

    const continuationGlobalEnd = segmentRowStart + tableForSplit.rows.length;
    const continuationSegment = buildTableSegment(
      element.type,
      tableForSplit,
      splitIndex,
      tableForSplit.rows.length,
      {
        showHeader: resolvePaginatedSegmentShowHeader(fullTable),
        isLastSegment: continuationGlobalEnd >= allRows.length,
      },
      allRows
    );
    overflow.push(
      makeTableContinuationElement(
        element,
        elementProps,
        continuationSegment.tableProps,
        allRows,
        segmentRowStart + splitIndex,
        continuationGlobalEnd,
        continuationSegment.height
      )
    );
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
  _options: PreviewReflowOptions = {},
  footerSource?: TemplatePage | null
): { page: TemplatePage; overflow: CanvasElement[] } {
  const contentBottomLimit = getFlowContentBottomLimit(page, footerSource);

  let elements = cloneElements(page.elements);

  // Expand non-table blocks first (headers/cards above the table stay put).
  elements = expandCardsAndPushBelow(elements);
  elements = expandStructuredBlocksAndPushBelow(elements);

  // Snapshot after card growth so table split push uses the right baselines.
  const baselines = snapshotElementGeometry(elements);

  // Split/grow tables in place — do NOT pre-expand to full document height
  // (that made the table cover the page and spilled headers with it).
  const tableSplit = splitOverflowTables(elements, contentBottomLimit);
  elements = tableSplit.elements;
  elements = pushBelowTablesFromBaselines(elements, baselines);
  elements = enforceStackGapBelowTables(elements);

  const spill = splitOverflowElements(elements, contentBottomLimit);
  return {
    page: { ...page, elements: spill.staying },
    overflow: sortOverflowByFlowOrder([...tableSplit.overflow, ...spill.overflow]),
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
  const contentBottomLimit = getFlowContentBottomLimit(page);

  return page.elements.some((element) => {
    if (!isTableElementType(element.type) || element.visible === false) return false;
    const elementProps = (element.props ?? {}) as Record<string, unknown>;
    const fitted = fitTableHeightsPreservingWidths(element.type, elementProps);
    const table = normalizeTablePropsForType(element.type, element.props ?? {}) as ProductTableProps;
    const fittedTable = normalizeTablePropsForType(
      element.type,
      fitted.tableProps
    ) as ProductTableProps;
    const allRows = resolvePaginationAllRows(elementProps, fittedTable);
    const tableForMeasure = resolveTableRowsForPageSegment(elementProps, fittedTable, allRows);
    const fittedHeight = resolveTableElementSize(element.type, tableForMeasure).height;

    if (fittedHeight > element.height + PUSH_TOLERANCE_PX) return true;
    if (element.y + fittedHeight > contentBottomLimit + PUSH_TOLERANCE_PX) return true;
    if (!tableHasPaginationSegment(elementProps) && allRows.length !== table.rows.length) {
      return true;
    }
    if (contentOverlapsExpandedBlock(page, element, fittedHeight)) return true;

    return tableForMeasure.rows.some((row, rowIndex) => {
      const next = fittedTable.rows[rowIndex];
      if (!next) return true;
      return next.heightPx > row.heightPx + PUSH_TOLERANCE_PX;
    });
  });
}

/**
 * Preview layout: Word-like flow — grow tables/cards, push rows below, paginate overflow.
 */
export function layoutDocumentPages(
  pages: TemplatePage[],
  options: DocumentLayoutOptions = {}
): TemplatePage[] {
  if (pages.length === 0) return pages;
  return reflowPagesForPreview(pages, options);
}

/** @deprecated Use layoutDocumentPages */
export const reflowTablesOnlyForPreview = layoutDocumentPages;

/**
 * Builder editor layout — same Word-like engine as live preview so canvas matches output.
 */
export function layoutBuilderPages(pages: TemplatePage[]): TemplatePage[] {
  if (pages.length === 0) return pages;
  const consolidated = consolidatePaginatedTablesForReflow(cloneTemplatePages(pages));
  // Preserve authored table Y on every page (not only page 1).
  const anchorTablePositions = new Map<string, number>();
  for (const page of consolidated) {
    for (const element of page.elements) {
      if (element.visible === false || !isTableElementType(element.type)) continue;
      const props = (element.props ?? {}) as Record<string, unknown>;
      if (isTableContinuationSegment(props)) continue;
      anchorTablePositions.set(element.id, element.y);
    }
  }
  const source = builderRepaginationSource(consolidated);
  let result = dropEmptyTrailingPages(reflowPagesForPreview(source, { trustTableProps: true }));
  if (anchorTablePositions.size > 0) {
    result = result.map((page) => ({
      ...page,
      elements: page.elements.map((element) => {
        const anchorY = anchorTablePositions.get(element.id);
        if (anchorY === undefined) return element;
        const props = (element.props ?? {}) as Record<string, unknown>;
        if (isTableContinuationSegment(props)) return element;
        return { ...element, y: anchorY };
      }),
    }));
  }
  result = sanitizeAnchorPageTableDuplicates(result);
  result = ensureMissingTableContinuationPages(result);
  result = normalizeDocumentFooters(result);
  return applyPreviewPageNumbers(dropEmptyTrailingPages(result));
}

/** True when a page only holds auto table-continuations (or is empty aside from footers). */
function pageIsPureAutoContinuation(page: TemplatePage): boolean {
  if (page.userAuthored === true) return false;
  const flow = page.elements.filter(
    (element) => element.visible !== false && !isPinnedPreviewElement(element)
  );
  if (flow.length === 0) return true;
  return flow.every(
    (element) =>
      isTableElementType(element.type)
      && isTableContinuationSegment((element.props ?? {}) as Record<string, unknown>)
  );
}

/**
 * Prepare pages for builder reflow without destroying multi-page layouts.
 * - Keep every page that has real content (letter text, images, independent tables).
 * - Drop only pure auto table-continuation tabs (rows already merged onto page 1).
 * Never dump page 2/3 content onto page 1 — that caused overlap and deleted pages.
 */
function builderRepaginationSource(pages: TemplatePage[]): TemplatePage[] {
  if (pages.length <= 1) return pages;
  const head = pages[0];
  const keptTail = pages.slice(1).filter((page) => !pageIsPureAutoContinuation(page));
  return [head, ...keptTail];
}

/**
 * Add/remove rows on Page 2+ without re-splitting from Page 1.
 * Keeps the Page 1 segment row range fixed; only extends the edited continuation.
 */
export function applyContinuationTableStructuralEdit(
  pages: TemplatePage[],
  editedElementId: string,
  editedProps: Record<string, unknown>
): TemplatePage[] {
  const next = cloneTemplatePages(pages);
  const tableId = resolvePaginationTableId(editedProps, editedElementId);
  let editedType = ComponentType.PRODUCT_TABLE;
  let editedPageIndex = -1;

  for (const page of next) {
    const hit = page.elements.find((el) => el.id === editedElementId);
    if (hit) {
      editedType = hit.type;
      break;
    }
  }

  const fullTable = normalizeTablePropsForType(
    editedType,
    resolveBuilderTablePropsForEdit(editedProps)
  ) as ProductTableProps;
  const fullRows = fullTable.rows;

  for (let pageIndex = 0; pageIndex < next.length; pageIndex += 1) {
    const kept: CanvasElement[] = [];
    for (const element of next[pageIndex].elements) {
      if (!isTableElementType(element.type) || element.visible === false) {
        kept.push(element);
        continue;
      }
      const elementProps = (element.props ?? {}) as Record<string, unknown>;
      if (resolvePaginationTableId(elementProps, element.id) !== tableId) {
        kept.push(element);
        continue;
      }

      const isEdited = element.id === editedElementId;
      if (isEdited) editedPageIndex = pageIndex;

      const rangeStart = elementProps[PREVIEW_PAGINATION_RANGE_START_KEY];
      const rangeEnd = elementProps[PREVIEW_PAGINATION_RANGE_END_KEY];
      const hasRange =
        typeof rangeStart === 'number'
        && typeof rangeEnd === 'number'
        && rangeEnd > rangeStart;

      let newStart = hasRange ? rangeStart : 0;
      let newEnd = hasRange ? rangeEnd : fullRows.length;

      if (isEdited) {
        newEnd = fullRows.length;
      }

      if (newEnd <= newStart) continue;

      const pageSegment = buildTableSegment(
        element.type,
        { ...fullTable, rows: fullRows },
        newStart,
        newEnd,
        {
          showHeader: resolvePaginatedSegmentShowHeader(fullTable),
          isLastSegment: newEnd >= fullRows.length,
        },
        fullRows
      );
      const fitted = fitTableHeightsPreservingWidths(element.type, pageSegment.tableProps);
      kept.push({
        ...element,
        height: fitted.height,
        props: tablePropsForPageSegment(
          elementProps,
          fitted.tableProps,
          fullRows,
          tableId,
          { start: newStart, end: newEnd }
        ),
      });
    }
    next[pageIndex].elements = kept;
  }

  if (editedPageIndex < 0) return next;

  let result = next;
  let pendingOverflow: CanvasElement[] = [];
  const reflowed = reflowSinglePage(result[editedPageIndex], { trustTableProps: true });
  result[editedPageIndex] = reflowed.page;
  pendingOverflow = reflowed.overflow;

  let guard = 0;
  while (pendingOverflow.length > 0 && guard < 16) {
    guard += 1;
    const anchorPage = result[editedPageIndex];
    const continuation = createContinuationPage(
      result.length + 1,
      anchorPage,
      pendingOverflow,
      result[0] ?? anchorPage
    );
    const spill = reflowSinglePage(continuation, { trustTableProps: true });
    result.push(spill.page);
    pendingOverflow = spill.overflow;
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
  overflow: CanvasElement[],
  footerSource?: TemplatePage
): TemplatePage {
  const page: TemplatePage = {
    id: uuidv4(),
    name: `Page ${pageNumber}`,
    margins: { ...sourcePage.margins },
    pageSize: sourcePage.pageSize ? { ...sourcePage.pageSize } : undefined,
    userAuthored: false,
    elements: stackOverflowElementsAtPageTop(overflow, sourcePage.margins),
  };
  // Attach shared footers BEFORE reflow so tables/text stop above the footer band
  // (otherwise footers are added later and collide with page 2+ content).
  const master = footerSource ?? sourcePage;
  const footers = appendFootersFromMasterPage(master, page);
  if (footers.length === 0) return page;
  return { ...page, elements: [...page.elements, ...footers] };
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
      elements: expandStructuredBlocksAndPushBelow(
        expandCardsAndPushBelow(page.elements)
      ),
    }))
  );
}

/**
 * Grow cards / terms / address blocks to fit filled content and push elements below
 * (divider, invoice #, table, etc.). Skips table expansion/pagination so authored
 * table position stays intact — use this for live preview vs builder matching.
 */
export function fitPreviewCardLayout(pages: TemplatePage[]): TemplatePage[] {
  if (pages.length === 0) return pages;
  return applyPreviewPageNumbers(
    cloneTemplatePages(pages).map((page) => ({
      ...page,
      elements: expandStructuredBlocksAndPushBelow(
        expandCardsAndPushBelow(page.elements)
      ),
    }))
  );
}

export function reflowPagesForPreview(
  pages: TemplatePage[],
  options: PreviewReflowOptions = {}
): TemplatePage[] {
  if (pages.length === 0) return pages;

  const source = builderRepaginationSource(cloneTemplatePages(pages));
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
    const footerMaster = result[0] ?? withCardHeights[0] ?? anchorPage;
    const continuation = createContinuationPage(
      result.length + 1,
      anchorPage,
      pendingOverflow,
      footerMaster
    );
    const reflowed = reflowSinglePage(continuation, tableOptions, footerMaster);
    result.push(reflowed.page);
    pendingOverflow = reflowed.overflow;
  };

  const footerMaster = withCardHeights[0] ?? null;

  for (const sourcePage of withCardHeights) {
    // Never merge table overflow into an existing content page (that stacked
    // page-3 tables onto page-1/2 and deleted later tabs). Insert new pages first.
    let insertGuard = 0;
    while (pendingOverflow.length > 0 && insertGuard < 32) {
      insertGuard += 1;
      flushOverflow(result.length > 0 ? result[result.length - 1] : sourcePage);
    }

    const reflowed = reflowSinglePage(sourcePage, tableOptions, footerMaster);
    result.push(reflowed.page);
    pendingOverflow = reflowed.overflow;
  }

  let guard = 0;
  while (pendingOverflow.length > 0 && guard < 32) {
    guard += 1;
    const sourcePage = result[result.length - 1];
    flushOverflow(sourcePage);
    if (pendingOverflow.length === 0) break;
  }

  return applyPreviewPageNumbers(dropEmptyTrailingPages(result));
}

/** Apply placeholders/form data then reflow only when content extends past its box. */
export function preparePreviewPages(
  pages: TemplatePage[],
  options: PreviewReflowOptions = {}
): TemplatePage[] {
  return reflowPagesForPreview(pages, options);
}
