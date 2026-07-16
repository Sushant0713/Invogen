import { v4 as uuidv4 } from 'uuid';
import { ComponentType } from '@invogen/shared';
import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { getPageDimensions, type PageMargins } from './builder-dnd';
import { isTableElementType, productTablePropsToRecord, resolveBuilderTablePropsForEdit, PREVIEW_PAGINATION_ROWS_KEY, PREVIEW_PAGINATION_RANGE_START_KEY, PREVIEW_PAGINATION_RANGE_END_KEY, PREVIEW_PAGINATION_TABLE_ID_KEY, PREVIEW_PAGINATION_SHOW_TOTALS_KEY, resolvePaginationTableId, isTableContinuationSegment, isTotalsOnlyPaginationRange, mergeTablePaginationProps } from './product-table';
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
import {
  findTextSplitEnd,
  hasTextPaginationMeta,
  isPaginatedTextBoxType,
  isTextContinuationSegment,
  resolveFullTextContent,
  resolveFullTextRuns,
  resolvePaginationTextBoxId,
  PREVIEW_TEXT_BOX_ID_KEY,
  PREVIEW_TEXT_CONTENT_KEY,
  PREVIEW_TEXT_RANGE_END_KEY,
  PREVIEW_TEXT_RANGE_START_KEY,
  PREVIEW_TEXT_RUNS_KEY,
  textPropsForPageSegment,
  sliceTextRuns,
} from './text-box-pagination';
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
/** Keep invoice date + due date together across pages even when slightly staggered. */
const DATE_CLUSTER_Y_PX = 100;
const LOGICAL_FLOW_Y_KEY = '__logicalFlowY';

function isInvoiceDateFieldType(type: string): boolean {
  return type === ComponentType.DATE || type === ComponentType.DUE_DATE;
}

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

/**
 * Background / fixed layers — do not participate in Word-like document flow.
 * Keep watermarks, footers, and media (image/logo/signature) at authored canvas Y
 * so Live Preview matches the builder (Word-flow was packing logos upward).
 * Text/dates still flow with the document; set fixedInFlow to pin other elements.
 */
export function isPinnedPreviewElement(element: CanvasElement): boolean {
  if (element.visible === false) return false;
  if (element.type === ComponentType.WATERMARK) return true;
  if (isDocumentFooterElement(element)) return true;
  if (element.type === ComponentType.PAGE_NUMBER) return true;
  if (
    element.type === ComponentType.IMAGE
    || element.type === ComponentType.LOGO
    || element.type === ComponentType.SIGNATURE
  ) {
    return true;
  }
  if (element.pinned === true) return true;
  const props = (element.props ?? {}) as Record<string, unknown>;
  // Opt-in: template authors can pin other elements with fixedInFlow.
  if (props.fixedInFlow === true) return true;
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
  const units = groupFlowIntoUnits(ordered);

  let cursorY = margins.top;
  const placed: CanvasElement[] = [];
  for (const unit of units) {
    const result = placeFlowUnitAt(unit, cursorY);
    placed.push(...result.placed);
    cursorY = result.nextCursorY;
  }
  return placed;
}

/**
 * Group flow items that must stay on the same page together:
 * - tables alone
 * - side-by-side row siblings
 * - invoice date + due date (even if slightly staggered)
 */
function shouldJoinToFlowUnit(unit: CanvasElement[], candidate: CanvasElement): boolean {
  if (isTableElementType(candidate.type)) return false;
  if (unit.some((el) => isTableElementType(el.type))) return false;

  const candidateY = getLogicalFlowY(candidate);
  // Same visual row as any unit member (side-by-side logo / dates / etc.).
  if (unit.some((el) => Math.abs(getLogicalFlowY(el) - candidateY) <= ROW_Y_TOLERANCE_PX)) {
    return true;
  }

  // Invoice date + due date stay together when authored one below/beside the other.
  const unitHasDate = unit.some((el) => isInvoiceDateFieldType(el.type));
  if (unitHasDate && isInvoiceDateFieldType(candidate.type)) {
    const unitMinY = Math.min(...unit.map(getLogicalFlowY));
    const unitMaxY = Math.max(...unit.map(getLogicalFlowY));
    if (
      candidateY >= unitMinY - ROW_Y_TOLERANCE_PX
      && candidateY <= unitMaxY + DATE_CLUSTER_Y_PX
    ) {
      return true;
    }
  }

  return false;
}

function groupFlowIntoUnits(flow: CanvasElement[]): CanvasElement[][] {
  const units: CanvasElement[][] = [];
  let index = 0;
  while (index < flow.length) {
    const element = flow[index];
    if (isTableElementType(element.type)) {
      units.push([element]);
      index += 1;
      continue;
    }

    const unit = [element];
    let next = index + 1;
    while (
      next < flow.length
      && !isTableElementType(flow[next].type)
      && shouldJoinToFlowUnit(unit, flow[next])
    ) {
      unit.push(flow[next]);
      next += 1;
    }
    units.push(unit);
    index = next;
  }
  return units;
}

function measureFlowUnitHeight(unit: CanvasElement[]): number {
  if (unit.length === 0) return 0;
  if (unit.length === 1) return unit[0].height;
  const minY = Math.min(...unit.map(getLogicalFlowY));
  const maxBottom = Math.max(...unit.map((el) => getLogicalFlowY(el) + el.height));
  return Math.max(maxBottom - minY, ...unit.map((el) => el.height));
}

/** Place a unit at cursorY while preserving relative X/Y inside the unit. */
function placeFlowUnitAt(
  unit: CanvasElement[],
  cursorY: number
): { placed: CanvasElement[]; nextCursorY: number } {
  if (unit.length === 0) return { placed: [], nextCursorY: cursorY };
  if (unit.length === 1) {
    const placed = withLogicalFlowY({ ...unit[0], y: cursorY }, cursorY);
    return {
      placed: [placed],
      nextCursorY: cursorY + placed.height + FLOW_GAP_PX,
    };
  }

  const minY = Math.min(...unit.map(getLogicalFlowY));
  const placed = unit.map((el) => {
    const y = cursorY + (getLogicalFlowY(el) - minY);
    return withLogicalFlowY({ ...el, y }, y);
  });
  const top = Math.min(...placed.map((el) => el.y));
  const bottom = Math.max(...placed.map((el) => el.y + el.height));
  return {
    placed,
    nextCursorY: top + (bottom - top) + FLOW_GAP_PX,
  };
}

function unitsFitAt(
  cursorY: number,
  units: CanvasElement[][],
  contentBottom: number
): boolean {
  let y = cursorY;
  for (const unit of units) {
    const height = measureFlowUnitHeight(unit);
    if (y + height > contentBottom + PUSH_TOLERANCE_PX) return false;
    y += height + FLOW_GAP_PX;
  }
  return true;
}

