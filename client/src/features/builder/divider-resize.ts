import { ComponentType } from '@invogen/shared';
import type { PageMargins } from './builder-dnd';
import type { ElementBounds, ResizeSession } from './element-resize';
import {
  clampAnchoredBounds,
  computeAnchoredResize,
  parseResizeDirection,
  snapAnchoredBounds,
} from './element-resize';

export const DIVIDER_MIN_LENGTH = 24;
export const DIVIDER_MIN_CROSS = 6;
export const DIVIDER_CROSS_HEIGHT = 12;

export type DividerEdgeHandle = 'left' | 'right';

export function isDividerElementType(type: string): boolean {
  return type === ComponentType.DIVIDER;
}

export function clampDividerBounds(bounds: ElementBounds): ElementBounds {
  return {
    ...bounds,
    width: Math.max(DIVIDER_MIN_LENGTH, bounds.width),
    height: Math.max(DIVIDER_MIN_CROSS, bounds.height),
  };
}

/** Unrotated box from canvas center (divider line rotates inside via SVG). */
export function dividerBoundsFromCenter(
  centerX: number,
  centerY: number,
  width: number,
  height: number
): ElementBounds {
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

export function getOppositeDividerEdge(edge: DividerEdgeHandle): DividerEdgeHandle {
  return edge === 'left' ? 'right' : 'left';
}

/** Midpoint of the left or right edge in canvas coordinates (after rotation). */
export function getDividerEdgeWorldPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  rotationDeg: number,
  edge: DividerEdgeHandle
): { x: number; y: number } {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const localX = edge === 'left' ? -width / 2 : width / 2;
  const rad = (rotationDeg * Math.PI) / 180;
  return {
    x: cx + localX * Math.cos(rad),
    y: cy + localX * Math.sin(rad),
  };
}

/** Resize line length by dragging a left/right edge; opposite edge stays fixed. */
export function computeDividerEdgeResize(
  dragEdge: DividerEdgeHandle,
  anchorWorld: { x: number; y: number },
  pointerWorld: { x: number; y: number },
  rotationDeg: number,
  crossHeight: number
): ElementBounds {
  const rad = (rotationDeg * Math.PI) / 180;
  const axisX = { x: Math.cos(rad), y: Math.sin(rad) };
  const vx = pointerWorld.x - anchorWorld.x;
  const vy = pointerWorld.y - anchorWorld.y;
  const projected = vx * axisX.x + vy * axisX.y;
  const width = Math.max(
    DIVIDER_MIN_LENGTH,
    dragEdge === 'right' ? projected : -projected
  );
  const height = crossHeight;

  const draggedEdgeCenter =
    dragEdge === 'right'
      ? {
          x: anchorWorld.x + width * axisX.x,
          y: anchorWorld.y + width * axisX.y,
        }
      : {
          x: anchorWorld.x - width * axisX.x,
          y: anchorWorld.y - width * axisX.y,
        };

  const centerX = (anchorWorld.x + draggedEdgeCenter.x) / 2;
  const centerY = (anchorWorld.y + draggedEdgeCenter.y) / 2;

  return dividerBoundsFromCenter(centerX, centerY, width, height);
}

export function getDividerEdgeResizeCursor(rotationDeg: number): string {
  const angle = ((rotationDeg % 180) + 180) % 180;
  if (angle < 22.5 || angle >= 157.5) return 'ew-resize';
  if (angle < 67.5) return 'nwse-resize';
  if (angle < 112.5) return 'ns-resize';
  return 'nesw-resize';
}

/**
 * Divider resize rules (rotation 0, Rnd handles):
 * - Left/right edges change line length (width).
 * - Top/bottom edges change hit thickness (height).
 * - Corners change line length only; cross thickness stays fixed.
 */
export function computeDividerAnchoredResize(
  session: ResizeSession,
  direction: string,
  position: { x: number; y: number },
  size: { width: number; height: number }
): ElementBounds {
  const axis = parseResizeDirection(direction);
  const horizontalOnly = (axis.left || axis.right) && !axis.top && !axis.bottom;
  const verticalOnly = (axis.top || axis.bottom) && !axis.left && !axis.right;

  if (horizontalOnly) {
    return clampDividerBounds(
      computeAnchoredResize(session, direction, position, size, DIVIDER_MIN_LENGTH)
    );
  }

  if (verticalOnly) {
    return clampDividerBounds(
      computeAnchoredResize(session, direction, position, size, DIVIDER_MIN_CROSS)
    );
  }

  const horizontalDir = axis.left ? 'left' : 'right';
  const lengthBounds = computeAnchoredResize(
    session,
    horizontalDir,
    position,
    size,
    DIVIDER_MIN_LENGTH
  );

  return {
    x: lengthBounds.x,
    y: session.startY,
    width: lengthBounds.width,
    height: Math.max(DIVIDER_MIN_CROSS, session.startH),
  };
}

export function finalizeDividerAnchoredResize(
  session: ResizeSession,
  direction: string,
  position: { x: number; y: number },
  size: { width: number; height: number },
  margins: PageMargins,
  snapToGrid: boolean,
  gridSize: number
): ElementBounds {
  const raw = computeDividerAnchoredResize(session, direction, position, size);
  const clamped = clampAnchoredBounds(
    raw,
    session,
    direction,
    margins,
    DIVIDER_MIN_CROSS
  );
  const snapped = snapAnchoredBounds(
    clamped,
    session,
    direction,
    margins,
    snapToGrid,
    gridSize,
    DIVIDER_MIN_CROSS
  );
  return clampDividerBounds(snapped);
}
