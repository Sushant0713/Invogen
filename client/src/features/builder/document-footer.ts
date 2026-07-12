import { v4 as uuidv4 } from 'uuid';
import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { getPageDimensions } from './builder-dnd';

export const SHARED_FOOTER_ID_KEY = '__sharedFooterId';
export const FOOTER_BOTTOM_OFFSET_KEY = '__footerBottomOffset';

const DEFAULT_FOOTER_BOTTOM_GAP = 20;
const FOOTER_FLOW_GAP_PX = 12;

export function isDocumentFooterElement(element: CanvasElement): boolean {
  return element.type === ComponentType.FOOTER;
}

export function getSharedFooterId(element: CanvasElement): string | null {
  if (!isDocumentFooterElement(element)) return null;
  const stored = (element.props ?? {})[SHARED_FOOTER_ID_KEY];
  if (typeof stored === 'string' && stored.length > 0) return stored;
  return element.id;
}

export function resolveFooterBottomOffset(
  element: CanvasElement,
  page: TemplatePage
): number {
  const props = (element.props ?? {}) as Record<string, unknown>;
  const stored = props[FOOTER_BOTTOM_OFFSET_KEY];
  if (typeof stored === 'number' && Number.isFinite(stored)) return stored;
  const { height: pageHeight } = getPageDimensions(page);
  const margins = page.margins;
  return pageHeight - margins.bottom - (element.y + element.height);
}

export function positionFooterOnPage(
  footer: CanvasElement,
  page: TemplatePage,
  bottomOffset?: number
): CanvasElement {
  const { width: pageWidth, height: pageHeight } = getPageDimensions(page);
  const margins = page.margins;
  const offset = bottomOffset ?? resolveFooterBottomOffset(footer, page);
  const y = pageHeight - margins.bottom - footer.height - offset;
  const maxX = pageWidth - margins.right - footer.width;
  const x = Math.max(margins.left, Math.min(footer.x, maxX));
  const sharedId = getSharedFooterId(footer) ?? footer.id;

  return {
    ...footer,
    x,
    y: Math.max(margins.top, y),
    props: {
      ...(footer.props ?? {}),
      [SHARED_FOOTER_ID_KEY]: sharedId,
      [FOOTER_BOTTOM_OFFSET_KEY]: offset,
    },
  };
}

export function createDefaultFooterPlacement(page: TemplatePage): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const margins = page.margins;
  const { width: pageWidth, height: pageHeight } = getPageDimensions(page);
  const width = Math.min(520, pageWidth - margins.left - margins.right);
  const height = 36;
  const x = margins.left + Math.max(0, (pageWidth - margins.left - margins.right - width) / 2);
  const y = pageHeight - margins.bottom - height - DEFAULT_FOOTER_BOTTOM_GAP;
  return { x, y, width, height };
}

export function prepareNewFooterElement(
  element: CanvasElement,
  sourcePage: TemplatePage
): CanvasElement {
  const placement = createDefaultFooterPlacement(sourcePage);
  const sharedId = uuidv4();
  const { width: pageWidth } = getPageDimensions(sourcePage);
  const margins = sourcePage.margins;
  const maxX = pageWidth - margins.right - (element.width > 0 ? element.width : placement.width);
  const x = Math.max(margins.left, Math.min(element.x || placement.x, maxX));

  return positionFooterOnPage(
    {
      ...element,
      x,
      y: placement.y,
      width: element.width > 0 ? element.width : placement.width,
      height: element.height > 0 ? element.height : placement.height,
      props: {
        ...(element.props ?? {}),
        [SHARED_FOOTER_ID_KEY]: sharedId,
      },
    },
    sourcePage
  );
}

export function cloneFooterForPage(
  master: CanvasElement,
  page: TemplatePage
): CanvasElement {
  const referencePage = page;
  const bottomOffset = resolveFooterBottomOffset(master, referencePage);
  return positionFooterOnPage(
    {
      ...JSON.parse(JSON.stringify(master)) as CanvasElement,
      id: uuidv4(),
    },
    page,
    bottomOffset
  );
}

