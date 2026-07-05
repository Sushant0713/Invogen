import type { PageMargins } from './builder-dnd';
import { PAGE_HEIGHT, PAGE_WIDTH } from './builder-dnd';

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeSession {
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

export interface ResizeAxis {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

/** Parse react-rnd direction into which edges are being dragged. */
export function parseResizeDirection(direction: string): ResizeAxis {
  const d = direction.toLowerCase();
  return {
    left: d === 'left' || d === 'topleft' || d === 'bottomleft',
    right: d === 'right' || d === 'topright' || d === 'bottomright',
    top: d === 'top' || d === 'topleft' || d === 'topright',
    bottom: d === 'bottom' || d === 'bottomleft' || d === 'bottomright',
  };
}

/**
 * Opposite edge/corner stays fixed (Figma / Canva / Photoshop).
 *
 * Edge-only rules:
 * - Left:   width + x change; right edge fixed
 * - Right:  width changes;    left edge fixed
 * - Top:    height + y change; bottom edge fixed
 * - Bottom: height changes;    top edge fixed
 */
export function computeAnchoredResize(
  session: ResizeSession,
  direction: string,
  position: { x: number; y: number },
  size: { width: number; height: number },
  minSize: number
): ElementBounds {
  const axis = parseResizeDirection(direction);
  const anchorRight = session.startX + session.startW;
  const anchorBottom = session.startY + session.startH;

  let x = session.startX;
  let y = session.startY;
  let width = session.startW;
  let height = session.startH;

  const horizontalOnly = (axis.left || axis.right) && !axis.top && !axis.bottom;
  const verticalOnly = (axis.top || axis.bottom) && !axis.left && !axis.right;

  if (axis.left && !axis.right) {
    width = Math.max(minSize, anchorRight - position.x);
    x = anchorRight - width;
  } else if (axis.right && !axis.left) {
    width = Math.max(minSize, size.width);
    x = session.startX;
  }

  if (axis.top && !axis.bottom) {
    height = Math.max(minSize, anchorBottom - position.y);
    y = anchorBottom - height;
  } else if (axis.bottom && !axis.top) {
    height = Math.max(minSize, size.height);
    y = session.startY;
  }

  if (horizontalOnly) {
    y = session.startY;
    height = session.startH;
  }
  if (verticalOnly) {
    x = session.startX;
    width = session.startW;
  }

  return { x, y, width, height };
}

/** Clamp to page margins while keeping the anchored edge/corner fixed. */
export function clampAnchoredBounds(
  bounds: ElementBounds,
  session: ResizeSession,
  direction: string,
  margins: PageMargins,
  minSize: number
): ElementBounds {
  const axis = parseResizeDirection(direction);
  const anchorRight = session.startX + session.startW;
  const anchorBottom = session.startY + session.startH;

  let { x, y, width, height } = bounds;

  width = Math.max(minSize, width);
  height = Math.max(minSize, height);

  const horizontalOnly = (axis.left || axis.right) && !axis.top && !axis.bottom;
  const verticalOnly = (axis.top || axis.bottom) && !axis.left && !axis.right;

  if (axis.left && !axis.right) {
    x = anchorRight - width;
  } else if (axis.right && !axis.left) {
    x = session.startX;
  }

  if (axis.top && !axis.bottom) {
    y = anchorBottom - height;
  } else if (axis.bottom && !axis.top) {
    y = session.startY;
  }

  const maxRight = PAGE_WIDTH - margins.right;
  const maxBottom = PAGE_HEIGHT - margins.bottom;

  if (x < margins.left) {
    if (axis.left && !axis.right) {
      width = anchorRight - margins.left;
      x = margins.left;
    } else {
      x = margins.left;
    }
  }

  if (y < margins.top) {
    if (axis.top && !axis.bottom) {
      height = anchorBottom - margins.top;
      y = margins.top;
    } else {
      y = margins.top;
    }
  }

  if (x + width > maxRight) {
    if (axis.right && !axis.left) {
      width = maxRight - x;
    } else if (axis.left && !axis.right) {
      x = maxRight - width;
    } else {
      width = maxRight - x;
    }
  }

  if (y + height > maxBottom) {
    if (axis.bottom && !axis.top) {
      height = maxBottom - y;
    } else if (axis.top && !axis.bottom) {
      y = maxBottom - height;
    } else {
      height = maxBottom - y;
    }
  }

  width = Math.max(minSize, width);
  height = Math.max(minSize, height);

  if (axis.left && !axis.right) x = anchorRight - width;
  if (axis.top && !axis.bottom) y = anchorBottom - height;
  if (axis.right && !axis.left) x = session.startX;
  if (axis.bottom && !axis.top) y = session.startY;

  if (horizontalOnly) {
    y = session.startY;
    height = session.startH;
  }
  if (verticalOnly) {
    x = session.startX;
    width = session.startW;
  }

  return { x, y, width, height };
}

export function snapAnchoredBounds(
  bounds: ElementBounds,
  session: ResizeSession,
  direction: string,
  margins: PageMargins,
  snapToGrid: boolean,
  gridSize: number,
  minSize: number
): ElementBounds {
  if (!snapToGrid) return bounds;

  const axis = parseResizeDirection(direction);
  const snap = (v: number) => Math.round(v / gridSize) * gridSize;
  const anchorRight = session.startX + session.startW;
  const anchorBottom = session.startY + session.startH;

  const horizontalOnly = (axis.left || axis.right) && !axis.top && !axis.bottom;
  const verticalOnly = (axis.top || axis.bottom) && !axis.left && !axis.right;

  let x = bounds.x;
  let y = bounds.y;
  let width = bounds.width;
  let height = bounds.height;

  if (axis.left && !axis.right) {
    x = snap(bounds.x);
    width = Math.max(minSize, anchorRight - x);
    x = anchorRight - width;
  } else if (axis.right && !axis.left) {
    x = snap(session.startX);
    width = Math.max(minSize, snap(bounds.width));
  }

  if (axis.top && !axis.bottom) {
    y = snap(bounds.y);
    height = Math.max(minSize, anchorBottom - y);
    y = anchorBottom - height;
  } else if (axis.bottom && !axis.top) {
    y = snap(session.startY);
    height = Math.max(minSize, snap(bounds.height));
  }

  if (horizontalOnly) {
    y = session.startY;
    height = session.startH;
  }
  if (verticalOnly) {
    x = session.startX;
    width = session.startW;
  }

  return clampAnchoredBounds(
    { x, y, width, height },
    session,
    direction,
    margins,
    minSize
  );
}

export function snapBounds(
  bounds: ElementBounds,
  snapToGrid: boolean,
  gridSize: number
): ElementBounds {
  const snap = (v: number) =>
    snapToGrid ? Math.round(v / gridSize) * gridSize : Math.round(v);

  return {
    x: snap(bounds.x),
    y: snap(bounds.y),
    width: Math.max(gridSize, snap(bounds.width)),
    height: Math.max(gridSize, snap(bounds.height)),
  };
}
