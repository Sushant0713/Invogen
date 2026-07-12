import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { getPageDimensions } from './builder-dnd';
import { isImageComponentType } from './image-components';
import { getDisplayText, getTextElementStyle, isDataFieldType } from './text-styles';

const FLOW_GAP_PX = 10;

function estimateTextWidth(text: string, fontSize: number): number {
  return Math.ceil(Math.max(1, text.length) * fontSize * 0.58) + 6;
}

function verticallyOverlaps(a: CanvasElement, b: CanvasElement, pad = 4): boolean {
  return a.y < b.y + b.height + pad && b.y < a.y + a.height + pad;
}

function rightLimitForField(
  field: CanvasElement,
  elements: CanvasElement[],
  pageRight: number
): number {
  let maxRight = pageRight;

  for (const other of elements) {
    if (other.id === field.id || other.visible === false) continue;
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
 * Universal preview/view fix:
 * Keep invoice # / dates / GST / PAN readable without covering logos or neighbors.
 * - Always clamp fields so they do not sit under images/logos
 * - Widen when live values are longer than the template sample box
 * - Wrap + grow height when horizontal space is still too tight
 */
export function fitOverflowingDataFields(pages: TemplatePage[]): TemplatePage[] {
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

      const maxRight = rightLimitForField(element, elements, pageRight);
      const available = Math.max(48, maxRight - element.x);
      const overlapsBlocker = element.x + element.width > maxRight + 1;
      const neededWidth = text.trim()
        ? estimateTextWidth(text, fontSize)
        : element.width;

      // Nothing to do when text fits and the box already clears neighbors.
      if (!overlapsBlocker && neededWidth <= element.width + 1) continue;

      let nextX = element.x;
      let nextWidth = Math.min(Math.max(element.width, neededWidth), available);

      // Always pull the right edge left of logos / blockers.
      if (overlapsBlocker || nextWidth > available) {
        nextWidth = available;
      }

      // Prefer growing left if more width is still needed.
      if (neededWidth > nextWidth + 1) {
        const growLeft = Math.min(
          neededWidth - nextWidth,
          Math.max(0, element.x - page.margins.left)
        );
        nextX = element.x - growLeft;
        nextWidth = Math.min(neededWidth, Math.max(48, maxRight - nextX));
      }

      nextWidth = Math.max(48, Math.min(nextWidth, maxRight - nextX));

      let nextHeight = element.height;
      if (neededWidth > nextWidth + 2) {
        const lines = Math.max(1, Math.ceil(neededWidth / nextWidth));
        nextHeight = Math.max(element.height, Math.ceil(lines * fontSize * 1.4));
      }

      elements[index] = {
        ...element,
        x: nextX,
        width: nextWidth,
        height: nextHeight,
      };
    }

    return { ...page, elements };
  });
}
