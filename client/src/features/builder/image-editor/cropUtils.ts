import {
  DEFAULT_IMAGE_CROP,
  FULL_CROP_RECT,
  MAX_CROP_SCALE,
  MIN_CROP_SCALE,
  type CoverBaseSize,
  type CropEdge,
  type CropRect,
  type ImageCropTransform,
} from './types';
import { applyCropEdge, clampCropRect } from './cropRect';

export type ImageFitMode = 'contain' | 'cover' | 'fill';

export type { ImageCropTransform, CoverBaseSize, CropRect };
export { DEFAULT_IMAGE_CROP, MIN_CROP_SCALE, MAX_CROP_SCALE, FULL_CROP_RECT };

function readFitMode(raw: unknown): ImageFitMode {
  return raw === 'cover' || raw === 'fill' ? raw : 'contain';
}

export function isDefaultImageCrop(crop: ImageCropTransform): boolean {
  const rect = crop.rect;
  return (
    crop.scale === 1
    && crop.rotation === 0
    && crop.offsetX === 0
    && crop.offsetY === 0
    && rect.x === 0
    && rect.y === 0
    && rect.width === 1
    && rect.height === 1
  );
}

/** True when the image has not been manually cropped/zoomed/panned — safe to auto-layout in the frame. */
export function shouldAutoCenterImageCrop(crop: ImageCropTransform): boolean {
  if (isDefaultImageCrop(crop)) return true;
  const rect = crop.rect;
  const fullFrame =
    rect.x === 0
    && rect.y === 0
    && rect.width === 1
    && rect.height === 1;
  if (!fullFrame || crop.scale !== 1 || crop.rotation !== 0) return false;
  // User dragged the image inside the frame — keep their placement.
  return Math.abs(crop.offsetX) <= 0.5 && Math.abs(crop.offsetY) <= 0.5;
}

export function getFitBaseSize(
  frameW: number,
  frameH: number,
  naturalW: number,
  naturalH: number,
  objectFit: ImageFitMode = 'contain'
): CoverBaseSize {
  if (frameW <= 0 || frameH <= 0 || naturalW <= 0 || naturalH <= 0) {
    return { width: frameW, height: frameH };
  }
  if (objectFit === 'fill') {
    return { width: frameW, height: frameH };
  }
  const scale =
    objectFit === 'cover'
      ? Math.max(frameW / naturalW, frameH / naturalH)
      : Math.min(frameW / naturalW, frameH / naturalH);
  return { width: naturalW * scale, height: naturalH * scale };
}

export function getCoverBaseSize(
  frameW: number,
  frameH: number,
  naturalW: number,
  naturalH: number
): CoverBaseSize {
  return getFitBaseSize(frameW, frameH, naturalW, naturalH, 'cover');
}

export function clampCropScale(scale: number): number {
  return Math.min(MAX_CROP_SCALE, Math.max(MIN_CROP_SCALE, scale));
}

function normalizeRect(raw: unknown): CropRect {
  if (!raw || typeof raw !== 'object') return { ...FULL_CROP_RECT };
  const o = raw as Record<string, unknown>;
  if (typeof o.width === 'number' && typeof o.height === 'number') {
    return clampCropRect({
      x: typeof o.x === 'number' ? o.x : 0,
      y: typeof o.y === 'number' ? o.y : 0,
      width: o.width,
      height: o.height,
    });
  }
  return { ...FULL_CROP_RECT };
}

export function normalizeImageCropTransform(raw: unknown): ImageCropTransform {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_IMAGE_CROP };
  const o = raw as Record<string, unknown>;
  return {
    rect: normalizeRect(o.rect),
    offsetX: typeof o.offsetX === 'number' ? o.offsetX : 0,
    offsetY: typeof o.offsetY === 'number' ? o.offsetY : 0,
    scale: clampCropScale(typeof o.scale === 'number' ? o.scale : 1),
    rotation: typeof o.rotation === 'number' ? o.rotation : 0,
  };
}

function fitOffsets(
  frameW: number,
  frameH: number,
  displayW: number,
  displayH: number,
  objectFit: ImageFitMode
): { offsetX: number; offsetY: number } {
  // Contain pins to the top-left so logos can be placed flush to page margins.
  if (objectFit === 'contain' || objectFit === 'fill') {
    return { offsetX: 0, offsetY: 0 };
  }
  return {
    offsetX: (frameW - displayW) / 2,
    offsetY: (frameH - displayH) / 2,
  };
}

export function defaultCropForFrame(
  frameW: number,
  frameH: number,
  naturalW: number,
  naturalH: number,
  objectFit: ImageFitMode = 'contain'
): ImageCropTransform {
  const base = getFitBaseSize(frameW, frameH, naturalW, naturalH, objectFit);
  const display = { width: base.width, height: base.height };
  const { offsetX, offsetY } = fitOffsets(
    frameW,
    frameH,
    display.width,
    display.height,
    objectFit
  );
  return {
    rect: { ...FULL_CROP_RECT },
    offsetX,
    offsetY,
    scale: 1,
    rotation: 0,
  };
}