/** Collect unique elements from every page, sorted by document flow order. */
function gatherReflowElements(pages: TemplatePage[]): {
  elements: CanvasElement[];
  startY: number;
} {
  const byId = new Map<string, CanvasElement>();

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const pageHeight = getPageDimensions(page).height;
    for (const element of page.elements) {
      if (element.visible === false || isPinnedPreviewElement(element)) continue;
      if (byId.has(element.id)) continue;
      // Stamp cross-page document Y so later sorts don't treat page-2 content
      // (placed at margins.top ≈ 40) as if it belongs above the page-1 table.
      const documentY = pageIndex * pageHeight + getLogicalFlowY(element);
      byId.set(element.id, withLogicalFlowY({ ...element }, documentY));
    }
  }

  const elements = Array.from(byId.values()).sort(
    (a, b) => getLogicalFlowY(a) - getLogicalFlowY(b) || a.x - b.x
  );
  const margins = pages[0]?.margins ?? { top: 40, right: 40, bottom: 40, left: 40 };
  const page1Height = pages[0] ? getPageDimensions(pages[0]).height : 0;
  const page1Ys = elements
    .map(getLogicalFlowY)
    .filter((y) => y < page1Height || page1Height === 0);
  const startY =
    page1Ys.length > 0
      ? Math.max(margins.top, Math.min(...page1Ys))
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

function didOverlapOriginally(
  aId: string,
  bId: string,
  originalElements: CanvasElement[]
): boolean {
  const a = originalElements.find((el) => el.id === aId);
  const b = originalElements.find((el) => el.id === bId);
  if (!a || !b) return false;

  const aBottom = a.y + a.height;
  const bBottom = b.y + b.height;
  return (
    a.y < bBottom - PUSH_TOLERANCE_PX &&
    b.y < aBottom - PUSH_TOLERANCE_PX
  );
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
  if (typeof start !== 'number' || typeof end !== 'number') return false;
  if (end > start) return true;
  // Totals-only page-2 shell: start === end === allRows.length
  const allRows = props[PREVIEW_PAGINATION_ROWS_KEY];
  return Array.isArray(allRows) && isTotalsOnlyPaginationRange(start, end, allRows.length);
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
  heightDelta: number,
  originalElements?: CanvasElement[]
): { elements: CanvasElement[]; changed: boolean } {
  const anchor = elements[anchorIndex];
  const anchorBottom = anchor.y + anchor.height;
  const minYBelowAnchor = anchorBottom + FLOW_GAP_PX;

  const below = elements.filter(
    (element) => element.id !== anchor.id && isStackedBelow(anchor, element)
  );
  if (below.length === 0) return { elements, changed: false };

  const needsOverlapFix = below.some(
    (element) => {
      if (originalElements && didOverlapOriginally(anchor.id, element.id, originalElements)) {
        return false;
      }
      return (
        element.y < anchorBottom - PUSH_TOLERANCE_PX
        && element.y + element.height > anchor.y + PUSH_TOLERANCE_PX
      );
    }
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
      (element) => {
        if (originalElements && didOverlapOriginally(anchor.id, element.id, originalElements)) {
          return false;
        }
        return (
          element.y < anchorBottom - PUSH_TOLERANCE_PX
          && element.y + element.height > anchor.y + PUSH_TOLERANCE_PX
        );
      }
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
  baselines: Map<string, ElementGeometry>,
  originalElements?: CanvasElement[]
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
    const push = pushStackedElementsBelowAnchor(result, index, heightDelta, originalElements);
    result = push.elements;
  }

  return result;
}

function expandTablesAndPushBelow(
  elements: CanvasElement[],
  options: { measureMode?: TableMeasureMode } = {},
  originalElements: CanvasElement[] = elements
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

      const push = pushStackedElementsBelowAnchor(result, index, heightDelta, originalElements);
      result = push.elements;
      if (push.changed) changed = true;
    }

    if (!changed) break;
  }

  return result;
}

function expandCardsAndPushBelow(
  elements: CanvasElement[],
  originalElements: CanvasElement[] = elements
): CanvasElement[] {
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

      const push = pushStackedElementsBelowAnchor(result, index, heightDelta, originalElements);
      result = push.elements;
      if (push.changed) changed = true;
    }

    if (!changed) break;
  }

  return result;
}

function expandStructuredBlocksAndPushBelow(
  elements: CanvasElement[],
  originalElements: CanvasElement[] = elements
): CanvasElement[] {
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

      const push = pushStackedElementsBelowAnchor(result, index, heightDelta, originalElements);
      result = push.elements;
      if (push.changed) changed = true;
    }

    if (!changed) break;
  }

  return result;
}

