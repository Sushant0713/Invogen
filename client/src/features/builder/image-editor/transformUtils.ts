import type { CSSProperties } from 'react';
import { parseResizeDirection } from '../element-resize';
import type { ElementBounds, ResizeSession } from '../element-resize';

/** Lock aspect ratio on corner resizes unless Shift is held. */
export function applyAspectRatioLock(
  bounds: ElementBounds,
  session: ResizeSession,
  direction: string,
  shiftKey: boolean
): ElementBounds {
  if (shiftKey) return bounds;

  const axis = parseResizeDirection(direction);
  const isCorner = (axis.left || axis.right) && (axis.top || axis.bottom);
  if (!isCorner) return bounds;

  const ratio = session.startW / Math.max(session.startH, 1);
  let { x, y, width, height } = bounds;

  if (width / Math.max(height, 1) > ratio) {
    width = height * ratio;
  } else {
    height = width / ratio;
  }

  const anchorRight = session.startX + session.startW;
  const anchorBottom = session.startY + session.startH;

  if (axis.left && !axis.right) x = anchorRight - width;
  else x = session.startX;

  if (axis.top && !axis.bottom) y = anchorBottom - height;
  else y = session.startY;

  return { x, y, width, height };
}

export function buildImageTransformStyle(opts: {
  flipX?: boolean;
  flipY?: boolean;
  rotation?: number;
  opacity?: number;
}): CSSProperties {
  const transforms: string[] = [];
  if (opts.flipX) transforms.push('scaleX(-1)');
  if (opts.flipY) transforms.push('scaleY(-1)');
  if ((opts.rotation ?? 0) !== 0) transforms.push(`rotate(${opts.rotation}deg)`);

  return {
    transform: transforms.length ? transforms.join(' ') : undefined,
    opacity: opts.opacity ?? 1,
  };
}