export function appendFootersFromMasterPage(
  masterPage: TemplatePage,
  targetPage: TemplatePage
): CanvasElement[] {
  return masterPage.elements
    .filter((element) => element.visible !== false && isDocumentFooterElement(element))
    .map((footer) => cloneFooterForPage(footer, targetPage));
}

/** Keep one linked footer per page — same content/position, unique element id per page. */
export function syncSharedFooterAcrossPages(
  pages: TemplatePage[],
  sourceFooter: CanvasElement
): TemplatePage[] {
  const sharedId = getSharedFooterId(sourceFooter);
  if (!sharedId) return pages;

  const sourcePageIndex = pages.findIndex((page) =>
    page.elements.some((element) => element.id === sourceFooter.id)
  );
  const referencePage = sourcePageIndex >= 0 ? pages[sourcePageIndex] : pages[0];
  if (!referencePage) return pages;

  const bottomOffset = resolveFooterBottomOffset(sourceFooter, referencePage);
  const template = positionFooterOnPage(sourceFooter, referencePage, bottomOffset);

  return pages.map((page) => {
    const existingIndex = page.elements.findIndex(
      (element) =>
        isDocumentFooterElement(element) && getSharedFooterId(element) === sharedId
    );

    const placed = positionFooterOnPage(
      {
        ...template,
        id: existingIndex >= 0 ? page.elements[existingIndex].id : uuidv4(),
        zIndex:
          existingIndex >= 0
            ? page.elements[existingIndex].zIndex
            : template.zIndex,
        locked: template.locked,
        visible: template.visible,
      },
      page,
      bottomOffset
    );

    if (existingIndex >= 0) {
      const elements = [...page.elements];
      elements[existingIndex] = placed;
      return { ...page, elements };
    }

    return { ...page, elements: [...page.elements, placed] };
  });
}

export function collectLinkedFooterElementIds(
  pages: TemplatePage[],
  elementId: string
): string[] {
  let sharedId: string | null = null;
  for (const page of pages) {
    const hit = page.elements.find((element) => element.id === elementId);
    if (hit && isDocumentFooterElement(hit)) {
      sharedId = getSharedFooterId(hit);
      break;
    }
  }
  if (!sharedId) return [elementId];

  const ids: string[] = [];
  for (const page of pages) {
    for (const element of page.elements) {
      if (isDocumentFooterElement(element) && getSharedFooterId(element) === sharedId) {
        ids.push(element.id);
      }
    }
  }
  return ids.length > 0 ? ids : [elementId];
}

/** Saved templates: link page-1 footers and ensure every page has a matching copy. */
export function normalizeDocumentFooters(pages: TemplatePage[]): TemplatePage[] {
  if (pages.length === 0) return pages;

  const masterFooters = pages[0].elements.filter(
    (element) => element.visible !== false && isDocumentFooterElement(element)
  );
  if (masterFooters.length === 0) return pages;

  let next = pages;
  for (const footer of masterFooters) {
    const withSharedId = footer.props?.[SHARED_FOOTER_ID_KEY]
      ? footer
      : {
          ...footer,
          props: {
            ...(footer.props ?? {}),
            [SHARED_FOOTER_ID_KEY]: footer.id,
          },
        };
    next = syncSharedFooterAcrossPages(next, withSharedId);
  }
  return next;
}

/** Flow content must stop above the footer band so tables/text do not overlap it. */
export function getFlowContentBottomLimit(
  page: TemplatePage,
  footerSource?: TemplatePage | null
): number {
  const { height: pageHeight } = getPageDimensions(page);
  let limit = pageHeight - page.margins.bottom;

  const sources = footerSource && footerSource !== page ? [page, footerSource] : [page];
  let footerTop: number | null = null;

  for (const source of sources) {
    for (const element of source.elements) {
      if (element.visible === false || !isDocumentFooterElement(element)) continue;
      // Measure footer as it would sit on this page (same bottom offset).
      const placed = positionFooterOnPage(element, page);
      footerTop = footerTop === null ? placed.y : Math.min(footerTop, placed.y);
    }
  }

  if (footerTop === null) return limit;
  return Math.min(limit, footerTop - FOOTER_FLOW_GAP_PX);
}
