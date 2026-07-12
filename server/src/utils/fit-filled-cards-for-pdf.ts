import { ComponentType, type CanvasElement, type TemplatePage } from '@invogen/shared';

const FLOW_GAP_PX = 8;
const PUSH_TOLERANCE_PX = 2;
const ROW_Y_TOLERANCE_PX = 24;
const LINE_HEIGHT = 1.45;
const CARD_PADDING_PX = 8;

const CARD_TYPES = new Set<string>([
  ComponentType.COMPANY_CARD,
  ComponentType.CUSTOMER_CARD,
  ComponentType.PAYMENT_DETAILS,
]);

function clonePages(pages: TemplatePage[]): TemplatePage[] {
  return JSON.parse(JSON.stringify(pages)) as TemplatePage[];
}

function cardLineCount(type: string, props: Record<string, unknown>): number {
  const hidden = new Set(
    Array.isArray(props.hiddenFields)
      ? props.hiddenFields.filter((item): item is string => typeof item === 'string')
      : []
  );

  const fields =
    type === ComponentType.COMPANY_CARD
      ? ['title', 'name', 'address', 'gst', 'pan', 'email', 'phone']
      : type === ComponentType.CUSTOMER_CARD
        ? ['title', 'name', 'address', 'email', 'phone']
        : ['title', 'bankName', 'accountName', 'accountNumber', 'ifsc', 'upi'];

  let lines = 0;
  for (const key of fields) {
    if (hidden.has(key)) continue;
    const raw = props[key];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    if (key === 'address') {
      lines += raw.split('\n').filter((line) => line.trim()).length || 1;
    } else {
      lines += 1;
    }
  }

  const custom = Array.isArray(props.customFields) ? props.customFields : [];
  for (const field of custom) {
    if (!field || typeof field !== 'object') continue;
    const row = field as { id?: string; label?: string; value?: string };
    if (row.id && hidden.has(row.id)) continue;
    if ((row.label || row.value || '').trim()) lines += 1;
  }

  return lines;
}

function estimateCardHeight(element: CanvasElement): number {
  const props = (element.props ?? {}) as Record<string, unknown>;
  const lines = cardLineCount(element.type, props);
  if (lines <= 0) return element.height;
  const fontSize = typeof props.fontSize === 'number' && props.fontSize > 0 ? props.fontSize : 12;
  return Math.max(element.height, Math.ceil(lines * fontSize * LINE_HEIGHT + CARD_PADDING_PX));
}

function isPinned(element: CanvasElement): boolean {
  if (element.type === ComponentType.WATERMARK) return true;
  // Keep decorative IMAGE/STAMP (e.g. Delhivery watermark) at authored position.
  if (element.type === ComponentType.IMAGE || element.type === ComponentType.STAMP) return true;
  return false;
}

function isStackedBelow(anchor: CanvasElement, element: CanvasElement): boolean {
  if (element.id === anchor.id || element.visible === false || isPinned(element)) return false;
  const anchorBottom = anchor.y + anchor.height;
  if (Math.abs(element.y - anchor.y) <= ROW_Y_TOLERANCE_PX) return false;
  const overlaps =
    element.y < anchorBottom - PUSH_TOLERANCE_PX
    && element.y + element.height > anchor.y + PUSH_TOLERANCE_PX;
  if (overlaps) return true;
  if (element.y + element.height <= anchor.y + PUSH_TOLERANCE_PX) return false;
  return element.y >= anchorBottom - ROW_Y_TOLERANCE_PX;
}

function groupRows(elements: CanvasElement[]): CanvasElement[][] {
  if (elements.length === 0) return [];
  const sorted = [...elements].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: CanvasElement[][] = [];
  let current: CanvasElement[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const el = sorted[i];
    if (Math.abs(el.y - current[0].y) <= ROW_Y_TOLERANCE_PX) current.push(el);
    else {
      rows.push(current);
      current = [el];
    }
  }
  rows.push(current);
  return rows;
}

function pushBelow(elements: CanvasElement[], anchorIndex: number): CanvasElement[] {
  const anchor = elements[anchorIndex];
  const anchorBottom = anchor.y + anchor.height;
  const minY = anchorBottom + FLOW_GAP_PX;
  const below = elements.filter((el) => isStackedBelow(anchor, el));
  if (below.length === 0) return elements;

  let result = [...elements];
  for (const row of groupRows(below)) {
    const rowTop = Math.min(...row.map((el) => el.y));
    const overlaps = row.some(
      (el) =>
        el.y < anchorBottom - PUSH_TOLERANCE_PX
        && el.y + el.height > anchor.y + PUSH_TOLERANCE_PX
    );
    if (!overlaps && rowTop >= minY - PUSH_TOLERANCE_PX) continue;
    const delta = minY - rowTop;
    if (Math.abs(delta) <= PUSH_TOLERANCE_PX) continue;
    for (const el of row) {
      const idx = result.findIndex((item) => item.id === el.id);
      if (idx >= 0) result[idx] = { ...result[idx], y: result[idx].y + delta };
    }
  }
  return result;
}

/**
 * Grow filled cards and push divider / invoice fields / table down so PDF HTML
 * matches the live-preview structure (no overlapping phone/divider).
 */
export function fitFilledCardsForPdf(pages: TemplatePage[]): TemplatePage[] {
  if (pages.length === 0) return pages;
  const next = clonePages(pages);

  for (const page of next) {
    let elements = [...page.elements];
    const cards = elements
      .filter((el) => el.visible !== false && CARD_TYPES.has(el.type))
      .sort((a, b) => a.y - b.y || a.x - b.x);

    for (const card of cards) {
      const index = elements.findIndex((el) => el.id === card.id);
      if (index < 0) continue;
      const current = elements[index];
      const height = estimateCardHeight(current);
      if (height > current.height + PUSH_TOLERANCE_PX) {
        elements[index] = { ...current, height };
      }
      elements = pushBelow(elements, index);
    }

    page.elements = elements;
  }

  return next;
}
