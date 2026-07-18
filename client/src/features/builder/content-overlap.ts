import type { CanvasElement } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { estimateCardBlockHeight, isCardComponentType } from './card-components';
import { isImageComponentType } from './image-components';
import {
  estimateStructuredBlockHeight,
  estimateWrappedLineCount,
  isStructuredContentType,
  measureFontFromProps,
} from './structured-content-layout';
import { isTableElementType } from './product-table';
import { getDisplayText, getTextElementStyle, isDataFieldType, isTextStylable } from './text-styles';

/** Chrome that stays put — fields clamp around it instead of pushing it. */
export function isOpaqueChromeElement(element: CanvasElement): boolean {
  if (element.visible === false) return false;
  if (element.type === ComponentType.WATERMARK) return true;
  if (element.type === ComponentType.PAGE_NUMBER) return true;
  if (element.type === ComponentType.ICON) return true;
  // Document footers are band-positioned by the reflow engine — the data-field
  // fit pass must never cascade-push them (that shoved footers off the page).
  if (element.type === ComponentType.FOOTER) return true;
  // SIGNATURE flows with content (pushed below grown terms/tables) — see
  // isFixedChromeElement in preview-page-reflow.
  if (isImageComponentType(element.type) && element.type !== ComponentType.SIGNATURE) {
    return true;
  }
  const props = (element.props ?? {}) as Record<string, unknown>;
  return props.fixedInFlow === true;
}

export type ContentRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const TOLERANCE = 2;

/** Shared with fit-preview so clamp and collide agree. */
export function estimateTextWidth(text: string, fontSize: number): number {
  return Math.ceil(Math.max(1, text.length) * fontSize * 0.55) + 4;
}

function rectsIntersect(a: ContentRect, b: ContentRect, pad = TOLERANCE): boolean {
  return (
    a.x < b.x + b.width - pad
    && b.x < a.x + a.width - pad
    && a.y < b.y + b.height - pad
    && b.y < a.y + a.height - pad
  );
}

export function boxesVerticallyOverlap(
  a: Pick<CanvasElement, 'y' | 'height'>,
  b: Pick<CanvasElement, 'y' | 'height'>,
  pad = TOLERANCE
): boolean {
  return a.y < b.y + b.height - pad && b.y < a.y + a.height - pad;
}

export function boxesHorizontallyOverlap(
  a: Pick<CanvasElement, 'x' | 'width'>,
  b: Pick<CanvasElement, 'x' | 'width'>,
  pad = TOLERANCE
): boolean {
  return a.x < b.x + b.width - pad && b.x < a.x + a.width - pad;
}

/** True when two elements' bounding boxes intersect (designer blank-overlap included). */
export function boxesOverlap(a: CanvasElement, b: CanvasElement, pad = TOLERANCE): boolean {
  return boxesVerticallyOverlap(a, b, pad) && boxesHorizontallyOverlap(a, b, pad);
}

function isDecorativeShapeType(type: string): boolean {
  return (
    type === ComponentType.RECTANGLE
    || type === ComponentType.ROUNDED_RECT
    || type === ComponentType.CIRCLE
    || type === ComponentType.DIVIDER
    || type === ComponentType.LINE
  );
}

function resolveTextAlign(props: Record<string, unknown>): 'left' | 'center' | 'right' {
  const align = props.textAlign;
  if (align === 'center' || align === 'right') return align;
  return 'left';
}

function placeContentX(
  boxX: number,
  boxW: number,
  contentW: number,
  align: 'left' | 'center' | 'right'
): number {
  if (align === 'right') return boxX + Math.max(0, boxW - contentW);
  if (align === 'center') return boxX + Math.max(0, (boxW - contentW) / 2);
  return boxX;
}

/**
 * Approximate the ink/content rectangle inside an element's box.
 * Blank padding does not count — so intentional empty-box overlaps stay safe
 * until live text/icons fill that space.
 * Height is NOT capped to the box: overflow:visible intentional overlaps can paint past it.
 */
