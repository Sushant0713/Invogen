import type { TemplatePage } from '@invogen/shared';

export const PREVIEW_ELEMENT_ID_ATTR = 'data-preview-element-id';

declare global {
  interface Window {
    /** Set to true in the console to log preview layout parity diagnostics. */
    __INVOGEN_LAYOUT_DEBUG?: boolean;
  }
}

export function isLayoutDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__INVOGEN_LAYOUT_DEBUG === true) return true;
  // Survives reloads: localStorage.setItem('invogen-layout-debug', '1')
  try {
    return window.localStorage?.getItem('invogen-layout-debug') === '1';
  } catch {
    return false;
  }
}

/**
 * Geometry fingerprint of laid-out pages — page membership plus rounded
 * rects per element. Two layouts with equal signatures render identically.
 */
export function pagesGeometrySignature(pages: TemplatePage[]): string {
  return pages
    .map((page) =>
      page.elements
        .filter((el) => el.visible !== false)
        .map(
          (el) =>
            `${el.id}:${Math.round(el.x)},${Math.round(el.y)},${Math.round(el.width)},${Math.round(el.height)}`
        )
        .sort()
        .join('|')
    )
    .join('||');
}

/**
 * Dev assertion: a layout function applied to its own output must be a no-op.
 * Logs the first divergent elements when it is not. Enable with
 * `window.__INVOGEN_LAYOUT_DEBUG = true`.
 */
export function assertLayoutIdempotent(
  label: string,
  output: TemplatePage[],
  relayout: (pages: TemplatePage[]) => TemplatePage[]
): void {
  if (!isLayoutDebugEnabled()) return;
  const second = relayout(output);
  if (pagesGeometrySignature(second) === pagesGeometrySignature(output)) {
    console.info(`[layout-idempotency] ${label}: stable ✓`);
    return;
  }
  const firstRects = new Map(
    output.flatMap((p, pi) =>
      p.elements.map((el) => [el.id, { page: pi, y: Math.round(el.y), h: Math.round(el.height) }])
    )
  );
  const moved: Array<{ id: string; from: string; to: string }> = [];
  second.forEach((p, pi) => {
    for (const el of p.elements) {
      const prev = firstRects.get(el.id);
      const now = { page: pi, y: Math.round(el.y), h: Math.round(el.height) };
      if (!prev || prev.page !== now.page || Math.abs(prev.y - now.y) > 2 || Math.abs(prev.h - now.h) > 2) {
        moved.push({
          id: el.id.slice(0, 8),
          from: prev ? `p${prev.page + 1} y${prev.y} h${prev.h}` : 'missing',
          to: `p${now.page + 1} y${now.y} h${now.h}`,
        });
      }
    }
  });
  console.groupCollapsed(
    `[layout-idempotency] ${label}: NOT idempotent — ${moved.length} element(s) moved on re-layout`
  );
  console.table(moved.slice(0, 20));
  console.groupEnd();
  (window as Window & { __lastIdempotencyDiff?: unknown }).__lastIdempotencyDiff = moved;
}

interface ParityRow {
  page: number;
  id: string;
  type: string;
  slotH: number;
  contentH: number;
  deltaH: number;
}

interface OverlapRow {
  page: number;
  a: string;
  b: string;
  overlapX: number;
  overlapY: number;
}

/**
 * Compare layout-computed element heights against the rendered DOM, and flag
 * box overlaps the layout engine let through. Enable from the console with
 * `window.__INVOGEN_LAYOUT_DEBUG = true`, then interact with the preview.
 */
export function logLayoutParity(container: HTMLElement | null, pages: TemplatePage[]): void {
  if (!isLayoutDebugEnabled() || !container) return;

  // Shapes/dividers render oversized interactive internals — scrollHeight is
  // not ink height for them, so the drift metric would false-positive.
  const nonInkTypes = new Set([
    'line',
    'divider',
    'rectangle',
    'rounded_rect',
    'circle',
    'triangle',
    'shape',
  ]);

  const mismatches: ParityRow[] = [];
  pages.forEach((page, pageIndex) => {
    for (const element of page.elements) {
      if (element.visible === false) continue;
      if (nonInkTypes.has(String(element.type))) continue;
      const node = container.querySelector<HTMLElement>(
        `[${PREVIEW_ELEMENT_ID_ATTR}="${element.id}"]`
      );
      if (!node) continue;
      // scrollHeight is unaffected by ancestor transform scale — compares in page px.
      const contentH = node.scrollHeight;
      const deltaH = contentH - Math.round(element.height);
      if (Math.abs(deltaH) > 3) {
        mismatches.push({
          page: pageIndex + 1,
          id: element.id,
          type: element.type,
          slotH: Math.round(element.height),
          contentH,
          deltaH,
        });
      }
    }
  });

  const overlaps: OverlapRow[] = [];
  pages.forEach((page, pageIndex) => {
    const visible = page.elements.filter((el) => el.visible !== false);
    for (let i = 0; i < visible.length; i += 1) {
      for (let j = i + 1; j < visible.length; j += 1) {
        const a = visible[i];
        const b = visible[j];
        const overlapX =
          Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY =
          Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (overlapX > 2 && overlapY > 2) {
          overlaps.push({
            page: pageIndex + 1,
            a: `${a.type}#${a.id.slice(0, 8)}`,
            b: `${b.type}#${b.id.slice(0, 8)}`,
            overlapX: Math.round(overlapX),
            overlapY: Math.round(overlapY),
          });
        }
      }
    }
  });

  if (mismatches.length) {
    console.groupCollapsed(
      `[layout-parity] ${mismatches.length} element(s) render taller/shorter than layout height`
    );
    console.table(mismatches.sort((a, b) => Math.abs(b.deltaH) - Math.abs(a.deltaH)));
    console.groupEnd();
  }
  if (overlaps.length) {
    console.groupCollapsed(`[layout-parity] ${overlaps.length} box overlap(s) on preview pages`);
    console.table(overlaps);
    console.groupEnd();
  }
  if (!mismatches.length && !overlaps.length) {
    console.info('[layout-parity] preview matches layout geometry (no drift > 3px)');
  }
}
