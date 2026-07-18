import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { getPageDimensions } from './builder-dnd';
import {
  boxesHorizontallyOverlap,
  contentRectsCollide,
  estimateContentBounds,
  isOpaqueChromeElement,
  shouldPreserveDesignOverlap,
} from './content-overlap';
import {
  estimateWrappedLineCount,
  measureFontFromProps,
} from './structured-content-layout';
import type { MeasureFont } from './text-measure';
import { getDisplayText, getTextElementStyle, isDataFieldType } from './text-styles';
import { FLOW_GAP_PX } from './layout-metrics';

const PUSH_TOLERANCE_PX = 2;

function verticallyOverlaps(a: CanvasElement, b: CanvasElement, pad = 4): boolean {
  return a.y < b.y + b.height + pad && b.y < a.y + a.height + pad;
}

/**
 * Only real header chrome may shrink a field horizontally.
 * Generic IMAGE / watermark / side-by-side fields must NOT — that crushed
 * Bill To columns against neighbors and full-bleed decorative images.
 */
function isHorizontalChromeBlocker(type: string): boolean {
  return (
    type === ComponentType.LOGO
    || type === ComponentType.SIGNATURE
    || type === ComponentType.ICON
  );
}

/**
 * Keep authored column widths. Only inset/clamp for logo/signature/icon that
 * actually sits beside the field — never for every element to the right.
 */
function clampFieldHorizontally(
  field: CanvasElement,
  elements: CanvasElement[],
  pageRight: number
): { x: number; width: number } {
  const authoredRight = field.x + field.width;
  let minLeft = field.x;
  // Prefer authored right; only pull in for page edge or chrome.
  let maxRight = Math.min(authoredRight, pageRight);

  for (const other of elements) {
    if (other.id === field.id || other.visible === false) continue;
    if (!isHorizontalChromeBlocker(other.type)) continue;
    if (!verticallyOverlaps(field, other)) continue;
    if (other.x >= authoredRight - PUSH_TOLERANCE_PX || other.x + other.width <= field.x + PUSH_TOLERANCE_PX) {
      continue;
    }

    // Chrome starting to the right of the field origin — clamp right edge.
    if (other.x > field.x + 2) {
      maxRight = Math.min(maxRight, other.x - FLOW_GAP_PX);
      continue;
    }

    // Chrome from the left — inset only when it occupies the left half
    // (typical logo beside text). Full-bleed / centered graphics are ignored
    // so columns are not collapsed to ~48px.
    const chromeRight = other.x + other.width;
    if (chromeRight < field.x + field.width * 0.5) {
      minLeft = Math.max(minLeft, chromeRight + FLOW_GAP_PX);
    }
  }

  const nextX = minLeft;
  const nextWidth = Math.max(24, maxRight - nextX);
  // Never expand past authored width; never invent a crush floor of 48 against columns.
  return {
    x: nextX,
    width: Math.min(field.width - (nextX - field.x), nextWidth),
  };
}

/** Line height in px matching getTextElementStyle (ratio, px value, or 1.45 default). */
function fieldLineHeightPx(props: Record<string, unknown>, fontSize: number): number {
  const raw = props.lineHeight;
  if (typeof raw === 'number' && raw > 4) return raw;
  if (typeof raw === 'number') return fontSize * raw;
  return fontSize * 1.45;
}

function estimateNeededFieldHeight(
  text: string,
  font: MeasureFont,
  width: number,
  props: Record<string, unknown>
): number {
  const fontSize = font.fontSize;
  const showIcon = props.showIcon === true || props.addressHeaderMode === 'logo';
  const iconSize = showIcon ? Math.round(fontSize * 1.35) : 0;
  const iconGap = showIcon ? Math.max(4, Math.round(fontSize * 0.4)) : 0;
  const textBudget = Math.max(24, width - iconSize - iconGap);
  if (!text.trim()) return Math.max(iconSize, fontSize);
  const lines = estimateWrappedLineCount(text, fontSize, textBudget, font);
  return Math.max(iconSize, Math.ceil(lines * fieldLineHeightPx(props, fontSize)));
}