/** Ensure stacked elements sit below each table — fixes overlap when Y was never reflowed. */
function enforceStackGapBelowTables(
  elements: CanvasElement[],
  originalElements?: CanvasElement[]
): CanvasElement[] {
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
      if (originalElements && didOverlapOriginally(anchor.id, element.id, originalElements)) continue;
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
    // Use segment height for continuations so page 2+ is not measured as the full table.
    const { height, tableProps, allRows } = measureTableFittedHeight(element);
    const elementProps = (element.props ?? {}) as Record<string, unknown>;
    // Set full row list AFTER merge — merge must not shrink it to the segment.
    return {
      ...element,
      height,
      props: {
        ...mergeTablePaginationProps(elementProps, tableProps),
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

function makeTextContinuationElement(
  source: CanvasElement,
  sourceProps: Record<string, unknown>,
  fullContent: string,
  start: number,
  end: number,
  height: number
): CanvasElement {
  const boxId = resolvePaginationTextBoxId(sourceProps, source.id);
  const fullRuns = resolveFullTextRuns(sourceProps);
  return {
    ...source,
    id: uuidv4(),
    y: source.y,
    height,
    props: textPropsForPageSegment(sourceProps, fullContent, fullRuns, boxId, start, end),
  };
}

/**
 * Split TEXT / HEADING / NOTES across pages the same way tables split rows —
 * head stays on this page; remaining content becomes a continuation element.
 */
function paginateTextInDocumentFlow(
  element: CanvasElement,
  cursorY: number,
  contentBottom: number
): { onPage: CanvasElement | null; overflow: CanvasElement[] } {
  const elementProps = (element.props ?? {}) as Record<string, unknown>;
  const fullContent = resolveFullTextContent(elementProps);
  const fullRuns = resolveFullTextRuns(elementProps);
  const boxId = resolvePaginationTextBoxId(elementProps, element.id);

  let baseStart =
    typeof elementProps[PREVIEW_TEXT_RANGE_START_KEY] === 'number'
      ? Math.floor(elementProps[PREVIEW_TEXT_RANGE_START_KEY] as number)
      : 0;
  let baseEnd =
    typeof elementProps[PREVIEW_TEXT_RANGE_END_KEY] === 'number'
      ? Math.floor(elementProps[PREVIEW_TEXT_RANGE_END_KEY] as number)
      : fullContent.length;

  if (baseStart < 0) baseStart = 0;
  if (baseEnd > fullContent.length) baseEnd = fullContent.length;
  if (baseStart > baseEnd) {
    baseStart = 0;
    baseEnd = fullContent.length;
  }

  const spaceLeft = contentBottom - cursorY;
  const segmentContent = fullContent.slice(baseStart, baseEnd);
  const segmentHeight = estimateTextBlockHeight(
    element.type,
    {
      ...elementProps,
      content: segmentContent,
      textRuns: sliceTextRuns(fullRuns, baseStart, baseEnd),
    },
    element.width
  );

  if (!segmentContent && baseEnd <= baseStart) {
    return { onPage: null, overflow: [] };
  }

  if (spaceLeft <= PUSH_TOLERANCE_PX) {
    return {
      onPage: null,
      overflow: [
        makeTextContinuationElement(
          element,
          elementProps,
          fullContent,
          baseStart,
          baseEnd,
          Math.max(element.height, segmentHeight)
        ),
      ],
    };
  }

  if (segmentHeight <= spaceLeft + PUSH_TOLERANCE_PX) {
    const overflow: CanvasElement[] = [];
    if (baseEnd < fullContent.length) {
      const restHeight = estimateTextBlockHeight(
        element.type,
        {
          ...elementProps,
          content: fullContent.slice(baseEnd),
          textRuns: sliceTextRuns(fullRuns, baseEnd, fullContent.length),
        },
        element.width
      );
      overflow.push(
        makeTextContinuationElement(
          element,
          elementProps,
          fullContent,
          baseEnd,
          fullContent.length,
          restHeight
        )
      );
    }
    return {
      onPage: {
        ...element,
        y: cursorY,
        height: segmentHeight,
        props: textPropsForPageSegment(
          elementProps,
          fullContent,
          fullRuns,
          boxId,
          baseStart,
          baseEnd
        ),
      },
      overflow,
    };
  }

  const splitEnd = findTextSplitEnd(
    element.type,
    elementProps,
    fullContent,
    element.width,
    spaceLeft,
    baseStart,
    baseEnd
  );

  if (splitEnd <= baseStart) {
    return {
      onPage: null,
      overflow: [
        makeTextContinuationElement(
          element,
          elementProps,
          fullContent,
          baseStart,
          baseEnd,
          segmentHeight
        ),
      ],
    };
  }

  const headHeight = estimateTextBlockHeight(
    element.type,
    {
      ...elementProps,
      content: fullContent.slice(baseStart, splitEnd),
      textRuns: sliceTextRuns(fullRuns, baseStart, splitEnd),
    },
    element.width
  );
  const restHeight = estimateTextBlockHeight(
    element.type,
    {
      ...elementProps,
      content: fullContent.slice(splitEnd, baseEnd),
      textRuns: sliceTextRuns(fullRuns, splitEnd, baseEnd),
    },
    element.width
  );

  return {
    onPage: {
      ...element,
      y: cursorY,
      height: headHeight,
      props: textPropsForPageSegment(
        elementProps,
        fullContent,
        fullRuns,
        boxId,
        baseStart,
        splitEnd
      ),
    },
    overflow: [
      makeTextContinuationElement(
        element,
        elementProps,
        fullContent,
        splitEnd,
        baseEnd,
        restHeight
      ),
    ],
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

  // Continuations already own a window into allRows (e.g. start=5). Paginate only
  // that window and keep absolute indexes so Sr.No. continues (6, 7…) on page 2+.
  const rangeStartRaw = elementProps[PREVIEW_PAGINATION_RANGE_START_KEY];
  const rangeEndRaw = elementProps[PREVIEW_PAGINATION_RANGE_END_KEY];
  let baseStart =
    typeof rangeStartRaw === 'number' && rangeStartRaw >= 0
      ? Math.floor(rangeStartRaw)
      : 0;
  let baseEnd =
    typeof rangeEndRaw === 'number' && rangeEndRaw > baseStart
      ? Math.floor(rangeEndRaw)
      : allRows.length;

  // Clamp stale ranges so we never get an empty window (that looped empty pages
  // and discarded images/dates after the table). Preserve totals-only tails
  // (start === end === allRows.length) — those hold the footer after page-2 row delete.
  if (allRows.length === 0) {
    return { onPage: null, overflow: [] };
  }
  const incomingTotalsOnly = isTotalsOnlyPaginationRange(baseStart, baseEnd, allRows.length);
  if (!incomingTotalsOnly) {
    if (baseStart >= allRows.length) {
      baseStart = 0;
      baseEnd = allRows.length;
    } else {
      baseEnd = Math.min(Math.max(baseEnd, baseStart + 1), allRows.length);
    }
  } else {
    baseStart = allRows.length;
    baseEnd = allRows.length;
  }

  const segmentRows = allRows.slice(baseStart, baseEnd);
  const tableForSplit: ProductTableProps = { ...fullTable, rows: segmentRows };
  const segmentHeight = resolveTableElementSize(element.type, tableForSplit).height;
  const spaceLeft = contentBottom - cursorY;
  const showHeader = resolvePaginatedSegmentShowHeader(fullTable);
  const isTailOfDocument = baseEnd >= allRows.length;

  const isTotalsOnlyTail =
    incomingTotalsOnly
    || (segmentRows.length === 0 && isTailOfDocument && baseStart >= allRows.length);

  if (segmentRows.length === 0 && !isTotalsOnlyTail) {
    return { onPage: null, overflow: [] };
  }

  if (isTotalsOnlyTail) {
    const showTotals = resolvePaginationShowTotals(element.type, fullTable);
    if (!showTotals) {
      return { onPage: null, overflow: [] };
    }
    const totalsOnly = buildTableSegment(
      element.type,
      { ...fullTable, rows: allRows },
      allRows.length,
      allRows.length,
      { showHeader, isLastSegment: true },
      allRows
    );
    if (spaceLeft <= PUSH_TOLERANCE_PX) {
      return {
        onPage: null,
        overflow: [
          makeTableContinuationElement(
            element,
            elementProps,
            totalsOnly.tableProps,
            allRows,
            allRows.length,
            allRows.length,
            totalsOnly.height
          ),
        ],
      };
    }
    return {
      onPage: {
        ...element,
        y: cursorY,
        height: totalsOnly.height,
        props: tablePropsForPageSegment(
          elementProps,
          totalsOnly.tableProps,
          allRows,
          element.id,
          { start: allRows.length, end: allRows.length }
        ),
      },
      overflow: [],
    };
  }

  if (spaceLeft <= PUSH_TOLERANCE_PX) {
    const continuation = buildTableSegment(
      element.type,
      { ...fullTable, rows: allRows },
      baseStart,
      baseEnd,
      { showHeader, isLastSegment: isTailOfDocument },
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
          baseStart,
          baseEnd,
          continuation.height
        ),
      ],
    };
  }

  if (segmentHeight <= spaceLeft + PUSH_TOLERANCE_PX) {
    const pageSegment = buildTableSegment(
      element.type,
      { ...fullTable, rows: allRows },
      baseStart,
      baseEnd,
      { showHeader, isLastSegment: isTailOfDocument },
      allRows
    );
    // Always keep absolute range so page-2+ Sr.No. does not restart at 1.
    const range =
      baseStart > 0 || baseEnd < allRows.length
        ? { start: baseStart, end: baseEnd }
        : undefined;
    const overflow: CanvasElement[] = [];
    // Stale short range with more rows in allRows — continue them on the next page.
    if (baseEnd < allRows.length) {
      const rest = buildTableSegment(
        element.type,
        { ...fullTable, rows: allRows },
        baseEnd,
        allRows.length,
        { showHeader, isLastSegment: true },
        allRows
      );
      overflow.push(
        makeTableContinuationElement(
          element,
          elementProps,
          rest.tableProps,
          allRows,
          baseEnd,
          allRows.length,
          rest.height
        )
      );
    }
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
          range
        ),
      },
      overflow,
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
      { ...fullTable, rows: allRows },
      baseStart,
      baseEnd,
      { showHeader, isLastSegment: isTailOfDocument },
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
          baseStart,
          baseEnd,
          continuation.height
        ),
      ],
    };
  }

  const absoluteSplit = baseStart + splitIndex;
  const pageSegment = buildTableSegment(
    element.type,
    { ...fullTable, rows: allRows },
    baseStart,
    absoluteSplit,
    { showHeader, isLastSegment: false },
    allRows
  );
  const continuationSegment = buildTableSegment(
    element.type,
    { ...fullTable, rows: allRows },
    absoluteSplit,
    baseEnd,
    { showHeader, isLastSegment: isTailOfDocument },
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
        { start: baseStart, end: absoluteSplit }
      ),
    },
    overflow: [
      makeTableContinuationElement(
        element,
        elementProps,
        continuationSegment.tableProps,
        allRows,
        absoluteSplit,
        baseEnd,
        continuationSegment.height
      ),
    ],
  };
}

