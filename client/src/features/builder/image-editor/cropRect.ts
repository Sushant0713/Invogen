import type { CropRect } from './types';
import { FULL_CROP_RECT } from './types';

const MIN_CROP_FRAC = 0.05;

export function clampCropRect(rect: CropRect): CropRect {
  let { x, y, width, height } = rect;
  width = Math.max(MIN_CROP_FRAC, Math.min(1, width));
  height = Math.max(MIN_CROP_FRAC, Math.min(1, height));
  x = Math.max(0, Math.min(1 - width, x));
  y = Math.max(0, Math.min(1 - height, y));
  return { x, y, width, height };
}

export function rectToPixels(rect: CropRect, frameW: number, frameH: number) {
  return {
    x: rect.x * frameW,
    y: rect.y * frameH,
    width: rect.width * frameW,
    height: rect.height * frameH,
  };
}

export function pixelsToRect(
  px: { x: number; y: number; width: number; height: number },
  frameW: number,
  frameH: number
): CropRect {
  if (frameW <= 0 || frameH <= 0) return { ...FULL_CROP_RECT };
  return clampCropRect({
    x: px.x / frameW,
    y: px.y / frameH,
    width: px.width / frameW,
    height: px.height / frameH,
  });
}

/** Move the left crop edge — right edge stays fixed. Image is not stretched. */
export function cropLeft(rect: CropRect, deltaPx: number, frameW: number, frameH: number): CropRect {
  const px = rectToPixels(rect, frameW, frameH);
  const right = px.x + px.width;
  const newX = Math.min(right - MIN_CROP_FRAC * frameW, px.x + deltaPx);
  return pixelsToRect({ x: newX, y: px.y, width: right - newX, height: px.height }, frameW, frameH);
}

/** Move the right crop edge — left edge stays fixed. */
export function cropRight(rect: CropRect, deltaPx: number, frameW: number, frameH: number): CropRect {
  const px = rectToPixels(rect, frameW, frameH);
  const newW = Math.max(MIN_CROP_FRAC * frameW, px.width + deltaPx);
  return pixelsToRect({ x: px.x, y: px.y, width: newW, height: px.height }, frameW, frameH);
}

/** Move the top crop edge — bottom edge stays fixed. */
export function cropTop(rect: CropRect, deltaPx: number, frameW: number, frameH: number): CropRect {
  const px = rectToPixels(rect, frameW, frameH);
  const bottom = px.y + px.height;
  const newY = Math.min(bottom - MIN_CROP_FRAC * frameH, px.y + deltaPx);
  return pixelsToRect({ x: px.x, y: newY, width: px.width, height: bottom - newY }, frameW, frameH);
}

/** Move the bottom crop edge — top edge stays fixed. */
export function cropBottom(rect: CropRect, deltaPx: number, frameW: number, frameH: number): CropRect {
  const px = rectToPixels(rect, frameW, frameH);
  const newH = Math.max(MIN_CROP_FRAC * frameH, px.height + deltaPx);
  return pixelsToRect({ x: px.x, y: px.y, width: px.width, height: newH }, frameW, frameH);
}

export function applyCropEdge(
  rect: CropRect,
  edge: 'left' | 'right' | 'top' | 'bottom',
  deltaPx: number,
  frameW: number,
  frameH: number
): CropRect {
  switch (edge) {
    case 'left':
      return cropLeft(rect, deltaPx, frameW, frameH);
    case 'right':
      return cropRight(rect, deltaPx, frameW, frameH);
    case 'top':
      return cropTop(rect, deltaPx, frameW, frameH);
    case 'bottom':
      return cropBottom(rect, deltaPx, frameW, frameH);
  }
}
