import type { CanvasElement } from '@invogen/shared';

export interface PageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function normalizeMarquee(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): PageRect {
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  return {
    x,
    y,
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
}

export function rectsIntersect(a: PageRect, b: PageRect): boolean {
  return (
    a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y
  );
}

export function getElementPageRect(element: CanvasElement): PageRect {
  return {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };
}

/** Element ids whose bounds overlap the marquee rectangle. */
export function getElementsInMarquee(
  elements: CanvasElement[],
  marquee: PageRect
): string[] {
  if (marquee.width < 1 && marquee.height < 1) return [];
  return elements
    .filter((el) => rectsIntersect(marquee, getElementPageRect(el)))
    .map((el) => el.id);
}

export const MARQUEE_DRAG_THRESHOLD_PX = 4;