function spillRemainingFlow(
  flow: CanvasElement[],
  startIndex: number,
  cursorY: number,
  overflow: CanvasElement[]
): void {
  const remaining = flow.slice(startIndex);
  const units = groupFlowIntoUnits(remaining);
  let y = cursorY;
  for (const unit of units) {
    const result = placeFlowUnitAt(unit, y);
    overflow.push(...result.placed);
    y = result.nextCursorY;
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

  // Never split a side-by-side / date-pair unit — spill from the start of that unit.
  let spillIndex = flowIndex;
  const units = groupFlowIntoUnits(flow);
  let cursor = 0;
  for (const unit of units) {
    const unitEnd = cursor + unit.length;
    if (flowIndex >= cursor && flowIndex < unitEnd) {
      spillIndex = cursor;
      break;
    }
    cursor = unitEnd;
  }

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
 * 2. Stack in document order (top → bottom), keeping side-by-side / date pairs together
 * 3. Split table rows when the stack reaches the page bottom
 * 4. Spill remaining blocks to the next page
 *
 * `preplaced` keeps authored header content (above the first table) at its original Y.
 */
function layoutPageDocumentFlow(
  page: TemplatePage,
  elements: CanvasElement[],
  startY?: number,
  preplaced: CanvasElement[] = [],
  originalElements: CanvasElement[] = elements
): { page: TemplatePage; overflow: CanvasElement[] } {
  const contentTop = page.margins.top;
  const contentBottom = getFlowContentBottomLimit(page);

  const pinned = elements.filter(
    (element) => element.visible !== false && isPinnedPreviewElement(element)
  );
  const preplacedIds = new Set(preplaced.map((el) => el.id));
  const pinnedCount = pinned.length + preplaced.length;
  const flow = sortDocumentFlowElements(elements)
    .filter((element) => !preplacedIds.has(element.id) && !isPinnedPreviewElement(element))
    .map(measureElementForLayout);

  const onPage: CanvasElement[] = [...pinned, ...preplaced];
  const overflow: CanvasElement[] = [];

  if (flow.length === 0) {
    return { page: { ...page, elements: onPage }, overflow };
  }

  const units = groupFlowIntoUnits(flow);
  // Spilled blocks keep a high logical Y from the previous page for sort order only.
  // Never start a page at that Y — it sits past the footer and every unit "won't fit",
  // so overflow pages stay empty and get dropped (images/dates disappear).
  let cursorY = startY ?? contentTop;
  if (startY === undefined && flow.length > 0) {
    const authoredY = getLogicalFlowY(flow[0]);
    if (authoredY < contentBottom - PUSH_TOLERANCE_PX) {
      cursorY = Math.max(contentTop, authoredY);
    }
  }
  // Clamp: if cursor is already past usable area, reset to top (continuation page).
  if (cursorY >= contentBottom - PUSH_TOLERANCE_PX) {
    cursorY = contentTop;
  }
  let flowIndex = 0;

  const blockingElements = [...pinned, ...preplaced].filter(
    (p) => !isDocumentFooterElement(p) && p.type !== ComponentType.WATERMARK
  );

  for (let unitIndex = 0; unitIndex < units.length; unitIndex += 1) {
    const unit = units[unitIndex];
    
    let overlapFound = true;
    while (overlapFound) {
      overlapFound = false;
      for (const p of blockingElements) {
        for (const el of unit) {
          if (!elementsShareColumn(p, el)) continue;
          if (originalElements && didOverlapOriginally(p.id, el.id, originalElements)) continue;
          if (
            cursorY < p.y + p.height + FLOW_GAP_PX &&
            cursorY + el.height > p.y - PUSH_TOLERANCE_PX
          ) {
            cursorY = p.y + p.height + FLOW_GAP_PX;
            overlapFound = true;
            break;
          }
        }
        if (overlapFound) break;
      }
    }

    const element = unit[0];

    if (isTableElementType(element.type)) {
      const paginated = paginateTableInDocumentFlow(element, cursorY, contentBottom);
      if (paginated.onPage === null) {
        // Prefer the ranged continuation from paginate; then spill following blocks.
        for (const spill of paginated.overflow) {
          overflow.push(withLogicalFlowY(spill, contentTop));
        }
        const spillFrom =
          paginated.overflow.length > 0 ? flowIndex + unit.length : flowIndex;
        spillRemainingFlow(flow, spillFrom, contentTop, overflow);
        break;
      }

      const placed = withLogicalFlowY(paginated.onPage, cursorY);
      onPage.push(placed);
      cursorY = placed.y + placed.height + FLOW_GAP_PX;
      flowIndex += unit.length;

      for (const spill of paginated.overflow) {
        overflow.push(withLogicalFlowY(spill, cursorY));
      }

      if (unitIndex + 1 < units.length) {
        if (!unitsFitAt(cursorY, units.slice(unitIndex + 1), contentBottom)) {
          spillRemainingFlow(flow, flowIndex, cursorY, overflow);
          break;
        }
      }
      continue;
    }

    if (isPaginatedTextBoxType(element.type)) {
      const paginated = paginateTextInDocumentFlow(element, cursorY, contentBottom);
      if (paginated.onPage === null) {
        for (const spill of paginated.overflow) {
          overflow.push(withLogicalFlowY(spill, contentTop));
        }
        const spillFrom =
          paginated.overflow.length > 0 ? flowIndex + unit.length : flowIndex;
        spillRemainingFlow(flow, spillFrom, contentTop, overflow);
        break;
      }

      const placed = withLogicalFlowY(paginated.onPage, cursorY);
      onPage.push(placed);
      cursorY = placed.y + placed.height + FLOW_GAP_PX;
      flowIndex += unit.length;

      for (const spill of paginated.overflow) {
        overflow.push(withLogicalFlowY(spill, cursorY));
      }

      if (unitIndex + 1 < units.length) {
        if (!unitsFitAt(cursorY, units.slice(unitIndex + 1), contentBottom)) {
          spillRemainingFlow(flow, flowIndex, cursorY, overflow);
          break;
        }
      }
      continue;
    }

    if (!unitsFitAt(cursorY, units.slice(unitIndex), contentBottom)) {
      spillRemainingFlow(flow, flowIndex, cursorY, overflow);
      break;
    }

    const placedUnit = placeFlowUnitAt(unit, cursorY);
    onPage.push(...placedUnit.placed);
    cursorY = placedUnit.nextCursorY;
    flowIndex += unit.length;
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
  const flow = sortDocumentFlowElements(elements)
    .filter((element) => element.visible !== false && !isPinnedPreviewElement(element));

  const staying: CanvasElement[] = [...hidden, ...pinned];
  const overflow: CanvasElement[] = [];

  if (flow.length === 0) {
    return { staying, overflow };
  }

  // Spill by flow units so side-by-side / invoice+due date pairs stay on one page.
  const units = groupFlowIntoUnits(flow);
  let spilling = false;
  for (const unit of units) {
    const unitPastBottom = unit.some((element) => {
      const top = element.y;
      const bottom = element.y + element.height;
      return (
        top >= contentBottomLimit - PUSH_TOLERANCE_PX
        || bottom > contentBottomLimit + PUSH_TOLERANCE_PX
      );
    });

    if (spilling || unitPastBottom) {
      spilling = true;
      overflow.push(...unit);
    } else {
      staying.push(...unit);
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

/** Merge split text-box segments back into one box before re-paginating. */
function consolidatePaginatedTextBoxesForReflow(pages: TemplatePage[]): TemplatePage[] {
  type Segment = { pageIndex: number; element: CanvasElement };
  const groups = new Map<string, Segment[]>();

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    for (const element of pages[pageIndex].elements) {
      if (!isPaginatedTextBoxType(element.type) || element.visible === false) continue;
      const props = (element.props ?? {}) as Record<string, unknown>;
      if (!hasTextPaginationMeta(props)) continue;
      const key = resolvePaginationTextBoxId(props, element.id);
      const list = groups.get(key) ?? [];
      list.push({ pageIndex, element });
      groups.set(key, list);
    }
  }

  if (groups.size === 0) return pages;

  const next = cloneTemplatePages(pages);

  for (const [boxId, segments] of groups) {
    segments.sort((a, b) => a.pageIndex - b.pageIndex || a.element.y - b.element.y);

    const hasCrossPageContinuation =
      segments.length > 1
      || segments.some((segment) =>
        isTextContinuationSegment((segment.element.props ?? {}) as Record<string, unknown>)
      );
    if (!hasCrossPageContinuation) continue;

    const primary =
      segments.find((segment) => segment.pageIndex === 0)
      ?? segments.find(
        (segment) =>
          !isTextContinuationSegment((segment.element.props ?? {}) as Record<string, unknown>)
      )
      ?? segments[0];

    const primaryProps = (primary.element.props ?? {}) as Record<string, unknown>;
    const fullContent = resolveFullTextContent(primaryProps);
    const fullRuns = resolveFullTextRuns(primaryProps);
    const fittedHeight = estimateTextBlockHeight(
      primary.element.type,
      { ...primaryProps, content: fullContent, textRuns: fullRuns ?? undefined },
      primary.element.width
    );

    for (let pageIndex = 0; pageIndex < next.length; pageIndex += 1) {
      next[pageIndex].elements = next[pageIndex].elements.filter((element) => {
        if (!isPaginatedTextBoxType(element.type)) return true;
        const props = (element.props ?? {}) as Record<string, unknown>;
        return resolvePaginationTextBoxId(props, element.id) !== boxId;
      });
    }

    const mergedProps: Record<string, unknown> = {
      ...primaryProps,
      content: fullContent,
      [PREVIEW_TEXT_CONTENT_KEY]: fullContent,
      [PREVIEW_TEXT_BOX_ID_KEY]: boxId,
    };
    if (fullRuns) {
      mergedProps[PREVIEW_TEXT_RUNS_KEY] = fullRuns;
      mergedProps.textRuns = fullRuns;
    }
    delete mergedProps[PREVIEW_TEXT_RANGE_START_KEY];
    delete mergedProps[PREVIEW_TEXT_RANGE_END_KEY];

    next[primary.pageIndex].elements.push({
      ...primary.element,
      height: fittedHeight,
      props: mergedProps,
    });
  }

  return next;
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
    // Restore totals after page-1 forced footers off — one table again for the next reflow.
    const explicitShowTotals = segments
      .map((segment) => (segment.element.props ?? {})[PREVIEW_PAGINATION_SHOW_TOTALS_KEY])
      .find((value): value is boolean => typeof value === 'boolean');
    const wantsTotals = explicitShowTotals !== false;
    props[PREVIEW_PAGINATION_SHOW_TOTALS_KEY] = wantsTotals;
    if (wantsTotals) {
      props.showGrandTotalFooter = true;
      props.showTotalFooter = true;
      props.showSummaryTable = true;
    } else {
      props.showGrandTotalFooter = false;
      props.showTotalFooter = false;
      props.showSummaryTable = false;
    }
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

/** Merge split table/text segments onto Page 1 after a continuation page tab is removed. */
export function absorbPaginationAfterPageDelete(pages: TemplatePage[]): TemplatePage[] {
  const consolidated = consolidatePaginatedTextBoxesForReflow(
    consolidatePaginatedTablesForReflow(cloneTemplatePages(pages))
  );
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

function resolvePaginationShowTotals(
  elementType: string,
  fullTable: ProductTableProps
): boolean {
  const stored = (fullTable as ProductTableProps & Record<string, unknown>)[
    PREVIEW_PAGINATION_SHOW_TOTALS_KEY
  ];
  if (typeof stored === 'boolean') return stored;
  if (isInvoiceTable2Type(elementType)) {
    return (fullTable as ProductTableProps & { showSummaryTable?: boolean }).showSummaryTable !== false;
  }
  if (isInvoiceTable3Type(elementType)) {
    return (fullTable as ProductTableProps & { showTotalFooter?: boolean }).showTotalFooter !== false;
  }
  return fullTable.showGrandTotalFooter !== false;
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
  // Page-1 segments force footers off; remember authored intent so page-2 (last
  // segment) can show the total again — one table across pages.
  const showTotals = resolvePaginationShowTotals(elementType, fullTable);
  let segmentTable: ProductTableProps = {
    ...fullTable,
    rows: displayRows,
    showHeader: options.showHeader,
  };

  if (isInvoiceTable2Type(elementType)) {
    if (!options.isLastSegment || !showTotals) {
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
        showSummaryTable: true,
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
      showTotalFooter: options.isLastSegment && showTotals,
    };
  } else {
    segmentTable = {
      ...segmentTable,
      showGrandTotalFooter: options.isLastSegment && showTotals,
    };
  }

  const allRows = allRowsForSummary ?? fullTable.rows;
  const fitted = fitTableHeightsPreservingWidths(elementType, {
    ...productTablePropsToRecord(segmentTable),
    // Keep pagination markers so normalize does not inject a default Sample item
    // into empty totals-only segments (page-2 shell after deleting the only row).
    [PREVIEW_PAGINATION_ROWS_KEY]: allRows,
    [PREVIEW_PAGINATION_RANGE_START_KEY]: rowStart,
    [PREVIEW_PAGINATION_RANGE_END_KEY]: rowEnd,
    [PREVIEW_PAGINATION_SHOW_TOTALS_KEY]: showTotals,
  });
  // Re-assert footer flags after fit/normalize — empty totals-only shells must keep the total.
  const footerOn = options.isLastSegment && showTotals;
  const tableProps: Record<string, unknown> = {
    ...fitted.tableProps,
    rows: displayRows,
    [PREVIEW_PAGINATION_SHOW_TOTALS_KEY]: showTotals,
  };
  if (isInvoiceTable2Type(elementType)) {
    tableProps.showSummaryTable = footerOn;
  } else if (isInvoiceTable3Type(elementType)) {
    tableProps.showTotalFooter = footerOn;
  } else {
    tableProps.showGrandTotalFooter = footerOn;
  }
  const height = resolveTableElementSize(
    elementType,
    normalizeTablePropsForType(elementType, tableProps) as ProductTableProps
  ).height;
  return { tableProps, height };
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
  if (isTotalsOnlyPaginationRange(start, end, allRows.length)) {
    return { ...fullTable, rows: [] };
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
    const isPaginatedSegment = tableHasPaginationSegment(elementProps);
    const segmentRowStart = isPaginatedSegment
      ? (elementProps[PREVIEW_PAGINATION_RANGE_START_KEY] as number)
      : 0;
    const segmentRowEnd = isPaginatedSegment
      ? (elementProps[PREVIEW_PAGINATION_RANGE_END_KEY] as number)
      : allRows.length;

    // Keep totals-only page-2 shells intact (header + total, no data rows).
    if (isTotalsOnlyPaginationRange(segmentRowStart, segmentRowEnd, allRows.length)) {
      const showTotals = resolvePaginationShowTotals(element.type, fullTable);
      if (!showTotals) {
        result = result.filter((item) => item.id !== element.id);
        continue;
      }
      const totalsOnly = buildTableSegment(
        element.type,
        { ...fullTable, rows: allRows },
        allRows.length,
        allRows.length,
        {
          showHeader: resolvePaginatedSegmentShowHeader(fullTable),
          isLastSegment: true,
        },
        allRows
      );
      const anchorId = resolvePaginationTableId(elementProps, element.id);
      result[index] = {
        ...element,
        height: totalsOnly.height,
        props: tablePropsForPageSegment(
          elementProps,
          totalsOnly.tableProps,
          allRows,
          anchorId,
          { start: allRows.length, end: allRows.length }
        ),
      };
      continue;
    }

    const tableForSplit = resolveTableRowsForPageSegment(elementProps, fullTable, allRows);

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
  const originalElements = cloneElements(page.elements);

  // Expand non-table blocks first (headers/cards above the table stay put).
  elements = expandCardsAndPushBelow(elements, originalElements);
  elements = expandStructuredBlocksAndPushBelow(elements, originalElements);

  // Snapshot after card growth so table split push uses the right baselines.
  const baselines = snapshotElementGeometry(elements);

  // Split/grow tables in place — do NOT pre-expand to full document height
  // (that made the table cover the page and spilled headers with it).
  const tableSplit = splitOverflowTables(elements, contentBottomLimit);
  elements = tableSplit.elements;
  elements = pushBelowTablesFromBaselines(elements, baselines, originalElements);
  elements = enforceStackGapBelowTables(elements, originalElements);

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
  return layoutPageDocumentFlow(page, elements, startY, [], elements);
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

    // Grow OR shrink (add/delete rows) must reflow so content below moves with the table.
    if (Math.abs(fittedHeight - element.height) > PUSH_TOLERANCE_PX) return true;
    if (element.y + fittedHeight > contentBottomLimit + PUSH_TOLERANCE_PX) return true;
    if (!tableHasPaginationSegment(elementProps) && allRows.length !== table.rows.length) {
      return true;
    }
    if (contentOverlapsExpandedBlock(page, element, fittedHeight)) return true;

    return tableForMeasure.rows.some((row, rowIndex) => {
      const next = fittedTable.rows[rowIndex];
      if (!next) return true;
      return Math.abs(next.heightPx - row.heightPx) > PUSH_TOLERANCE_PX;
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
 * Builder editor layout — same Word-like engine as live preview.
 */
export function layoutBuilderPages(pages: TemplatePage[]): TemplatePage[] {
  return reflowPagesForPreview(pages, { trustTableProps: true });
}

/** True when a page only holds auto table/text continuations (or is empty aside from footers). */
function pageIsPureAutoContinuation(page: TemplatePage): boolean {
  if (page.userAuthored === true) return false;
  const flow = page.elements.filter(
    (element) => element.visible !== false && !isPinnedPreviewElement(element)
  );
  if (flow.length === 0) return true;
  return flow.every((element) => {
    const props = (element.props ?? {}) as Record<string, unknown>;
    if (isTableElementType(element.type) && isTableContinuationSegment(props)) return true;
    if (isPaginatedTextBoxType(element.type) && isTextContinuationSegment(props)) return true;
    return false;
  });
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
 * When the only page-2 data row is deleted, keep a totals-only continuation so the
 * footer (and content below, e.g. images) stay on page 2 when they do not fit on page 1.
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
  const showTotals = resolvePaginationShowTotals(editedType, fullTable);

  type SegmentPlan = {
    pageIndex: number;
    element: CanvasElement;
    newStart: number;
    newEnd: number;
    isTotalsOnly: boolean;
  };
  const plans: SegmentPlan[] = [];

  for (let pageIndex = 0; pageIndex < next.length; pageIndex += 1) {
    for (const element of next[pageIndex].elements) {
      if (!isTableElementType(element.type) || element.visible === false) continue;
      const elementProps = (element.props ?? {}) as Record<string, unknown>;
      if (resolvePaginationTableId(elementProps, element.id) !== tableId) continue;

      const isEdited = element.id === editedElementId;
      if (isEdited) editedPageIndex = pageIndex;

      const rangeStart = elementProps[PREVIEW_PAGINATION_RANGE_START_KEY];
      const rangeEnd = elementProps[PREVIEW_PAGINATION_RANGE_END_KEY];
      const wasTotalsOnly = isTotalsOnlyPaginationRange(
        rangeStart,
        rangeEnd,
        Array.isArray(elementProps[PREVIEW_PAGINATION_ROWS_KEY])
          ? (elementProps[PREVIEW_PAGINATION_ROWS_KEY] as ProductTableRow[]).length
          : fullRows.length
      );
      const hasRange =
        typeof rangeStart === 'number'
        && typeof rangeEnd === 'number'
        && (rangeEnd > rangeStart || wasTotalsOnly);

      // Preserve each page's row window so Sr.No. stays continuous after deletes.
      let newStart = hasRange ? Math.min(Math.max(0, rangeStart), fullRows.length) : 0;
      let newEnd = hasRange
        ? Math.min(Math.max(newStart, rangeEnd), fullRows.length)
        : fullRows.length;

      if (isEdited && !wasTotalsOnly) {
        // Edited continuation (page 2+) keeps its start offset; end follows full list.
        newEnd = fullRows.length;
      }

      let isTotalsOnly = false;
      // No data rows left (deleted the only page-2 row) — keep totals-only shell.
      if (newEnd <= newStart) {
        if (showTotals && (isEdited || wasTotalsOnly || newStart > 0)) {
          newStart = fullRows.length;
          newEnd = fullRows.length;
          isTotalsOnly = true;
        } else {
          continue;
        }
      } else if (isTotalsOnlyPaginationRange(newStart, newEnd, fullRows.length)) {
        isTotalsOnly = showTotals;
        if (!isTotalsOnly) continue;
      }

      plans.push({ pageIndex, element, newStart, newEnd, isTotalsOnly });
    }
  }

  const hasTotalsOnlyTail = plans.some((plan) => plan.isTotalsOnly);

  for (let pageIndex = 0; pageIndex < next.length; pageIndex += 1) {
    const pagePlans = plans.filter((plan) => plan.pageIndex === pageIndex);
    const planById = new Map(pagePlans.map((plan) => [plan.element.id, plan]));
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

      const plan = planById.get(element.id);
      if (!plan) continue;

      const isLastSegment = plan.isTotalsOnly
        || (!hasTotalsOnlyTail && plan.newEnd >= fullRows.length);

      const pageSegment = buildTableSegment(
        element.type,
        { ...fullTable, rows: fullRows },
        plan.newStart,
        plan.newEnd,
        {
          showHeader: resolvePaginatedSegmentShowHeader(fullTable),
          isLastSegment,
        },
        fullRows
      );
      const range =
        plan.isTotalsOnly
        || plan.newStart > 0
        || plan.newEnd < fullRows.length
        || hasTotalsOnlyTail
          ? { start: plan.newStart, end: plan.newEnd }
          : undefined;
      kept.push({
        ...element,
        height: pageSegment.height,
        props: tablePropsForPageSegment(
          elementProps,
          pageSegment.tableProps,
          fullRows,
          tableId,
          range
        ),
      });
    }
    next[pageIndex].elements = kept;
  }

  // Collapse page-1 range only when no continuation (including totals-only) remains.
  if (!hasTotalsOnlyTail) {
    collapseOrphanTablePagination(next, tableId, fullRows);
  }

  if (editedPageIndex < 0) {
    const dropped = applyPreviewPageNumbers(dropEmptyTrailingPages(next));
    ensureTableTotalsOnLastSegment(dropped, tableId, showTotals);
    return dropped;
  }

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

  result = applyPreviewPageNumbers(dropEmptyTrailingPages(result));
  // If the totals-only page was dropped during reflow, put the total back on the last segment.
  ensureTableTotalsOnLastSegment(result, tableId, showTotals);
  return result;
}

/**
 * Guarantee the table total is visible on exactly one segment after pagination edits.
 * Covers the case where a totals-only page-2 shell was dropped during reflow.
 */
function ensureTableTotalsOnLastSegment(
  pages: TemplatePage[],
  tableId: string,
  showTotals: boolean
): void {
  if (!showTotals) return;

  const segments: Array<{ page: TemplatePage; index: number; element: CanvasElement }> = [];
  for (const page of pages) {
    page.elements.forEach((element, index) => {
      if (element.visible === false || !isTableElementType(element.type)) return;
      const props = (element.props ?? {}) as Record<string, unknown>;
      if (resolvePaginationTableId(props, element.id) !== tableId) return;
      segments.push({ page, index, element });
    });
  }
  if (segments.length === 0) return;

  const hasVisibleTotals = segments.some(({ element }) => {
    const props = (element.props ?? {}) as Record<string, unknown>;
    if (isInvoiceTable2Type(element.type)) return props.showSummaryTable !== false;
    if (isInvoiceTable3Type(element.type)) return props.showTotalFooter !== false;
    return props.showGrandTotalFooter !== false;
  });
  if (hasVisibleTotals) return;

  const last = segments[segments.length - 1];
  const props = { ...(last.element.props ?? {}) } as Record<string, unknown>;
  props[PREVIEW_PAGINATION_SHOW_TOTALS_KEY] = true;
  if (isInvoiceTable2Type(last.element.type)) {
    props.showSummaryTable = true;
  } else if (isInvoiceTable3Type(last.element.type)) {
    props.showTotalFooter = true;
  } else {
    props.showGrandTotalFooter = true;
  }
  const fitted = fitTableHeightsPreservingWidths(last.element.type, props);
  last.page.elements[last.index] = {
    ...last.element,
    height: fitted.height,
    props: {
      ...fitted.tableProps,
      [PREVIEW_PAGINATION_SHOW_TOTALS_KEY]: true,
      ...(isInvoiceTable2Type(last.element.type)
        ? { showSummaryTable: true }
        : isInvoiceTable3Type(last.element.type)
          ? { showTotalFooter: true }
          : { showGrandTotalFooter: true }),
    },
  };
}

/** After page-2 rows are deleted, clear split metadata on the sole remaining segment. */
function collapseOrphanTablePagination(
  pages: TemplatePage[],
  tableId: string,
  fullRows: ProductTableRow[]
): void {
  const segments: Array<{ page: TemplatePage; index: number; element: CanvasElement }> = [];
  for (const page of pages) {
    page.elements.forEach((element, index) => {
      if (element.visible === false || !isTableElementType(element.type)) return;
      const props = (element.props ?? {}) as Record<string, unknown>;
      if (resolvePaginationTableId(props, element.id) !== tableId) return;
      segments.push({ page, index, element });
    });
  }
  if (segments.length !== 1) return;

  const { page, index, element } = segments[0];
  const elementProps = (element.props ?? {}) as Record<string, unknown>;
  const pageSegment = buildTableSegment(
    element.type,
    {
      ...normalizeTablePropsForType(element.type, resolveBuilderTablePropsForEdit(elementProps)),
      rows: fullRows,
    } as ProductTableProps,
    0,
    fullRows.length,
    {
      showHeader: resolvePaginatedSegmentShowHeader(
        normalizeTablePropsForType(element.type, elementProps) as ProductTableProps
      ),
      isLastSegment: true,
    },
    fullRows
  );
  const fitted = fitTableHeightsPreservingWidths(element.type, pageSegment.tableProps);
  page.elements[index] = {
    ...element,
    height: fitted.height,
    props: tablePropsForPageSegment(
      elementProps,
      fitted.tableProps,
      fullRows,
      tableId,
      undefined
    ),
  };
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
 * Grow cards / terms / address blocks only (no table pagination).
 * Prefer `reflowPagesForPreview` for live preview — it includes Word-style flow.
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

/**
 * Word-like document flow:
 * 1. Gather all flow components across page 1 + auto-continuation pages
 * 2. Keep content above the first table at authored positions (header band)
 * 3. Restack the table + everything below with row splitting / pagination
 * 4. When the table shrinks, overflow content pulls back to earlier pages
 *
 * User-authored page 2+ (intentional multi-page content) is preserved separately.
 */
function reflowPagesWordStyle(
  pages: TemplatePage[],
  _options: PreviewReflowOptions = {}
): TemplatePage[] {
  if (pages.length === 0) return pages;

  const source = cloneTemplatePages(pages);
  const master = source[0];
  if (!master) return pages;

  // Page 1 + pure auto table-continuation pages participate in one flow.
  // Keep every authored later page (letter/content/independent tables) intact
  // so Live Preview page count matches the template builder — do not require
  // `userAuthored` (older templates and no-table pages often lack the flag).
  const flowSourcePages: TemplatePage[] = [master];
  const preservedTail: TemplatePage[] = [];
  for (const page of source.slice(1)) {
    if (!pageIsPureAutoContinuation(page)) {
      preservedTail.push(page);
    } else {
      flowSourcePages.push(page);
    }
  }

  const { elements: gathered } = gatherReflowElements(flowSourcePages);
  const allOriginalElements = source.flatMap((p) => p.elements);

  if (gathered.length === 0 && preservedTail.length === 0) {
    return applyPreviewPageNumbers(dropEmptyTrailingPages(source));
  }

  // `gathered` already has cross-page document Y stamped — do not re-sort by
  // page-local Y or page-2 images (y≈40) jump into the header above the table.
  const sortedGathered = sortDocumentFlowElements(gathered);
  const firstTableIndex = sortedGathered.findIndex(
    (element) =>
      isTableElementType(element.type)
      && !isTableContinuationSegment((element.props ?? {}) as Record<string, unknown>)
  );

  // Header band: only page-1 content that was authored above the first table.
  // Restore page-local Y (document stamp can equal local Y on page 1).
  const page1Height = getPageDimensions(master).height;
  const headerBand =
    firstTableIndex > 0
      ? sortedGathered
          .slice(0, firstTableIndex)
          .filter((el) => getLogicalFlowY(el) < page1Height)
          .map((el) => {
            // Page-1 stamp equals local Y; keep authored position for preplace.
            const localY = getLogicalFlowY(el);
            return withLogicalFlowY({ ...el, y: localY }, localY);
          })
      : [];
  let body =
    firstTableIndex >= 0 ? sortedGathered.slice(firstTableIndex) : sortedGathered;

  // Grow cards / structured blocks in the flowing body before pagination.
  body = expandCardsAndPushBelow(body, allOriginalElements);
  body = expandStructuredBlocksAndPushBelow(body, allOriginalElements);
  body = sortDocumentFlowElements(body);

  const tableStartY =
    firstTableIndex >= 0
      ? (() => {
          const raw = getLogicalFlowY(sortedGathered[firstTableIndex]);
          // Table on page 1 — use page-local Y, not a stamped multi-page value.
          return raw >= page1Height ? master.margins.top : raw;
        })()
      : master.margins.top;

  const bodyStartY =
    body.length > 0
      ? Math.max(
          master.margins.top,
          tableStartY,
          headerBand.length > 0
            ? Math.max(...headerBand.map((el) => el.y + el.height)) + FLOW_GAP_PX
            : master.margins.top
        )
      : master.margins.top;

  const page1Pinned = master.elements.filter(
    (element) => element.visible === false || isPinnedPreviewElement(element)
  );

  const result: TemplatePage[] = [];
  let remaining = body;
  let pageNumber = 1;
  let isFirst = true;
  let guard = 0;

  while ((remaining.length > 0 || isFirst) && guard < 32) {
    guard += 1;

    const shell: TemplatePage = {
      id: isFirst ? master.id : uuidv4(),
      name: `Page ${pageNumber}`,
      margins: { ...master.margins },
      pageSize: master.pageSize ? { ...master.pageSize } : undefined,
      userAuthored: isFirst ? master.userAuthored : false,
      elements: [],
    };

    const pinned = isFirst
      ? page1Pinned
      : appendFootersFromMasterPage(master, shell);

    let footers = pinned.filter(isDocumentFooterElement);
    if (footers.length === 0) {
      footers = appendFootersFromMasterPage(master, shell);
    }
    const nonFooterPinned = pinned.filter((el) => !isDocumentFooterElement(el));
    const preplaced = isFirst ? headerBand : [];

    const layoutPage: TemplatePage = {
      ...shell,
      elements: [...nonFooterPinned, ...footers, ...preplaced, ...remaining],
    };

    const { page, overflow } = layoutPageDocumentFlow(
      layoutPage,
      layoutPage.elements,
      // Page 2+ must start at the top margin — never reuse spilled page-1 Y.
      isFirst ? bodyStartY : master.margins.top,
      preplaced,
      allOriginalElements
    );

    result.push(page);
    remaining = overflow;
    isFirst = false;
    pageNumber += 1;

    if (remaining.length === 0) break;
  }

  // Never drop overflow (images/dates) if the pagination loop hit its guard.
  if (remaining.length > 0) {
    const salvageShell: TemplatePage = {
      id: uuidv4(),
      name: `Page ${pageNumber}`,
      margins: { ...master.margins },
      pageSize: master.pageSize ? { ...master.pageSize } : undefined,
      userAuthored: false,
      elements: [
        ...appendFootersFromMasterPage(master, {
          id: '',
          name: '',
          margins: master.margins,
          elements: [],
        }),
        ...remaining.map((el) =>
          withLogicalFlowY({ ...el, y: master.margins.top }, master.margins.top)
        ),
      ],
    };
    let salvageRemaining = remaining;
    let salvageGuard = 0;
    while (salvageRemaining.length > 0 && salvageGuard < 16) {
      salvageGuard += 1;
      const shell: TemplatePage = {
        ...salvageShell,
        id: uuidv4(),
        name: `Page ${pageNumber}`,
        elements: [
          ...appendFootersFromMasterPage(master, salvageShell),
          ...salvageRemaining.map((el) =>
            withLogicalFlowY({ ...el, y: master.margins.top }, master.margins.top)
          ),
        ],
      };
      const laidOut = layoutPageDocumentFlow(
        shell,
        shell.elements,
        master.margins.top,
        []
      );
      result.push(laidOut.page);
      pageNumber += 1;
      if (laidOut.overflow.length >= salvageRemaining.length) {
        // No progress — append remaining as-is so components stay visible.
        result.push({
          ...shell,
          id: uuidv4(),
          name: `Page ${pageNumber}`,
          elements: [
            ...appendFootersFromMasterPage(master, shell),
            ...laidOut.overflow.map((el) =>
              withLogicalFlowY({ ...el, y: master.margins.top }, master.margins.top)
            ),
          ],
        });
        break;
      }
      salvageRemaining = laidOut.overflow;
    }
  }

  const combined = [
    ...result,
    ...preservedTail.map((page) => ({
      ...page,
      // Drop any stale cross-page flow stamps so media keeps builder page-local Y.
      elements: page.elements.map((element) => {
        const props = { ...(element.props ?? {}) } as Record<string, unknown>;
        if (LOGICAL_FLOW_Y_KEY in props) delete props[LOGICAL_FLOW_Y_KEY];
        return { ...element, props };
      }),
    })),
  ];
  return applyPreviewPageNumbers(
    dropEmptyTrailingPages(normalizeDocumentFooters(combined))
  );
}

/**
 * Live preview + builder: always run full Word-style gather → restack → paginate
 * (same pipeline) so add/delete rows, page-2 spill, and pull-back match the canvas.
 */
export function reflowPagesForPreview(
  pages: TemplatePage[],
  options: PreviewReflowOptions = {}
): TemplatePage[] {
  if (pages.length === 0) return pages;

  const consolidatedTables = consolidatePaginatedTablesForReflow(cloneTemplatePages(pages));
  const consolidated = consolidatePaginatedTextBoxesForReflow(consolidatedTables);
  const tableOptions: PreviewReflowOptions = { trustTableProps: true, ...options };
  const withCardHeights = expandPreviewCardHeights(consolidated);

  let result = dropEmptyTrailingPages(
    reflowPagesWordStyle(withCardHeights, tableOptions)
  );
  result = sanitizeAnchorPageTableDuplicates(result);
  result = ensureMissingTableContinuationPages(result);
  result = normalizeDocumentFooters(result);
  return applyPreviewPageNumbers(dropEmptyTrailingPages(result));
}

/** Apply placeholders/form data then reflow only when content extends past its box. */
export function preparePreviewPages(
  pages: TemplatePage[],
  options: PreviewReflowOptions = {}
): TemplatePage[] {
  return reflowPagesForPreview(pages, options);
}
