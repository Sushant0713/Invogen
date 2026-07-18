/**
 * Single geometry / collision policy for builder preview and invoice live layout.
 * Callers should prefer this module over duplicating overlap/chrome predicates.
 */
import type { CanvasElement } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import {
  boxesHorizontallyOverlap,
  boxesOverlap,
  boxesVerticallyOverlap,
  contentRectsCollide,
  didBoxesOverlapOriginally,
  didVerticallyOverlapOriginally,
  estimateContentBounds,
  estimateTextWidth,
  isOpaqueChromeElement,
  shouldPreserveDesignOverlap,
  shouldSkipPushForOriginalOverlap,
  type ContentRect,
} from './content-overlap';
import { isDocumentFooterElement } from './document-footer';
import { isImageComponentType } from './image-components';

export type { ContentRect };

export {
  boxesHorizontallyOverlap,
  boxesOverlap,
  boxesVerticallyOverlap,
  contentRectsCollide,
  didBoxesOverlapOriginally,
  didVerticallyOverlapOriginally,
  estimateContentBounds,
  estimateTextWidth,
  isOpaqueChromeElement,
  shouldPreserveDesignOverlap,
  shouldSkipPushForOriginalOverlap,
};

export const LAYOUT_FLOW_GAP_PX = 10;
export const LAYOUT_PUSH_TOLERANCE_PX = 2;
export const LAYOUT_ROW_Y_TOLERANCE_PX = 24;

/**
 * Fixed chrome — never pushed by table/card growth and never restacked.
 * Soft UI "Pin" is intentionally NOT included.
 */
export function isLayoutFixedChrome(element: CanvasElement): boolean {
  if (element.visible === false) return false;
  if (element.type === ComponentType.WATERMARK) return true;
  if (isDocumentFooterElement(element)) return true;
  if (element.type === ComponentType.PAGE_NUMBER) return true;
  if (element.type === ComponentType.ICON) return true;
  if (
    element.type === ComponentType.IMAGE
    || element.type === ComponentType.LOGO
    || element.type === ComponentType.SIGNATURE
    || element.type === ComponentType.STAMP
    || element.type === ComponentType.BARCODE
  ) {
    return true;
  }
  const props = (element.props ?? {}) as Record<string, unknown>;
  if (props.fixedInFlow === true) return true;
  return false;
}

/** Soft-pinned content that still participates in push/pagination. */
export function isLayoutSoftPinned(element: CanvasElement): boolean {
  return element.pinned === true && !isLayoutFixedChrome(element);
}

/** Logo / signature / icon may inset or clamp field width — never side-by-side fields. */
export function isHorizontalChromeBlocker(type: string): boolean {
  return (
    type === ComponentType.LOGO
    || type === ComponentType.SIGNATURE
    || type === ComponentType.ICON
  );
}

export function elementsVerticallyOverlapLoose(
  a: CanvasElement,
  b: CanvasElement,
  pad = 4
): boolean {
  return a.y < b.y + b.height + pad && b.y < a.y + a.height + pad;
}

/**
 * Keep authored column widths. Only inset/clamp for logo/signature/icon that
 * actually sits beside the field — never for every element to the right.
 */
export function clampFieldAgainstChrome(
  field: CanvasElement,
  elements: CanvasElement[],
  pageRight: number
): { x: number; width: number } {
  const authoredRight = field.x + field.width;
  let minLeft = field.x;
  let maxRight = Math.min(authoredRight, pageRight);

  for (const other of elements) {
    if (other.id === field.id || other.visible === false) continue;
    if (!isHorizontalChromeBlocker(other.type)) continue;
    if (!elementsVerticallyOverlapLoose(field, other)) continue;
    if (
      other.x >= authoredRight - LAYOUT_PUSH_TOLERANCE_PX
      || other.x + other.width <= field.x + LAYOUT_PUSH_TOLERANCE_PX
    ) {
      continue;
    }

    if (other.x > field.x + 2) {
      maxRight = Math.min(maxRight, other.x - LAYOUT_FLOW_GAP_PX);
      continue;
    }

    const chromeRight = other.x + other.width;
    if (chromeRight < field.x + field.width * 0.5) {
      minLeft = Math.max(minLeft, chromeRight + LAYOUT_FLOW_GAP_PX);
    }
  }

  const nextX = minLeft;
  const nextWidth = Math.max(24, maxRight - nextX);
  return {
    x: nextX,
    width: Math.min(field.width - (nextX - field.x), nextWidth),
  };
}

/** True when any non-chrome element extends past the page content bottom. */
export function pagesOverflowContentBottom(
  pages: { elements: CanvasElement[]; margins: { bottom: number }; pageSize?: { height: number } }[],
  pageHeightFallback = 1123
): boolean {
  return pages.some((page) => {
    const pageHeight = page.pageSize?.height ?? pageHeightFallback;
    const contentBottom = pageHeight - page.margins.bottom;
    return page.elements.some((element) => {
      if (element.visible === false || isLayoutFixedChrome(element)) return false;
      return element.y + element.height > contentBottom + LAYOUT_PUSH_TOLERANCE_PX;
    });
  });
}

/** Align opaque-chrome helper with fixed-chrome (including stamp/barcode). */
export function isPushBlockedChrome(element: CanvasElement): boolean {
  return isLayoutFixedChrome(element) || isOpaqueChromeElement(element) || isImageComponentType(element.type);
}
