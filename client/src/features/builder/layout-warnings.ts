import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { getPageDimensions } from './builder-dnd';
import {
  contentRectsCollide,
  estimateContentBounds,
  isLayoutFixedChrome,
} from './layout-policy';
import {
  getElementCollisionPolicy,
  getElementOverflowPolicy,
} from './layout-intent';
import { getDisplayText, getTextElementStyle, isDataFieldType } from './text-styles';
import { estimateWrappedLineCount, measureFontFromProps } from './structured-content-layout';
import { isTableElementType } from './product-table';

export type LayoutWarningKind =
  | 'text_overflow'
  | 'ink_collision'
  | 'outside_margins'
  | 'footer_risk';

export type LayoutWarning = {
  id: string;
  elementId: string;
  kind: LayoutWarningKind;
  message: string;
};

const LONG_STRESS: Record<string, string> = {
  CompanyName: 'Blue Dart Express Logistics Private Limited Worldwide Services Division',
  CustomerName: 'Acme International Trading & Manufacturing Corporation Pvt Ltd',
  Email: 'operations.billing.accounts@verylongdomain-example.co.in',
  Phone: '+91 98765 43210 Ext 1234',
  CompanyPhone: '+91 22 4000 1234 / +91 22 4000 5678',
  CompanyEmail: 'corporate.communications@bluedart-example.com',
  GSTIN: '27AABCU9603R1ZM',
  BillingAddress:
    'Warehouse Complex B-42, Mittal Industrial Estate, Andheri East, Mumbai, Maharashtra 400059, India',
};

/** Apply long-data stress strings onto field values (preview-only clone). */
export function applyStressDataToElements(elements: CanvasElement[]): CanvasElement[] {
  return elements.map((element) => {
    if (!isDataFieldType(element.type) && element.type !== ComponentType.ADDRESS) {
      return element;
    }
    const props = { ...(element.props ?? {}) } as Record<string, unknown>;
    const dataKey = typeof props.dataKey === 'string' ? props.dataKey : '';
    const stress = dataKey ? LONG_STRESS[dataKey] : undefined;
    if (stress) {
      return { ...element, props: { ...props, value: stress } };
    }
    if (typeof props.value === 'string' && props.value.length < 12 && element.type === ComponentType.FIELD) {
      return {
        ...element,
        props: {
          ...props,
          value: `${props.value} — extended live invoice sample value for stress testing`,
        },
      };
    }
    return element;
  });
}

function fieldNeedsMoreHeight(element: CanvasElement): boolean {
  if (!isDataFieldType(element.type)) return false;
  const policy = getElementOverflowPolicy(element);
  if (policy === 'clip') return false;
  const props = (element.props ?? {}) as Record<string, unknown>;
  const text = getDisplayText(props, element.type);
  const style = getTextElementStyle(props, element.type);
  const fontSize =
    typeof style.fontSize === 'number' && style.fontSize > 0 ? style.fontSize : 14;
  const showIcon = props.showIcon === true || props.addressHeaderMode === 'logo';
  const iconSize = showIcon ? Math.round(fontSize * 1.35) : 0;
  const iconGap = showIcon ? Math.max(4, Math.round(fontSize * 0.4)) : 0;
  const budget = Math.max(24, element.width - iconSize - iconGap);
  const font = { ...measureFontFromProps(props, element.type), fontSize };
  const lines = estimateWrappedLineCount(text, fontSize, budget, font);
  const needed = Math.max(iconSize, Math.ceil(lines * fontSize * 1.4));
  return needed > element.height + 2;
}

/**
 * Detect design risks on a page without mutating geometry.
 * Pass stress=true to evaluate with long sample field values.
 */
export function detectLayoutWarnings(
  page: TemplatePage,
  options: { stress?: boolean } = {}
): LayoutWarning[] {
  const { width: pageWidth, height: pageHeight } = getPageDimensions(page);
  const elements = options.stress
    ? applyStressDataToElements(page.elements)
    : page.elements.map((el) => ({ ...el }));
  const warnings: LayoutWarning[] = [];
  const visible = elements.filter((el) => el.visible !== false);

  for (const element of visible) {
    if (
      element.x < page.margins.left - 1
      || element.y < page.margins.top - 1
      || element.x + element.width > pageWidth - page.margins.right + 1
      || element.y + element.height > pageHeight - page.margins.bottom + 1
    ) {
      warnings.push({
        id: `${element.id}:outside_margins`,
        elementId: element.id,
        kind: 'outside_margins',
        message: 'Extends outside page margins.',
      });
    }

    if (fieldNeedsMoreHeight(element)) {
      const policy = getElementOverflowPolicy(element);
      warnings.push({
        id: `${element.id}:text_overflow`,
        elementId: element.id,
        kind: 'text_overflow',
        message:
          policy === 'wrap'
            ? 'Long live text will wrap and may clip inside this box.'
            : 'Long live text needs more height than this box provides.',
      });
    }
  }

  for (let i = 0; i < visible.length; i += 1) {
    for (let j = i + 1; j < visible.length; j += 1) {
      const a = visible[i];
      const b = visible[j];
      if (isLayoutFixedChrome(a) && isLayoutFixedChrome(b)) continue;
      if (isTableElementType(a.type) || isTableElementType(b.type)) continue;
      if (!contentRectsCollide(a, b)) continue;

      const aAllow =
        getElementCollisionPolicy(a) === 'allowOverlap'
        || getElementCollisionPolicy(a) === 'warnOnly';
      const bAllow =
        getElementCollisionPolicy(b) === 'allowOverlap'
        || getElementCollisionPolicy(b) === 'warnOnly';

      // Intentional allow: still warn in stress mode so designers see ink risk.
      if ((aAllow || bAllow) && !options.stress) continue;

      const aInk = estimateContentBounds(a);
      const bInk = estimateContentBounds(b);
      if (aInk.width <= 0 || bInk.width <= 0) continue;

      warnings.push({
        id: `${a.id}:${b.id}:ink_collision`,
        elementId: a.id,
        kind: 'ink_collision',
        message: options.stress
          ? 'Long live data causes content to overlap another component.'
          : 'Content overlaps another component.',
      });
    }
  }

  return warnings;
}