export function estimateContentBounds(element: CanvasElement): ContentRect {
  const box: ContentRect = {
    x: element.x,
    y: element.y,
    width: Math.max(1, element.width),
    height: Math.max(1, element.height),
  };

  if (element.visible === false) {
    return { ...box, width: 0, height: 0 };
  }

  // Decorative shapes are background, not ink — don't force text off banners.
  if (isDecorativeShapeType(element.type)) {
    return { x: element.x, y: element.y, width: 0, height: 0 };
  }

  // Opaque media / tables fill their box.
  if (
    isImageComponentType(element.type)
    || isTableElementType(element.type)
    || element.type === ComponentType.WATERMARK
  ) {
    return box;
  }

  const props = (element.props ?? {}) as Record<string, unknown>;

  if (isCardComponentType(element.type)) {
    const contentH = estimateCardBlockHeight(
      element.type,
      props,
      element.width,
      Math.min(element.height, 24)
    );
    return {
      x: element.x,
      y: element.y,
      width: element.width,
      height: Math.max(16, contentH),
    };
  }

  if (isStructuredContentType(element.type)) {
    const contentH = estimateStructuredBlockHeight(
      element.type,
      props,
      element.width,
      Math.min(element.height, 24)
    );
    return {
      x: element.x,
      y: element.y,
      width: element.width,
      height: Math.max(16, contentH),
    };
  }

  if (isDataFieldType(element.type) || isTextStylable(element.type)) {
    const text = getDisplayText(props, element.type).trim();
    const style = getTextElementStyle(props, element.type);
    const fontSize =
      typeof style.fontSize === 'number' && style.fontSize > 0 ? style.fontSize : 14;
    const showIcon = props.showIcon === true || props.addressHeaderMode === 'logo';
    const iconSize = showIcon ? Math.round(fontSize * 1.35) : 0;
    const iconGap = showIcon ? Math.max(4, Math.round(fontSize * 0.4)) : 0;
    const textWidthBudget = Math.max(24, element.width - iconSize - iconGap);
    const align = resolveTextAlign(props);

    if (!text) {
      const emptyW = Math.min(element.width, Math.max(iconSize, 8));
      return {
        x: placeContentX(element.x, element.width, emptyW, align),
        y: element.y,
        width: emptyW,
        height: Math.max(iconSize, fontSize),
      };
    }

    const longestLine = text.split('\n').reduce((max, line) => Math.max(max, line.length), 0);
    const singleLineW = estimateTextWidth(
      text.includes('\n') ? 'x'.repeat(longestLine) : text,
      fontSize
    );
    const font = measureFontFromProps(props, element.type);
    const lines = estimateWrappedLineCount(text, fontSize, textWidthBudget, {
      ...font,
      fontSize,
    });
    const contentW = Math.min(
      element.width,
      iconSize + iconGap + Math.min(singleLineW, textWidthBudget)
    );
    const contentH = Math.max(
      iconSize,
      Math.ceil(lines * fontSize * 1.4)
    );

    return {
      x: placeContentX(element.x, element.width, contentW, align),
      y: element.y,
      width: Math.max(8, contentW),
      height: Math.max(8, contentH),
    };
  }

  if (element.type === ComponentType.ICON) {
    const size = Math.min(element.width, element.height);
    return {
      x: element.x,
      y: element.y,
      width: size,
      height: size,
    };
  }

  // Conservative: treat unknown types as full box.
  return box;
}

export function contentRectsCollide(a: CanvasElement, b: CanvasElement): boolean {
  const ra = estimateContentBounds(a);
  const rb = estimateContentBounds(b);
  if (ra.width <= 0 || ra.height <= 0 || rb.width <= 0 || rb.height <= 0) return false;
  return rectsIntersect(ra, rb);
}

/**
 * Match legacy reflow: intentional overlap was tracked by vertical Y-range only.
 * Keep that predicate so table/card push behavior does not regress.
 */
export function didVerticallyOverlapOriginally(
  aId: string,
  bId: string,
  originalElements: CanvasElement[]
): boolean {
  const a = originalElements.find((el) => el.id === aId);
  const b = originalElements.find((el) => el.id === bId);
  if (!a || !b) return false;
  return boxesVerticallyOverlap(a, b);
}

/**
 * Designer intentionally overlapped blank box areas — keep relative placement
 * unless live content now collides.
 */
function verticalOverlapAmount(a: CanvasElement, b: CanvasElement): number {
  return Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
}

export function shouldPreserveDesignOverlap(
  a: CanvasElement,
  b: CanvasElement,
  originalElements: CanvasElement[]
): boolean {
  if (!didVerticallyOverlapOriginally(a.id, b.id, originalElements)) return false;
  // Blank-on-blank was fine.
  if (!contentRectsCollide(a, b)) return true;
  // Ink overlap that data injection did NOT worsen is authored design — the
  // builder renders it exactly like this (e.g. a section title box lapping the
  // field below by a few px). Pushing it apart shifted whole columns +17px
  // and tore side-by-side rows. Only push when the overlap grew.
  const originalA = originalElements.find((el) => el.id === a.id);
  const originalB = originalElements.find((el) => el.id === b.id);
  if (originalA && originalB) {
    const originalOverlap = verticalOverlapAmount(originalA, originalB);
    const currentOverlap = verticalOverlapAmount(a, b);
    if (currentOverlap <= originalOverlap + 2) return true;
  }
  return false;
}

export function didBoxesOverlapOriginally(
  aId: string,
  bId: string,
  originalElements: CanvasElement[]
): boolean {
  const a = originalElements.find((el) => el.id === aId);
  const b = originalElements.find((el) => el.id === bId);
  if (!a || !b) return false;
  return boxesOverlap(a, b);
}

/**
 * Skip push for intentional blank overlap, but still push when live content collides.
 */
export function shouldSkipPushForOriginalOverlap(
  anchor: CanvasElement,
  element: CanvasElement,
  originalElements: CanvasElement[]
): boolean {
  return shouldPreserveDesignOverlap(anchor, element, originalElements);
}
