import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { getPageDimensions } from './builder-dnd';
import { isImageComponentType } from './image-components';
import { getDisplayText, getTextElementStyle, isDataFieldType } from './text-styles';

const FLOW_GAP_PX = 10;
const PUSH_TOLERANCE_PX = 2;

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

function estimateTextWidth(text: string, fontSize: number): number {
  return Math.ceil(Math.max(1, text.length) * fontSize * 0.58) + 6;
}

function verticallyOverlaps(a: CanvasElement, b: CanvasElement, pad = 4): boolean {
  return a.y < b.y + b.height + pad && b.y < a.y + a.height + pad;
}

function rightLimitForField(
  field: CanvasElement,
  elements: CanvasElement[],
  pageRight: number,
  originalElements?: CanvasElement[]
): number {
  let maxRight = pageRight;

  for (const other of elements) {
    if (other.id === field.id || other.visible === false) continue;
    if (originalElements && didOverlapOriginally(field.id, other.id, originalElements)) continue;
    if (!verticallyOverlaps(field, other)) continue;

    const isMedia = isImageComponentType(other.type);
    // Anything starting to the right of this field's left edge can block growth.
    if (other.x > field.x + 2) {
      maxRight = Math.min(maxRight, other.x - FLOW_GAP_PX);
      continue;
    }
    // Logo/image already overlapping this field — keep text strictly left of it.
    if (
      isMedia
      && other.x < field.x + field.width
      && other.x + other.width > field.x
    ) {
      maxRight = Math.min(maxRight, other.x - FLOW_GAP_PX);
    }
  }

  return maxRight;
}

/**
 * Keep live values readable without relocating fields (which caused invoice
 * live preview to mismatch the template builder).
 * - Never change `x` — authored position is sacred
 * - May shrink width to clear logos/neighbors on the right
 * - May grow height to wrap text when the box is too narrow
 */
export function fitOverflowingDataFields(
  pages: TemplatePage[],
  originalElements?: CanvasElement[]
): TemplatePage[] {
  return pages.map((page) => {
    const { width: pageWidth } = getPageDimensions(page);
    const pageRight = pageWidth - page.margins.right;
    const elements = page.elements.map((element) => ({ ...element }));

    for (let index = 0; index < elements.length; index += 1) {
      const element = elements[index];
      if (element.visible === false || !isDataFieldType(element.type)) continue;
      if (element.type === ComponentType.ADDRESS) continue;

      const props = (element.props ?? {}) as Record<string, unknown>;
      const text = getDisplayText(props, element.type);
      const style = getTextElementStyle(props, element.type);
      const fontSize =
        typeof style.fontSize === 'number' && style.fontSize > 0 ? style.fontSize : 14;

      const maxRight = rightLimitForField(element, elements, pageRight, originalElements);
      const available = Math.max(48, maxRight - element.x);
      const overlapsBlocker = element.x + element.width > maxRight + 1;
      const neededWidth = text.trim()
        ? estimateTextWidth(text, fontSize)
        : element.width;

      // Fits in authored box and clears neighbors — leave geometry alone.
      if (!overlapsBlocker && neededWidth <= element.width + 1) continue;

      // Keep authored x; only shrink width so we don't cover logos to the right.
      let nextWidth = element.width;
      if (overlapsBlocker || nextWidth > available) {
        nextWidth = available;
      }

      let nextHeight = element.height;
      // Wrap inside the (possibly narrowed) box instead of growing left / moving.
      if (neededWidth > nextWidth + 2) {
        const lines = Math.max(1, Math.ceil(neededWidth / Math.max(nextWidth, 1)));
        nextHeight = Math.max(element.height, Math.ceil(lines * fontSize * 1.4));
      }

      if (nextWidth === element.width && nextHeight === element.height) continue;

      elements[index] = {
        ...element,
        width: nextWidth,
        height: nextHeight,
      };
    }

    return { ...page, elements };
  });
}
