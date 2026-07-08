import { ComponentType } from '@invogen/shared';
import type { CSSProperties } from 'react';
import { resolveMediaUrl } from '@/lib/media';
import { normalizeImageCropTransform, type ImageCropTransform } from './image-editor/cropUtils';

export { normalizeImageCropTransform as normalizeImageCrop, type ImageCropTransform as ImageCrop };

export const IMAGE_COMPONENT_TYPES = [
  ComponentType.IMAGE,
  ComponentType.LOGO,
  ComponentType.SIGNATURE,
  ComponentType.STAMP,
  ComponentType.BARCODE,
] as const;

export type ImageObjectFit = 'contain' | 'cover' | 'fill';

export type ImageProps = {
  src?: string;
  objectFit?: ImageObjectFit;
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
  borderRadius?: number;
  flipX?: boolean;
  flipY?: boolean;
  borderWidth?: number;
  borderColor?: string;
  alt?: string;
  // ── Adjustments (CSS filters) ──
  brightness?: number;  // 0–200, default 100
  contrast?: number;    // 0–200, default 100
  saturate?: number;    // 0–200, default 100
  blur?: number;        // 0–20 px, default 0
  // ── Drop shadow ──
  shadowEnabled?: boolean;
  shadowX?: number;
  shadowY?: number;
  shadowBlur?: number;
  shadowColor?: string;
  // ── Rotation ──
  rotation?: number;    // degrees, 0–359
  opacity?: number;   // 0–1
  imageNaturalW?: number;
  imageNaturalH?: number;
  imageCrop?: ImageCropTransform;
};

export function isImageComponentType(type: string): boolean {
  return (IMAGE_COMPONENT_TYPES as readonly string[]).includes(type);
}

export function getImagePlaceholderLabel(type: string): string {
  switch (type) {
    case ComponentType.LOGO:
      return 'Company logo';
    case ComponentType.SIGNATURE:
      return 'Company signature';
    case ComponentType.STAMP:
      return 'Add stamp';
    case ComponentType.BARCODE:
      return 'Add barcode';
    default:
      return 'Add image';
  }
}

export function normalizeImageProps(props: Record<string, unknown>): ImageProps {
  const fit = props.objectFit as string;
  const imageCrop = props.imageCrop
    ? normalizeImageCropTransform(props.imageCrop)
    : undefined;
  return {
    src: typeof props.src === 'string' ? props.src : '',
    objectFit: fit === 'cover' || fit === 'fill' ? fit : 'contain',
    cropX: typeof props.cropX === 'number' ? props.cropX : 0,
    cropY: typeof props.cropY === 'number' ? props.cropY : 0,
    cropW: typeof props.cropW === 'number' ? props.cropW : 1,
    cropH: typeof props.cropH === 'number' ? props.cropH : 1,
    borderRadius: typeof props.borderRadius === 'number' ? props.borderRadius : 0,
    flipX: !!props.flipX,
    flipY: !!props.flipY,
    borderWidth: typeof props.borderWidth === 'number' ? props.borderWidth : 0,
    borderColor: typeof props.borderColor === 'string' ? props.borderColor : '#e5e7eb',
    alt: typeof props.alt === 'string' ? props.alt : '',
    brightness: typeof props.brightness === 'number' ? props.brightness : 100,
    contrast: typeof props.contrast === 'number' ? props.contrast : 100,
    saturate: typeof props.saturate === 'number' ? props.saturate : 100,
    blur: typeof props.blur === 'number' ? props.blur : 0,
    shadowEnabled: !!props.shadowEnabled,
    shadowX: typeof props.shadowX === 'number' ? props.shadowX : 4,
    shadowY: typeof props.shadowY === 'number' ? props.shadowY : 4,
    shadowBlur: typeof props.shadowBlur === 'number' ? props.shadowBlur : 8,
    shadowColor: typeof props.shadowColor === 'string' ? props.shadowColor : '#00000040',
    rotation: typeof props.rotation === 'number' ? props.rotation : 0,
    opacity: typeof props.opacity === 'number' ? props.opacity : 1,
    imageNaturalW: typeof props.imageNaturalW === 'number' ? props.imageNaturalW : undefined,
    imageNaturalH: typeof props.imageNaturalH === 'number' ? props.imageNaturalH : undefined,
    imageCrop,
  };
}

export function getImageDefaultProps(type: string): Record<string, unknown> {
  const base = {
    src: '',
    objectFit: (type === ComponentType.SIGNATURE ? 'fill' : 'contain') as ImageObjectFit,
    borderRadius: type === ComponentType.LOGO ? 4 : 0,
    flipX: false,
    flipY: false,
    borderWidth: 0,
    borderColor: '#e5e7eb',
    alt: '',
    brightness: 100,
    contrast: 100,
    saturate: 100,
    blur: 0,
    shadowEnabled: false,
    shadowX: 4,
    shadowY: 4,
    shadowBlur: 8,
    shadowColor: '#00000040',
    rotation: 0,
    opacity: 100,
  };
  if (type === ComponentType.BARCODE) {
    return { ...base, value: '1234567890' };
  }
  if (type === ComponentType.LOGO || type === ComponentType.SIGNATURE) {
    return { ...base, useCompanyBranding: true };
  }
  return base;
}

/** Build the combined CSS filter string for image adjustments + optional drop-shadow. */
export function buildImageFilter(image: ImageProps): string | undefined {
  const parts: string[] = [];
  if ((image.brightness ?? 100) !== 100) parts.push(`brightness(${image.brightness}%)`);
  if ((image.contrast ?? 100) !== 100) parts.push(`contrast(${image.contrast}%)`);
  if ((image.saturate ?? 100) !== 100) parts.push(`saturate(${image.saturate}%)`);
  if ((image.blur ?? 0) > 0) parts.push(`blur(${image.blur}px)`);
  if (image.shadowEnabled) {
    const sx = image.shadowX ?? 4;
    const sy = image.shadowY ?? 4;
    const sb = image.shadowBlur ?? 8;
    const sc = image.shadowColor ?? '#00000040';
    parts.push(`drop-shadow(${sx}px ${sy}px ${sb}px ${sc})`);
  }
  return parts.length > 0 ? parts.join(' ') : undefined;
}

export function getImageFrameStyle(image: ImageProps): CSSProperties {
  return {
    width: '100%',
    height: '100%',
    borderRadius: image.borderRadius,
    border:
      (image.borderWidth ?? 0) > 0
        ? `${image.borderWidth}px solid ${image.borderColor ?? '#e5e7eb'}`
        : undefined,
    overflow: 'hidden',
    boxSizing: 'border-box',
  };
}

export function getResolvedImageSrc(src?: string): string | undefined {
  return resolveMediaUrl(src);
}