export function realignCropForFit(
  crop: ImageCropTransform,
  frameW: number,
  frameH: number,
  naturalW: number,
  naturalH: number,
  objectFit: ImageFitMode
): ImageCropTransform {
  const base = getFitBaseSize(frameW, frameH, naturalW, naturalH, objectFit);
  const display = getDisplayedImageSize(crop, base);
  const { offsetX, offsetY } = fitOffsets(
    frameW,
    frameH,
    display.width,
    display.height,
    objectFit
  );
  return {
    ...crop,
    offsetX,
    offsetY,
  };
}

export function migrateLegacyCropProps(
  props: Record<string, unknown>,
  frameW: number,
  frameH: number,
  naturalW: number,
  naturalH: number
): ImageCropTransform {
  const objectFit = readFitMode(props.objectFit);

  if (props.imageCrop) {
    const crop = normalizeImageCropTransform(props.imageCrop);
    if (!isDefaultImageCrop(crop)) {
      return crop;
    }
  }

  const base = getFitBaseSize(frameW, frameH, naturalW, naturalH, objectFit);
  const cropX = typeof props.cropX === 'number' ? props.cropX : 0;
  const cropY = typeof props.cropY === 'number' ? props.cropY : 0;
  const cropW = typeof props.cropW === 'number' ? props.cropW : 1;
  const cropH = typeof props.cropH === 'number' ? props.cropH : 1;

  const hasLegacyRegion =
    cropX > 0.001 || cropY > 0.001 || cropW < 0.999 || cropH < 0.999;

  const { offsetX: fitX, offsetY: fitY } = fitOffsets(
    frameW,
    frameH,
    base.width,
    base.height,
    objectFit
  );
  let offsetX = fitX;
  let offsetY = fitY;

  if (hasLegacyRegion) {
    offsetX = fitX - cropX * base.width;
    offsetY = fitY - cropY * base.height;
  } else if (typeof props.cropOffsetX === 'number' || typeof props.cropOffsetY === 'number') {
    offsetX = typeof props.cropOffsetX === 'number' ? props.cropOffsetX : offsetX;
    offsetY = typeof props.cropOffsetY === 'number' ? props.cropOffsetY : offsetY;
  }

  return {
    rect: clampCropRect({ x: cropX, y: cropY, width: cropW, height: cropH }),
    offsetX,
    offsetY,
    scale: 1,
    rotation: 0,
  };
}

export function getImageCropFromProps(
  props: Record<string, unknown>,
  frameW: number,
  frameH: number
): ImageCropTransform {
  const naturalW = typeof props.imageNaturalW === 'number' ? props.imageNaturalW : 0;
  const naturalH = typeof props.imageNaturalH === 'number' ? props.imageNaturalH : 0;
  if (naturalW > 0 && naturalH > 0) {
    return migrateLegacyCropProps(props, frameW, frameH, naturalW, naturalH);
  }
  if (props.imageCrop) {
    return normalizeImageCropTransform(props.imageCrop);
  }
  return { ...DEFAULT_IMAGE_CROP };
}

export function cropTransformToProps(crop: ImageCropTransform) {
  return {
    imageCrop: {
      rect: clampCropRect(crop.rect),
      offsetX: crop.offsetX,
      offsetY: crop.offsetY,
      scale: clampCropScale(crop.scale),
      rotation: crop.rotation,
    },
  };
}

export function getDisplayedImageSize(
  crop: ImageCropTransform,
  base: CoverBaseSize
): { width: number; height: number } {
  return {
    width: base.width * crop.scale,
    height: base.height * crop.scale,
  };
}

/** Image is smaller than the frame on at least one axis — hand-drag can reposition it inside the box. */
export function canPanImageInFrame(
  crop: ImageCropTransform,
  base: CoverBaseSize,
  frameW: number,
  frameH: number
): boolean {
  const display = getDisplayedImageSize(crop, base);
  return display.width < frameW - 0.5 || display.height < frameH - 0.5;
}

