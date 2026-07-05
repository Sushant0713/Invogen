/** Normalized crop rectangle within the element frame (0–1). */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Non-destructive crop + image transform — original src is never modified. */
export interface ImageCropTransform {
  rect: CropRect;
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
}

export interface CoverBaseSize {
  width: number;
  height: number;
}

export interface ImageNaturalSize {
  width: number;
  height: number;
}

export interface SnapGuide {
  orientation: 'horizontal' | 'vertical';
  position: number;
  label?: string;
}

export type CropEdge = 'left' | 'right' | 'top' | 'bottom';
export type CropCorner = 'nw' | 'ne' | 'sw' | 'se';

export const FULL_CROP_RECT: CropRect = { x: 0, y: 0, width: 1, height: 1 };

export const DEFAULT_IMAGE_CROP: ImageCropTransform = {
  rect: { ...FULL_CROP_RECT },
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotation: 0,
};

export const MIN_CROP_SCALE = 0.15;
export const MAX_CROP_SCALE = 8;
