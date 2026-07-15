import { ComponentType } from '@invogen/shared';
import type { CanvasElement } from '@invogen/shared';
import { estimateTextBlockHeight } from './structured-content-layout';
import { getTextRuns, type TextRunProps } from './text-styles';

/** Full plain text for a paginated text box (shared across page segments). */
export const PREVIEW_TEXT_CONTENT_KEY = '__previewTextContent';
/** Full rich runs for a paginated text box. */
export const PREVIEW_TEXT_RUNS_KEY = '__previewTextRuns';
export const PREVIEW_TEXT_RANGE_START_KEY = '__previewTextStart';
export const PREVIEW_TEXT_RANGE_END_KEY = '__previewTextEnd';
export const PREVIEW_TEXT_BOX_ID_KEY = '__previewTextBoxId';

const TEXT_PAGINATION_TYPES = new Set<string>([
  ComponentType.TEXT,
  ComponentType.HEADING,
  ComponentType.NOTES,
]);

/** Text / heading / notes — FOOTER stays document-pinned and is not split. */
export function isPaginatedTextBoxType(type: string): boolean {
  return TEXT_PAGINATION_TYPES.has(type);
}

export function resolvePlainTextContent(props: Record<string, unknown>): string {
  if (typeof props.content === 'string') return props.content;
  if (typeof props.text === 'string') return props.text;
  if (typeof props.value === 'string') return props.value;
  return '';
}

export function resolveFullTextContent(props: Record<string, unknown>): string {
  const stored = props[PREVIEW_TEXT_CONTENT_KEY];
  if (typeof stored === 'string') return stored;
  return resolvePlainTextContent(props);
}

export function resolveFullTextRuns(props: Record<string, unknown>): TextRunProps[] | null {
  const stored = props[PREVIEW_TEXT_RUNS_KEY];
  if (Array.isArray(stored) && stored.length > 0) {
    return stored.filter(
      (run) => run && typeof run === 'object' && typeof (run as TextRunProps).text === 'string'
    ) as TextRunProps[];
  }
  return getTextRuns(props);
}

export function resolvePaginationTextBoxId(
  props: Record<string, unknown>,
  elementId: string
): string {
  const stored = props[PREVIEW_TEXT_BOX_ID_KEY];
  if (typeof stored === 'string' && stored.length > 0) return stored;
  return elementId;
}

export function isTextContinuationSegment(props: Record<string, unknown>): boolean {
  const start = props[PREVIEW_TEXT_RANGE_START_KEY];
  return typeof start === 'number' && start > 0;
}

export function hasTextPaginationMeta(props: Record<string, unknown>): boolean {
  return (
    typeof props[PREVIEW_TEXT_CONTENT_KEY] === 'string'
    || typeof props[PREVIEW_TEXT_RANGE_START_KEY] === 'number'
    || typeof props[PREVIEW_TEXT_BOX_ID_KEY] === 'string'
  );
}

/** Prefer break at newline, then whitespace, else hard cut. */
export function findTextBreakBefore(content: string, index: number): number {
  if (index <= 0) return 0;
  if (index >= content.length) return content.length;
  if (content[index] === '\n' || /\s/.test(content[index])) return index;

  for (let i = index; i > 0; i -= 1) {
    if (content[i - 1] === '\n') return i;
  }
  for (let i = index; i > 0; i -= 1) {
    if (/\s/.test(content[i - 1])) return i;
  }
  return index;
}

export function sliceTextRuns(
  runs: TextRunProps[] | null | undefined,
  start: number,
  end: number
): TextRunProps[] | undefined {
  if (!runs || runs.length === 0) return undefined;
  if (start >= end) return undefined;

  const sliced: TextRunProps[] = [];
  let cursor = 0;
  for (const run of runs) {
    const runText = run.text ?? '';
    const runStart = cursor;
    const runEnd = cursor + runText.length;
    cursor = runEnd;
    if (runEnd <= start || runStart >= end) continue;
    const localStart = Math.max(0, start - runStart);
    const localEnd = Math.min(runText.length, end - runStart);
    if (localStart >= localEnd) continue;
    sliced.push({ ...run, text: runText.slice(localStart, localEnd) });
  }
  return sliced.length > 0 ? sliced : undefined;
}