/** Scale image inside crop mask — anchored at crop-rect center (corners). */
export function scaleImageInCrop(
  crop: ImageCropTransform,
  base: CoverBaseSize,
  frameW: number,
  frameH: number,
  scaleFactor: number
): ImageCropTransform {
  const nextScale = clampCropScale(crop.scale * scaleFactor);
  const oldDisplay = getDisplayedImageSize(crop, base);
  const newW = base.width * nextScale;
  const newH = base.height * nextScale;

  const rcx = crop.rect.x * frameW + (crop.rect.width * frameW) / 2;
  const rcy = crop.rect.y * frameH + (crop.rect.height * frameH) / 2;

  const imgCenterX = crop.offsetX + oldDisplay.width / 2;
  const imgCenterY = crop.offsetY + oldDisplay.height / 2;
  const dx = imgCenterX - rcx;
  const dy = imgCenterY - rcy;
  const ratio = nextScale / crop.scale;

  const newCenterX = rcx + dx * ratio;
  const newCenterY = rcy + dy * ratio;

  return {
    ...crop,
    scale: nextScale,
    offsetX: newCenterX - newW / 2,
    offsetY: newCenterY - newH / 2,
  };
}

export function panImageInCrop(
  crop: ImageCropTransform,
  dx: number,
  dy: number
): ImageCropTransform {
  return {
    ...crop,
    offsetX: crop.offsetX + dx,
    offsetY: crop.offsetY + dy,
  };
}

const CROP_EDGE_TOL = 0.001;

export function isCropAtFrameEdge(rect: CropRect, edge: CropEdge): boolean {
  switch (edge) {
    case 'left':
      return rect.x <= CROP_EDGE_TOL;
    case 'right':
      return rect.x + rect.width >= 1 - CROP_EDGE_TOL;
    case 'top':
      return rect.y <= CROP_EDGE_TOL;
    case 'bottom':
      return rect.y + rect.height >= 1 - CROP_EDGE_TOL;
  }
}

/** Edge drag: shrink/expand crop window; at full frame, outward drag zooms out to reveal more image. */
export function cropEdgeDrag(
  start: ImageCropTransform,
  base: CoverBaseSize,
  edge: CropEdge,
  cumulativePx: number,
  frameW: number,
  frameH: number
): ImageCropTransform {
  const isExpanding =
    (edge === 'right' && cumulativePx > 0)
    || (edge === 'left' && cumulativePx < 0)
    || (edge === 'bottom' && cumulativePx > 0)
    || (edge === 'top' && cumulativePx < 0);

  if (!isExpanding) {
    return { ...start, rect: applyCropEdge(start.rect, edge, cumulativePx, frameW, frameH) };
  }

  const nextRect = applyCropEdge(start.rect, edge, cumulativePx, frameW, frameH);
  const rectGrew =
    nextRect.width > start.rect.width + CROP_EDGE_TOL
    || nextRect.height > start.rect.height + CROP_EDGE_TOL
    || (edge === 'left' && nextRect.x < start.rect.x - CROP_EDGE_TOL)
    || (edge === 'top' && nextRect.y < start.rect.y - CROP_EDGE_TOL);

  if (rectGrew || !isCropAtFrameEdge(start.rect, edge)) {
    return { ...start, rect: nextRect };
  }

  const outward = Math.abs(cumulativePx);
  const denom =
    edge === 'left' || edge === 'right'
      ? Math.max(frameW, 64)
      : Math.max(frameH, 64);
  const factor = Math.max(MIN_CROP_SCALE / Math.max(start.scale, MIN_CROP_SCALE), 1 - outward / denom);
  return scaleImageInCrop(start, base, frameW, frameH, factor);
}

/** Keep image placement proportional when the element frame is resized (crop mode corners). */
export function scaleCropForFrameResize(
  crop: ImageCropTransform,
  oldFrameW: number,
  oldFrameH: number,
  newFrameW: number,
  newFrameH: number
): ImageCropTransform {
  const rx = newFrameW / Math.max(oldFrameW, 1);
  const ry = newFrameH / Math.max(oldFrameH, 1);
  return {
    ...crop,
    offsetX: crop.offsetX * rx,
    offsetY: crop.offsetY * ry,
  };
}

/** Wheel zoom — focal point stays fixed under the cursor. */
export function zoomCropAtPoint(
  crop: ImageCropTransform,
  base: CoverBaseSize,
  delta: number,
  focalX: number,
  focalY: number
): ImageCropTransform {
  const scaleFactor = 1 + delta;
  const nextScale = clampCropScale(crop.scale * scaleFactor);
  const ratio = nextScale / crop.scale;
  const fx = focalX - crop.offsetX;
  const fy = focalY - crop.offsetY;
  const newDisplay = getDisplayedImageSize({ ...crop, scale: nextScale }, base);
  return {
    ...crop,
    scale: nextScale,
    offsetX: focalX - fx * ratio,
    offsetY: focalY - fy * ratio,
  };
}

export const UPLOAD_IMAGE_PROPS = {
  objectFit: 'contain' as const,
  opacity: 100,
};

/** Props applied when uploading or replacing an image source. */
export function getImageUploadPatch(url: string): Record<string, unknown> {
  return { src: url, ...UPLOAD_IMAGE_PROPS };
}
