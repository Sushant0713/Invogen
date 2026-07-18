import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { getPageDimensions } from './builder-dnd';
import {
  boxesHorizontallyOverlap,
  clampFieldAgainstChrome,
  contentRectsCollide,
  estimateContentBounds,
  isPushBlockedChrome,
  LAYOUT_FLOW_GAP_PX,
  LAYOUT_PUSH_TOLERANCE_PX,
  shouldPreserveDesignOverlap,
} from './layout-policy';
import {
  getElementOverflowPolicy,
  shouldPushRelatedElement,
} from './layout-intent';
import { estimateWrappedLineCount } from './structured-content-layout';
import { getDisplayText, getTextElementStyle, isDataFieldType } from './text-styles';

const FLOW_GAP_PX = LAYOUT_FLOW_GAP_PX;
const PUSH_TOLERANCE_PX = LAYOUT_PUSH_TOLERANCE_PX;

function estimateNeededFieldHeight(
  text: string,
  fontSize: number,
  width: number,
  props: Record<string, unknown>
): number {
  const showIcon = props.showIcon === true || props.addressHeaderMode === 'logo';
  const iconSize = showIcon ? Math.round(fontSize * 1.35) : 0;
  const iconGap = showIcon ? Math.max(4, Math.round(fontSize * 0.4)) : 0;
  const textBudget = Math.max(24, width - iconSize - iconGap);
  if (!text.trim()) return Math.max(iconSize, fontSize);
  const lines = estimateWrappedLineCount(text, fontSize, textBudget);
  return Math.max(iconSize, Math.ceil(lines * fontSize * 1.4));
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
      if (lower.visible === false || isPushBlockedChrome(lower)) continue;
      if (!shouldPushRelatedElement(upper, lower)) continue;
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

      for (let k = j + 1; k < sorted.length; k += 1) {
        const nextIndex = result.findIndex((el) => el.id === sorted[k].id);
        if (nextIndex < 0) continue;
        const next = result[nextIndex];
        if (next.visible === false || isPushBlockedChrome(next)) continue;
        if (!shouldPushRelatedElement(upper, next) && !shouldPushRelatedElement(lower, next)) {
          continue;
        }
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
  if (type === ComponentType.PAGE_NUMBER) return false;
  return true;
}

/**
 * Live-invoice field fitting only (not template preview).
 * - Authored `x` stays unless left-side logo forces a minimal inset
 * - May shrink width to clear logos/signatures/icons on the right
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
      const fontSize =
        typeof style.fontSize === 'number' && style.fontSize > 0 ? style.fontSize : 14;

      const clamped = clampFieldAgainstChrome(element, elements, pageRight);
      const nextX = clamped.x;
      const nextWidth = clamped.width;
      const widthChanged = nextX !== element.x || nextWidth !== element.width;

      const overflowPolicy = getElementOverflowPolicy(element);
      const neededHeight = estimateNeededFieldHeight(text, fontSize, nextWidth, props);
      const showIcon = props.showIcon === true || props.addressHeaderMode === 'logo';
      const iconSize = showIcon ? Math.round(fontSize * 1.35) : 0;
      const iconGap = showIcon ? Math.max(4, Math.round(fontSize * 0.4)) : 0;
      const textBudget = Math.max(24, nextWidth - iconSize - iconGap);
      const wrapLines = text.trim()
        ? estimateWrappedLineCount(text, fontSize, textBudget)
        : 0;
      const wantsGrow =
        overflowPolicy === 'wrapGrow'
        && (
          widthChanged
          || wrapLines > 1
          || text.includes('\n')
          || neededHeight > element.height + PUSH_TOLERANCE_PX
        );
      const nextHeight = wantsGrow
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