/**
 * Largest character end index such that content[0..end) fits in availableHeight.
 * Returns rangeStart when nothing fits (spill whole box).
 */
export function findTextSplitEnd(
  type: string,
  props: Record<string, unknown>,
  fullContent: string,
  width: number,
  availableHeight: number,
  rangeStart = 0,
  rangeEnd = fullContent.length
): number {
  const windowLen = rangeEnd - rangeStart;
  if (windowLen <= 0) return rangeStart;

  const measure = (endExclusive: number) =>
    estimateTextBlockHeight(
      type,
      { ...props, content: fullContent.slice(rangeStart, endExclusive), textRuns: undefined },
      width
    );

  if (measure(rangeEnd) <= availableHeight) return rangeEnd;

  let best = rangeStart;
  let lo = rangeStart + 1;
  let hi = rangeEnd;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const breakAt = Math.max(rangeStart + 1, findTextBreakBefore(fullContent, mid));
    const capped = Math.min(breakAt, rangeEnd);
    if (capped <= rangeStart) {
      hi = mid - 1;
      continue;
    }
    if (measure(capped) <= availableHeight) {
      best = capped;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

export function textPropsForPageSegment(
  sourceProps: Record<string, unknown>,
  fullContent: string,
  fullRuns: TextRunProps[] | null,
  boxId: string,
  start: number,
  end: number
): Record<string, unknown> {
  const slice = fullContent.slice(start, end);
  const next: Record<string, unknown> = {
    ...sourceProps,
    content: slice,
    [PREVIEW_TEXT_CONTENT_KEY]: fullContent,
    [PREVIEW_TEXT_BOX_ID_KEY]: boxId,
    [PREVIEW_TEXT_RANGE_START_KEY]: start,
    [PREVIEW_TEXT_RANGE_END_KEY]: end,
  };
  if (fullRuns) {
    next[PREVIEW_TEXT_RUNS_KEY] = fullRuns;
    const sliced = sliceTextRuns(fullRuns, start, end);
    if (sliced) next.textRuns = sliced;
    else delete next.textRuns;
  } else {
    delete next[PREVIEW_TEXT_RUNS_KEY];
    delete next.textRuns;
  }
  return next;
}

/** Props used for on-canvas display (segment slice when paginated). */
export function resolvePaginatedTextDisplayProps(
  props: Record<string, unknown>
): Record<string, unknown> {
  if (!hasTextPaginationMeta(props)) return props;
  const full = resolveFullTextContent(props);
  const startRaw = props[PREVIEW_TEXT_RANGE_START_KEY];
  const endRaw = props[PREVIEW_TEXT_RANGE_END_KEY];
  if (typeof startRaw !== 'number' || typeof endRaw !== 'number') return props;
  const start = Math.max(0, Math.floor(startRaw));
  const end = Math.min(full.length, Math.floor(endRaw));
  if (start === 0 && end >= full.length) return props;

  const fullRuns = resolveFullTextRuns(props);
  const next: Record<string, unknown> = {
    ...props,
    content: full.slice(start, end),
  };
  const sliced = sliceTextRuns(fullRuns, start, end);
  if (sliced) next.textRuns = sliced;
  else delete next.textRuns;
  return next;
}

export function stripTextPaginationMeta(
  props: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...props };
  const full = resolveFullTextContent(props);
  const fullRuns = resolveFullTextRuns(props);
  next.content = full;
  if (fullRuns) next.textRuns = fullRuns;
  delete next[PREVIEW_TEXT_CONTENT_KEY];
  delete next[PREVIEW_TEXT_RUNS_KEY];
  delete next[PREVIEW_TEXT_RANGE_START_KEY];
  delete next[PREVIEW_TEXT_RANGE_END_KEY];
  delete next[PREVIEW_TEXT_BOX_ID_KEY];
  return next;
}

/**
 * After editing a segment's visible content, splice into the shared full string
 * and sync metadata onto every segment of the same text box.
 */
export function syncPaginatedTextContentAcrossSegments(
  pages: { elements: CanvasElement[] }[],
  boxId: string,
  editedElementId: string,
  nextSegmentContent: string,
  nextSegmentRuns?: TextRunProps[] | null
): { elements: CanvasElement[] }[] {
  let start = 0;
  let end = 0;
  let previousFull = '';

  for (const page of pages) {
    for (const element of page.elements) {
      if (element.id !== editedElementId) continue;
      const props = (element.props ?? {}) as Record<string, unknown>;
      previousFull = resolveFullTextContent(props);
      start =
        typeof props[PREVIEW_TEXT_RANGE_START_KEY] === 'number'
          ? (props[PREVIEW_TEXT_RANGE_START_KEY] as number)
          : 0;
      end =
        typeof props[PREVIEW_TEXT_RANGE_END_KEY] === 'number'
          ? (props[PREVIEW_TEXT_RANGE_END_KEY] as number)
          : previousFull.length;
    }
  }

  const fullContent =
    previousFull.slice(0, start) + nextSegmentContent + previousFull.slice(end);
  const delta = nextSegmentContent.length - (end - start);

  // Rebuild runs: prefer explicit next runs for the edited window when provided.
  let fullRuns: TextRunProps[] | null = null;
  for (const page of pages) {
    for (const element of page.elements) {
      if (
        resolvePaginationTextBoxId((element.props ?? {}) as Record<string, unknown>, element.id)
        === boxId
      ) {
        fullRuns = resolveFullTextRuns((element.props ?? {}) as Record<string, unknown>);
        break;
      }
    }
    if (fullRuns) break;
  }

  if (nextSegmentRuns && nextSegmentRuns.length > 0) {
    const before = sliceTextRuns(fullRuns, 0, start) ?? [];
    const after = sliceTextRuns(fullRuns, end, previousFull.length) ?? [];
    fullRuns = [...before, ...nextSegmentRuns, ...after];
  } else if (fullRuns) {
    const before = sliceTextRuns(fullRuns, 0, start) ?? [];
    const after = sliceTextRuns(fullRuns, end, previousFull.length) ?? [];
    fullRuns = [
      ...before,
      { text: nextSegmentContent },
      ...after,
    ];
  }

  return pages.map((page) => ({
    ...page,
    elements: page.elements.map((element) => {
      const props = (element.props ?? {}) as Record<string, unknown>;
      if (resolvePaginationTextBoxId(props, element.id) !== boxId) return element;

      let segStart =
        typeof props[PREVIEW_TEXT_RANGE_START_KEY] === 'number'
          ? (props[PREVIEW_TEXT_RANGE_START_KEY] as number)
          : 0;
      let segEnd =
        typeof props[PREVIEW_TEXT_RANGE_END_KEY] === 'number'
          ? (props[PREVIEW_TEXT_RANGE_END_KEY] as number)
          : previousFull.length;

      if (element.id === editedElementId) {
        segEnd = start + nextSegmentContent.length;
      } else if (segStart >= end) {
        segStart += delta;
        segEnd += delta;
      } else if (segEnd > start) {
        // Overlapping / preceding — clamp after splice; reflow will re-split.
        segEnd = Math.min(Math.max(segEnd + delta, segStart), fullContent.length);
      }

      segStart = Math.max(0, Math.min(segStart, fullContent.length));
      segEnd = Math.max(segStart, Math.min(segEnd, fullContent.length));

      return {
        ...element,
        props: textPropsForPageSegment(
          props,
          fullContent,
          fullRuns,
          boxId,
          segStart,
          segEnd
        ),
        height: estimateTextBlockHeight(
          element.type,
          { ...props, content: fullContent.slice(segStart, segEnd) },
          element.width
        ),
      };
    }),
  }));
}
