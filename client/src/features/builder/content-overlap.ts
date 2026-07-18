import type { CanvasElement } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { estimateCardBlockHeight, isCardComponentType } from './card-components';
import { isImageComponentType } from './image-components';
import {
  estimateStructuredBlockHeight,
  estimateTextBlockHeight,
  estimateWrappedLineCount,
  isStructuredContentType,
} from './structured-content-layout';
import { isTableElementType } from './product-table';
import { getDisplayText, getTextElementStyle, isDataFieldType, isTextStylable } from './text-styles';

/** Chrome that stays put — fields clamp around it instead of pushing it. */
export function isOpaqueChromeElement(element: CanvasElement): boolean {
  if (element.visible === false) return false;
  if (element.type === ComponentType.WATERMARK) return true;
  if (element.type === ComponentType.PAGE_NUMBER) return true;
  if (element.type === ComponentType.ICON) return true;
  if (isImageComponentType(element.type)) return true;
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

function estimateTextWidth(text: string, fontSize: number): number {
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

/**
 * Approximate the ink/content rectangle inside an element's box.
 * Blank padding does not count — so intentional empty-box overlaps stay safe
 * until live text/icons fill that space.
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

  // Opaque media / tables / shapes fill their box.
  if (
    isImageComponentType(element.type)
    || isTableElementType(element.type)
    || element.type === ComponentType.WATERMARK
    || element.type === ComponentType.RECTANGLE
    || element.type === ComponentType.ROUNDED_RECT
    || element.type === ComponentType.CIRCLE
    || element.type === ComponentType.DIVIDER
    || element.type === ComponentType.LINE
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
      height: Math.min(element.height, Math.max(16, contentH)),
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
      height: Math.min(element.height, Math.max(16, contentH)),
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

    if (!text) {
      return {
        x: element.x,
        y: element.y,
        width: Math.min(element.width, Math.max(iconSize, 8)),
        height: Math.min(element.height, Math.max(iconSize, fontSize)),
      };
    }

    const singleLineW = estimateTextWidth(text, fontSize);
    const lines = estimateWrappedLineCount(text, fontSize, textWidthBudget);
    const contentW = Math.min(
      element.width,
      iconSize + iconGap + Math.min(singleLineW, textWidthBudget)
    );
    const contentH = Math.min(
      element.height,
      Math.max(
        iconSize,
        Math.ceil(lines * fontSize * 1.4),
        estimateTextBlockHeight(text, fontSize, textWidthBudget)
      )
    );

    return {
      x: element.x,
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
  return rectsIntersect(estimateContentBounds(a), estimateContentBounds(b));
}

/**
 * Designer intentionally overlapped blank box areas — keep relative placement
 * unless live content now collides.
 */
export function shouldPreserveDesignOverlap(
  a: CanvasElement,
  b: CanvasElement,
  originalElements: CanvasElement[]
): boolean {
  const origA = originalElements.find((el) => el.id === a.id);
  const origB = originalElements.find((el) => el.id === b.id);
  if (!origA || !origB) return false;
  if (!boxesOverlap(origA, origB)) return false;
  // Blank-on-blank was fine; live ink collision must be resolved.
  return !contentRectsCollide(a, b);
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
