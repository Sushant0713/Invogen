import { v4 as uuidv4 } from 'uuid';
import { ComponentType } from '@invogen/shared';
import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { getPageDimensions, type PageMargins } from './builder-dnd';
import { isTableElementType } from './product-table';
import { resolvePreviewTableFittedLayout } from './table-element-size';
import {
  estimateStructuredBlockHeight,
  isStructuredContentType,
} from './structured-content-layout';

const PUSH_TOLERANCE_PX = 2;
const FLOW_GAP_PX = 12;
const ROW_Y_TOLERANCE_PX = 24;

function cloneElements(elements: CanvasElement[]): CanvasElement[] {
  return elements.map((element) => ({ ...element, props: { ...(element.props ?? {}) } }));
}

/** Background layers only — all other elements participate in document flow. */
export function isPinnedPreviewElement(element: CanvasElement): boolean {
  return element.visible !== false && element.type === ComponentType.WATERMARK;
}

function measureElementExpansion(
  element: CanvasElement
): { widthDelta: number; heightDelta: number; fittedHeight: number } {
  if (element.visible === false) {
    return { widthDelta: 0, heightDelta: 0, fittedHeight: element.height };
  }

  if (isTableElementType(element.type)) {
    const fitted = resolvePreviewTableFittedLayout(
      element.type,
      element.width,
      (element.props ?? {}) as Record<string, unknown>
    );
    return {
      widthDelta: Math.max(0, fitted.width - element.width),
      heightDelta: Math.max(0, fitted.height - element.height),
      fittedHeight: fitted.height,
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

  return { widthDelta: 0, heightDelta: 0, fittedHeight: element.height };
}

function contentOverlapsExpandedTable(
  page: TemplatePage,
  table: CanvasElement,
  contentHeight: number
): boolean {
  const contentBottom = table.y + contentHeight;

  return page.elements.some((element) => {
    if (element.id === table.id || element.visible === false) return false;
    if (isTableElementType(element.type) || isPinnedPreviewElement(element)) return false;
    if (element.y + element.height <= table.y + PUSH_TOLERANCE_PX) return false;
    if (element.y >= contentBottom - PUSH_TOLERANCE_PX) return false;
    return true;
  });
}

/** True when preview layout must expand tables/blocks or push content below. */
export function pageNeedsReflow(page: TemplatePage): boolean {
  return page.elements.some((element) => {
    const { heightDelta, fittedHeight } = measureElementExpansion(element);
    if (heightDelta > PUSH_TOLERANCE_PX) return true;
    if (isTableElementType(element.type)) {
      return contentOverlapsExpandedTable(page, element, fittedHeight);
    }
    return false;
  });
}

export function previewPagesNeedReflow(pages: TemplatePage[]): boolean {
  return pages.some(pageNeedsReflow);
}

/** Set page-number fields to the rendered page index (1-based). */
export function applyPreviewPageNumbers(pages: TemplatePage[]): TemplatePage[] {
  return pages.map((page, index) => ({
    ...page,
    elements: page.elements.map((element) => {
      if (element.type !== ComponentType.PAGE_NUMBER) return element;
      return {
        ...element,
        props: { ...(element.props ?? {}), value: String(index + 1) },
      };
    }),
  }));
}

function repositionForPageTop(elements: CanvasElement[], margins: PageMargins): CanvasElement[] {
  if (elements.length === 0) return elements;
  const minY = Math.min(...elements.map((element) => element.y));
  const offset = margins.top - minY;
  if (Math.abs(offset) <= 1) return elements;
  return elements.map((element) => ({ ...element, y: element.y + offset }));
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

/** Stack footer blocks below expanded tables while keeping same-row horizontal alignment. */
function flowLayoutBelowTables(elements: CanvasElement[]): CanvasElement[] {
  const tables = elements
    .filter((element) => element.visible !== false && isTableElementType(element.type))
    .sort((a, b) => a.y - b.y);
  if (tables.length === 0) return elements;

  let result = elements.map((element) => ({ ...element }));

  for (let tableIndex = 0; tableIndex < tables.length; tableIndex += 1) {
    const tableElement = result.find((element) => element.id === tables[tableIndex].id);
    if (!tableElement) continue;

    const tableBottom = tableElement.y + tableElement.height;
    const nextTableTop =
      tableIndex + 1 < tables.length
        ? result.find((element) => element.id === tables[tableIndex + 1].id)?.y ?? Infinity
        : Infinity;

    const segment = result.filter(
      (element) =>
        element.visible !== false
        && element.id !== tableElement.id
        && !isTableElementType(element.type)
        && !isPinnedPreviewElement(element)
        && element.y >= tableElement.y - PUSH_TOLERANCE_PX
        && element.y < nextTableTop
        && element.y < tableBottom + PUSH_TOLERANCE_PX
    );

    if (segment.length === 0) continue;

    const rows = groupElementsIntoRows(segment);
    let cursorY = tableBottom + FLOW_GAP_PX;

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
  const staying: CanvasElement[] = [];
  const overflow: CanvasElement[] = [];

  for (const element of elements) {
    if (element.visible === false) {
      staying.push(element);
      continue;
    }
    if (isTableElementType(element.type) || isPinnedPreviewElement(element)) {
      staying.push(element);
      continue;
    }
    if (element.y + element.height > contentBottomLimit + PUSH_TOLERANCE_PX) {
      overflow.push(element);
    } else {
      staying.push(element);
    }
  }

  return { staying, overflow };
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

function reflowSinglePage(page: TemplatePage): { page: TemplatePage; overflow: CanvasElement[] } {
  const { height: pageHeight } = getPageDimensions(page);
  const contentBottomLimit = pageHeight - page.margins.bottom;

  let elements = cloneElements(page.elements);

  const expandables = elements
    .filter(
      (element) =>
        element.visible !== false
        && (isTableElementType(element.type) || isStructuredContentType(element.type))
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
      const fitted = resolvePreviewTableFittedLayout(
        current.type,
        current.width,
        (current.props ?? {}) as Record<string, unknown>
      );
      nextWidth = Math.max(current.width, fitted.width);
      nextHeight = fitted.height;
      nextProps = fitted.tableProps;
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
    }

    elements[index] = {
      ...current,
      width: nextWidth,
      height: nextHeight,
      props: nextProps,
    };
  }

  elements = flowLayoutBelowTables(elements);

  const { staying, overflow } = splitOverflowElements(elements, contentBottomLimit);
  return {
    page: { ...page, elements: staying },
    overflow,
  };
}

function createContinuationPage(sourcePage: TemplatePage, overflow: CanvasElement[]): TemplatePage {
  return {
    id: uuidv4(),
    name: `${sourcePage.name} (continued)`,
    margins: { ...sourcePage.margins },
    pageSize: sourcePage.pageSize ? { ...sourcePage.pageSize } : undefined,
    elements: repositionForPageTop(overflow, sourcePage.margins),
  };
}

/**
 * Expand tables / structured blocks to their fitted height, push content below
 * downward, and spill past the page bottom onto the next page (creating one if needed).
 * Returns pages unchanged when template content already fits (matches gallery layout).
 */
export function reflowPagesForPreview(pages: TemplatePage[]): TemplatePage[] {
  if (pages.length === 0) return pages;
  if (!previewPagesNeedReflow(pages)) return pages;

  const result: TemplatePage[] = [];
  let pendingOverflow: CanvasElement[] = [];

  const flushOverflow = (anchorPage: TemplatePage) => {
    if (pendingOverflow.length === 0) return;
    const continuation = createContinuationPage(anchorPage, pendingOverflow);
    const reflowed = reflowSinglePage(continuation);
    result.push(reflowed.page);
    pendingOverflow = reflowed.overflow;
  };

  for (const sourcePage of pages) {
    flushOverflow(result.length > 0 ? result[result.length - 1] : sourcePage);

    const reflowed = reflowSinglePage(sourcePage);
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
