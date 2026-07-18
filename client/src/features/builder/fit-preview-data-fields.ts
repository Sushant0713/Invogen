import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { getPageDimensions } from './builder-dnd';
import { isImageComponentType } from './image-components';
import {
  boxesHorizontallyOverlap,
  contentRectsCollide,
  estimateContentBounds,
  isOpaqueChromeElement,
  shouldPreserveDesignOverlap,
} from './content-overlap';
import { getDisplayText, getTextElementStyle, isDataFieldType } from './text-styles';

const FLOW_GAP_PX = 10;
const PUSH_TOLERANCE_PX = 2;

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

    const isMedia = isImageComponentType(other.type) || other.type === ComponentType.ICON;
    // Blank intentional overlaps may skip non-media blockers; logos always clamp.
    if (
      !isMedia
      && originalElements
      && shouldPreserveDesignOverlap(field, other, originalElements)
    ) {
      continue;
    }
    if (!verticallyOverlaps(field, other)) continue;

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
 * After fields wrap/grow, push lower neighbors so live ink doesn't stack through
 * each other — while keeping blank design overlaps that still clear.
 */
function pushBelowGrownFields(
  elements: CanvasElement[],
  originalElements?: CanvasElement[]
): CanvasElement[] {
  let result = elements.map((element) => ({ ...element }));
  const sorted = [...result].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));

  for (let i = 0; i < sorted.length; i += 1) {
    const upperId = sorted[i].id;
    const upperIndex = result.findIndex((el) => el.id === upperId);
    if (upperIndex < 0) continue;
    let upper = result[upperIndex];
    if (upper.visible === false) continue;

    for (let j = i + 1; j < sorted.length; j += 1) {
      const lowerId = sorted[j].id;
      const lowerIndex = result.findIndex((el) => el.id === lowerId);
      if (lowerIndex < 0) continue;
      let lower = result[lowerIndex];
      if (lower.visible === false || isOpaqueChromeElement(lower)) continue;
      if (!boxesHorizontallyOverlap(upper, lower)) continue;
      if (originalElements && shouldPreserveDesignOverlap(upper, lower, originalElements)) {
        continue;
      }

      const upperContent = estimateContentBounds(upper);
      const lowerContent = estimateContentBounds(lower);
      const inkCollides = contentRectsCollide(upper, lower);
      const stackedThrough =
        lower.y < upper.y + upper.height - PUSH_TOLERANCE_PX
        && lowerContent.y < upperContent.y + upperContent.height - PUSH_TOLERANCE_PX;

      if (!inkCollides && !stackedThrough) continue;

      const minY =
        Math.max(upper.y + upper.height, upperContent.y + upperContent.height) + FLOW_GAP_PX;
      if (lower.y + PUSH_TOLERANCE_PX >= minY) continue;

      const delta = minY - lower.y;
      result[lowerIndex] = { ...lower, y: minY };
      // Keep sorted snapshot in sync for later pairs in this pass.
      sorted[j] = result[lowerIndex];
      lower = result[lowerIndex];

      // Cascade the same delta to anything that was below this lower element
      // in the same column so a chain of address/phone/email stays spaced.
      for (let k = j + 1; k < sorted.length; k += 1) {
        const nextIndex = result.findIndex((el) => el.id === sorted[k].id);
        if (nextIndex < 0) continue;
        const next = result[nextIndex];
        if (next.visible === false || isOpaqueChromeElement(next)) continue;
        if (!boxesHorizontallyOverlap(lower, next) && !boxesHorizontallyOverlap(upper, next)) {
          continue;
        }
        if (next.y + PUSH_TOLERANCE_PX < lower.y + lower.height) {
          result[nextIndex] = { ...next, y: next.y + delta };
          sorted[k] = result[nextIndex];
        }
      }
    }
  }

  return result;
}

/**
 * Keep live values readable without relocating fields (which caused invoice
 * live preview to mismatch the template builder).
 * - Never change `x` — authored position is sacred
 * - May shrink width to clear logos/neighbors on the right
 * - May grow height to wrap text when the box is too narrow
 * - May push stacked fields when live ink collides (blank overlaps stay)
 */
export function fitOverflowingDataFields(
  pages: TemplatePage[],
  originalElements?: CanvasElement[]
): TemplatePage[] {
  return pages.map((page) => {
    const { width: pageWidth } = getPageDimensions(page);
    const pageRight = pageWidth - page.margins.right;
    let elements = page.elements.map((element) => ({ ...element }));

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

    elements = pushBelowGrownFields(elements, originalElements);

    return { ...page, elements };
  });
}
