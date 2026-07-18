/**
 * Single Measurement Authority for text layout.
 *
 * Preview reflow previously estimated wrapped line counts with an average
 * char-width heuristic (fontSize * 0.52), which ignored font family, weight
 * and word boundaries — so preview heights drifted from the builder's
 * DOM-measured heights. This module measures with canvas `measureText` using
 * the element's real computed font, and reproduces the browser's greedy line
 * breaker for `white-space: pre-wrap; word-break: break-word` content.
 *
 * All estimators (structured blocks, data fields, table cells, cards) must go
 * through here so builder, live preview, and PDF export agree on geometry.
 */

export interface MeasureFont {
  /** Full CSS family list, e.g. `"Inter", sans-serif`. */
  fontFamily?: string;
  fontSize: number;
  fontWeight?: number;
  italic?: boolean;
  letterSpacingPx?: number;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx !== undefined) return measureCtx;
  if (typeof document === 'undefined') {
    measureCtx = null;
    return measureCtx;
  }
  try {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
  } catch {
    measureCtx = null;
  }
  return measureCtx;
}

export function canMeasureText(): boolean {
  return getMeasureContext() !== null;
}

/**
 * Bumped whenever a web font finishes loading — cached measurements taken with
 * a fallback font become stale and must be recomputed.
 */
let fontsVersion = 0;
const fontsChangeListeners = new Set<() => void>();
let fontsListenerAttached = false;

function attachFontsListener() {
  if (fontsListenerAttached) return;
  fontsListenerAttached = true;
  if (typeof document === 'undefined' || !document.fonts?.addEventListener) return;
  document.fonts.addEventListener('loadingdone', () => {
    fontsVersion += 1;
    widthCache.clear();
    lineCountCache.clear();
    for (const listener of fontsChangeListeners) listener();
  });
}

export function getFontsVersion(): number {
  attachFontsListener();
  return fontsVersion;
}

/** Subscribe to web-font arrivals (for re-running layout). Returns unsubscribe. */
export function subscribeFontsChange(listener: () => void): () => void {
  attachFontsListener();
  fontsChangeListeners.add(listener);
  return () => fontsChangeListeners.delete(listener);
}

function fontCssString(font: MeasureFont): string {
  const family = font.fontFamily?.trim() || '"Inter", sans-serif';
  const weight = font.fontWeight ?? 400;
  const style = font.italic ? 'italic ' : '';
  return `${style}${weight} ${font.fontSize}px ${family}`;
}

const CACHE_LIMIT = 20000;
const widthCache = new Map<string, number>();
const lineCountCache = new Map<string, number>();

function cacheSet(cache: Map<string, number>, key: string, value: number) {
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, value);
}

let letterSpacingSupported: boolean | undefined;

function applyFont(ctx: CanvasRenderingContext2D, font: MeasureFont): boolean {
  ctx.font = fontCssString(font);
  const spacing = font.letterSpacingPx ?? 0;
  if (letterSpacingSupported === undefined) {
    letterSpacingSupported = 'letterSpacing' in ctx;
  }
  if (letterSpacingSupported) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      spacing ? `${spacing}px` : '0px';
    return true;
  }
  return spacing === 0;
}

function rawTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: MeasureFont,
  spacingHandled: boolean
): number {
  let width = ctx.measureText(text).width;
  if (!spacingHandled && font.letterSpacingPx) {
    width += font.letterSpacingPx * text.length;
  }
  return width;
}

/** Rendered single-line width of `text` in the given font (px). */
export function measureTextWidth(text: string, font: MeasureFont): number {
  const ctx = getMeasureContext();
  if (!ctx || !text) {
    // Legacy heuristic fallback (SSR / tests / canvas-blocked browsers).
    return text.length * font.fontSize * 0.55;
  }
  const key = `${fontsVersion}|${fontCssString(font)}|${font.letterSpacingPx ?? 0}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  const spacingHandled = applyFont(ctx, font);
  const width = rawTextWidth(ctx, text, font, spacingHandled);
  cacheSet(widthCache, key, width);
  return width;
}

/** Legacy char-count wrap model — kept as the non-browser fallback. */
function heuristicWrappedLineCount(text: string, fontSize: number, width: number): number {
  if (!text) return 0;
  const avgCharWidth = fontSize * 0.52;
  const charsPerLine = Math.max(8, Math.floor(width / avgCharWidth));
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    const len = paragraph.length;
    lines += len ? Math.ceil(len / charsPerLine) : 1;
  }
  return Math.max(1, lines);
}

/**
 * Break one over-wide word the way `word-break: break-word` does: fill the
 * remaining space on the current line, then split by characters.
 * Returns lines added and the trailing line width.
 */
function breakLongWord(
  ctx: CanvasRenderingContext2D,
  word: string,
  font: MeasureFont,
  spacingHandled: boolean,
  maxWidth: number,
  startLineWidth: number
): { addedLines: number; lineWidth: number } {
  let addedLines = 0;
  let lineWidth = startLineWidth;
  let index = 0;
  while (index < word.length) {
    const char = word[index];
    const charWidth = rawTextWidth(ctx, char, font, spacingHandled);
    if (lineWidth > 0 && lineWidth + charWidth > maxWidth) {
      addedLines += 1;
      lineWidth = 0;
      continue;
    }
    lineWidth += charWidth;
    index += 1;
  }
  return { addedLines, lineWidth };
}

/**
 * Wrapped line count for `text` rendered at `widthPx` with
 * `white-space: pre-wrap; word-break: break-word` — the styling used by all
 * builder/preview text surfaces. Greedy breaker identical to the browser's.
 */
export function countWrappedLines(text: string, font: MeasureFont, widthPx: number): number {
  if (!text) return 0;
  const ctx = getMeasureContext();
  if (!ctx || widthPx <= 0 || font.fontSize <= 0) {
    return heuristicWrappedLineCount(text, font.fontSize, Math.max(1, widthPx));
  }

  const key = `${fontsVersion}|${fontCssString(font)}|${font.letterSpacingPx ?? 0}|${Math.round(widthPx)}|${text}`;
  const cached = lineCountCache.get(key);
  if (cached !== undefined) return cached;

  const spacingHandled = applyFont(ctx, font);
  let total = 0;

  for (const paragraph of text.split('\n')) {
    if (!paragraph) {
      total += 1;
      continue;
    }
    let lines = 1;
    let lineWidth = 0;
    // pre-wrap preserves whitespace runs; keep them as wrappable tokens.
    const tokens = paragraph.split(/(\s+)/);
    for (const token of tokens) {
      if (!token) continue;
      const tokenWidth = rawTextWidth(ctx, token, font, spacingHandled);
      if (lineWidth + tokenWidth <= widthPx) {
        lineWidth += tokenWidth;
        continue;
      }
      if (/^\s+$/.test(token)) {
        // Overflowing whitespace wraps without carrying onto the next line.
        lines += 1;
        lineWidth = 0;
        continue;
      }
      if (tokenWidth <= widthPx) {
        lines += 1;
        lineWidth = tokenWidth;
        continue;
      }
      const broken = breakLongWord(ctx, token, font, spacingHandled, widthPx, lineWidth);
      lines += broken.addedLines;
      lineWidth = broken.lineWidth;
    }
    total += lines;
  }

  const result = Math.max(1, total);
  cacheSet(lineCountCache, key, result);
  return result;
}
