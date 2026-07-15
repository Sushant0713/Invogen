import type { CanvasElement } from '@invogen/shared';
import {
  PREVIEW_PAGINATION_RANGE_END_KEY,
  PREVIEW_PAGINATION_RANGE_START_KEY,
  PREVIEW_PAGINATION_ROWS_KEY,
  PREVIEW_PAGINATION_SHOW_TOTALS_KEY,
  PREVIEW_PAGINATION_TABLE_ID_KEY,
  isTableElementType,
} from './product-table';
import {
  isPaginatedTextBoxType,
  stripTextPaginationMeta,
} from './text-box-pagination';

const CLIPBOARD_KEY = 'invogen-builder-clipboard-v1';

export type BuilderClipboardPayload = {
  version: 1;
  copiedAt: number;
  elements: CanvasElement[];
};

export function writeBuilderClipboard(elements: CanvasElement[]): void {
  if (elements.length === 0) return;
  const payload: BuilderClipboardPayload = {
    version: 1,
    copiedAt: Date.now(),
    elements: JSON.parse(JSON.stringify(elements)) as CanvasElement[],
  };
  try {
    // localStorage survives SPA navigations between templates in the same browser.
    localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(payload));
  } catch {
    try {
      sessionStorage.setItem(CLIPBOARD_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota / private mode */
    }
  }
}

export function readBuilderClipboard(): CanvasElement[] {
  const raw =
    (() => {
      try {
        return localStorage.getItem(CLIPBOARD_KEY);
      } catch {
        return null;
      }
    })()
    ?? (() => {
      try {
        return sessionStorage.getItem(CLIPBOARD_KEY);
      } catch {
        return null;
      }
    })();

  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as BuilderClipboardPayload | CanvasElement;
    if (
      parsed
      && typeof parsed === 'object'
      && 'version' in parsed
      && Array.isArray((parsed as BuilderClipboardPayload).elements)
    ) {
      return (parsed as BuilderClipboardPayload).elements;
    }
    // Legacy single-element clipboard from earlier Ctrl+C.
    if (parsed && typeof parsed === 'object' && 'id' in parsed && 'type' in parsed) {
      return [parsed as CanvasElement];
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function hasBuilderClipboard(): boolean {
  return readBuilderClipboard().length > 0;
}

/** Tables/text become standalone on paste — drop cross-page pagination segment metadata. */
export function sanitizeClipboardElementForPaste(element: CanvasElement): CanvasElement {
  const next = JSON.parse(JSON.stringify(element)) as CanvasElement;
  next.locked = false;
  if (!next.props) return next;

  if (isPaginatedTextBoxType(next.type)) {
    next.props = stripTextPaginationMeta({ ...(next.props as Record<string, unknown>) });
    return next;
  }

  if (!isTableElementType(next.type)) return next;

  const props = { ...(next.props as Record<string, unknown>) };
  const showTotals = props[PREVIEW_PAGINATION_SHOW_TOTALS_KEY];
  delete props[PREVIEW_PAGINATION_ROWS_KEY];
  delete props[PREVIEW_PAGINATION_RANGE_START_KEY];
  delete props[PREVIEW_PAGINATION_RANGE_END_KEY];
  delete props[PREVIEW_PAGINATION_TABLE_ID_KEY];
  if (typeof showTotals === 'boolean') {
    if (showTotals) {
      props.showGrandTotalFooter = true;
      props.showTotalFooter = true;
      props.showSummaryTable = true;
    }
  }
  next.props = props;
  return next;
}