/**
 * After fields wrap/grow, push lower neighbors so live ink doesn't stack through
 * each other — while keeping blank design overlaps that still clear.
 */
function pushBelowGrownFields(
  elements: CanvasElement[],
  originalElements?: CanvasElement[]
): CanvasElement[] {
  const result = elements.map((element) => ({ ...element }));
  const sorted = [...result].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));

  for (let i = 0; i < sorted.length; i += 1) {
    const upperId = sorted[i].id;
    const upperIndex = result.findIndex((el) => el.id === upperId);
    if (upperIndex < 0) continue;
    const upper = result[upperIndex];
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

      const prevY = lower.y;
      const delta = minY - prevY;
      result[lowerIndex] = { ...lower, y: minY };
      sorted[j] = result[lowerIndex];
      lower = result[lowerIndex];

      // Cascade delta to everything that was at/below this field in the same column
      // so address → phone → email keeps relative spacing.
      for (let k = j + 1; k < sorted.length; k += 1) {
        const nextIndex = result.findIndex((el) => el.id === sorted[k].id);
        if (nextIndex < 0) continue;
        const next = result[nextIndex];
        if (next.visible === false || isOpaqueChromeElement(next)) continue;
        if (!boxesHorizontallyOverlap(lower, next) && !boxesHorizontallyOverlap(upper, next)) {
          continue;
        }
        if (next.y + PUSH_TOLERANCE_PX < prevY) continue;
        result[nextIndex] = { ...next, y: next.y + delta };
        sorted[k] = result[nextIndex];
      }
    }
  }

  return result;
}

function shouldFitDataField(type: string): boolean {
  if (!isDataFieldType(type)) return false;
  // Chrome / pagination labels must keep authored geometry.
  if (type === ComponentType.PAGE_NUMBER) return false;
  return true;
}

/**
 * Keep live values readable without relocating fields (which caused invoice
 * live preview to mismatch the template builder).
 * - Authored `x` stays unless left-side logo forces a minimal inset
 * - May shrink width to clear logos/neighbors on the right
 * - May grow height for wrap / multiline / icons
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
      if (element.visible === false || !shouldFitDataField(element.type)) continue;

      const props = (element.props ?? {}) as Record<string, unknown>;
      const text = getDisplayText(props, element.type);
      const style = getTextElementStyle(props, element.type);
      const measured = measureFontFromProps(props, element.type);
      const fontSize =
        typeof style.fontSize === 'number' && style.fontSize > 0 ? style.fontSize : 14;
      const font: MeasureFont = { ...measured, fontSize };

      const clamped = clampFieldHorizontally(element, elements, pageRight);
      const nextX = clamped.x;
      const nextWidth = clamped.width;
      const widthChanged = nextX !== element.x || nextWidth !== element.width;

      const neededHeight = estimateNeededFieldHeight(text, font, nextWidth, props);
      const showIcon = props.showIcon === true || props.addressHeaderMode === 'logo';
      const iconSize = showIcon ? Math.round(fontSize * 1.35) : 0;
      const iconGap = showIcon ? Math.max(4, Math.round(fontSize * 0.4)) : 0;
      const textBudget = Math.max(24, nextWidth - iconSize - iconGap);
      const wrapLines = text.trim()
        ? estimateWrappedLineCount(text, fontSize, textBudget, font)
        : 0;
      // Grow only when wrap/multiline/clamp needs it — avoid reflowing every short label.
      const shouldGrowHeight =
        widthChanged
        || wrapLines > 1
        || text.includes('\n')
        || neededHeight > element.height + PUSH_TOLERANCE_PX;
      const nextHeight = shouldGrowHeight
        ? Math.max(element.height, neededHeight)
        : element.height;

      if (
        nextX === element.x
        && nextWidth === element.width
        && nextHeight === element.height
      ) {
        continue;
      }

      elements[index] = {
        ...element,
        x: nextX,
        width: nextWidth,
        height: nextHeight,
      };
    }

    elements = pushBelowGrownFields(elements, originalElements);

    return { ...page, elements };
  });
}
