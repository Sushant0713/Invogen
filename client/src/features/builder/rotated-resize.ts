import type { ElementBounds } from './element-resize';
import { getRotatedElementCorners } from './element-rotation';

export type RotatedCornerHandle = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';

const CORNER_INDEX: Record<RotatedCornerHandle, 0 | 1 | 2 | 3> = {
  topLeft: 0,
  topRight: 1,
  bottomRight: 2,
  bottomLeft: 3,
};

export const OPPOSITE_CORNER: Record<RotatedCornerHandle, RotatedCornerHandle> = {
  topLeft: 'bottomRight',
  topRight: 'bottomLeft',
  bottomRight: 'topLeft',
  bottomLeft: 'topRight',
};

export function canvasDeltaToLocal(dx: number, dy: number, rotationDeg: number) {
  const rad = (-rotationDeg * Math.PI) / 180;
  return {
    x: dx * Math.cos(rad) - dy * Math.sin(rad),
    y: dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

export function localToWorldVector(lx: number, ly: number, rotationDeg: number) {
  const rad = (rotationDeg * Math.PI) / 180;
  return {
    x: lx * Math.cos(rad) - ly * Math.sin(rad),
    y: lx * Math.sin(rad) + ly * Math.cos(rad),
  };
}

export function boundsFromCenter(
  cx: number,
  cy: number,
  width: number,
  height: number,
  rotationDeg: number
): ElementBounds {
  const rad = (rotationDeg * Math.PI) / 180;
  const dx = -width / 2;
  const dy = -height / 2;
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
    width,
    height,
  };
}

export function getCornerWorldPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  rotationDeg: number,
  corner: RotatedCornerHandle
): { x: number; y: number } {
  const corners = getRotatedElementCorners(x, y, width, height, rotationDeg);
  return corners[CORNER_INDEX[corner]];
}

/** Local offset from box center to a corner (unrotated, y-down). */
function cornerOffsetFromCenter(
  corner: RotatedCornerHandle,
  width: number,
  height: number
): { lx: number; ly: number } {
  switch (corner) {
    case 'topLeft':
      return { lx: -width / 2, ly: -height / 2 };
    case 'topRight':
      return { lx: width / 2, ly: -height / 2 };
    case 'bottomRight':
      return { lx: width / 2, ly: height / 2 };
    case 'bottomLeft':
      return { lx: -width / 2, ly: height / 2 };
  }
}

/** Full local vector from anchored corner to the dragged corner. */
function dimensionsFromDragVector(
  dragCorner: RotatedCornerHandle,
  localV: { x: number; y: number },
  minSize: number
): { width: number; height: number } {
  let width: number;
  let height: number;

  switch (dragCorner) {
    case 'bottomRight':
      width = localV.x;
      height = localV.y;
      break;
    case 'topLeft':
      width = -localV.x;
      height = -localV.y;
      break;
    case 'topRight':
      width = localV.x;
      height = -localV.y;
      break;
    case 'bottomLeft':
      width = -localV.x;
      height = localV.y;
      break;
  }

  return {
    width: Math.max(minSize, width),
    height: Math.max(minSize, height),
  };
}

/**
 * Resize a rotated box by dragging one corner; the opposite corner stays fixed in place.
 */
export function computeRotatedCornerResize(
  dragCorner: RotatedCornerHandle,
  anchorWorld: { x: number; y: number },
  pointerWorld: { x: number; y: number },
  rotationDeg: number,
  minSize: number,
  options?: { aspectRatio?: number }
): ElementBounds {
  const anchorCorner = OPPOSITE_CORNER[dragCorner];
  const localV = canvasDeltaToLocal(
    pointerWorld.x - anchorWorld.x,
    pointerWorld.y - anchorWorld.y,
    rotationDeg
  );

  let { width, height } = dimensionsFromDragVector(dragCorner, localV, minSize);

  if (options?.aspectRatio && options.aspectRatio > 0) {
    const ratio = options.aspectRatio;
    if (width / height > ratio) width = height * ratio;
    else height = width / ratio;
    width = Math.max(minSize, width);
    height = Math.max(minSize, height);
  }

  const { lx, ly } = cornerOffsetFromCenter(anchorCorner, width, height);
  const worldOff = localToWorldVector(lx, ly, rotationDeg);
  const cx = anchorWorld.x - worldOff.x;
  const cy = anchorWorld.y - worldOff.y;

  return boundsFromCenter(cx, cy, width, height, rotationDeg);
}

export function getRotatedResizeCursor(corner: RotatedCornerHandle, rotationDeg: number): string {
  const base = { topLeft: 315, topRight: 45, bottomRight: 135, bottomLeft: 225 }[corner];
  const angle = ((base + rotationDeg) % 180 + 180) % 180;
  if (angle < 22.5 || angle >= 157.5) return 'ns-resize';
  if (angle < 67.5) return 'nesw-resize';
  if (angle < 112.5) return 'ew-resize';
  return 'nwse-resize';
}
