import {
  DEFAULT_IMAGE_CROP,
  FULL_CROP_RECT,
  MAX_CROP_SCALE,
  MIN_CROP_SCALE,
  type CoverBaseSize,
  type CropRect,
  type ImageCropTransform,
} from './types';
import { clampCropRect } from './cropRect';

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

export function defaultCropForFrame(
  frameW: number,
  frameH: number,
  naturalW: number,
  naturalH: number,
  objectFit: ImageFitMode = 'contain'
): ImageCropTransform {
  const base = getFitBaseSize(frameW, frameH, naturalW, naturalH, objectFit);
  const display = { width: base.width, height: base.height };
  return {
    rect: { ...FULL_CROP_RECT },
    offsetX: (frameW - display.width) / 2,
    offsetY: (frameH - display.height) / 2,
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
  return {
    ...crop,
    offsetX: (frameW - display.width) / 2,
    offsetY: (frameH - display.height) / 2,
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

  let offsetX = (frameW - base.width) / 2;
  let offsetY = (frameH - base.height) / 2;

  if (hasLegacyRegion) {
    offsetX = (frameW - base.width) / 2 - cropX * base.width;
    offsetY = (frameH - base.height) / 2 - cropY * base.height;
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
