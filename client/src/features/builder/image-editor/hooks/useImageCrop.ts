import { useCallback, useRef } from 'react';
import type { CoverBaseSize, ImageCropTransform } from '../types';
import { panImageInCrop, zoomCropAtPoint } from '../cropUtils';

interface UseImageCropOptions {
  enabled: boolean;
  crop: ImageCropTransform;
  base: CoverBaseSize;
  frameW: number;
  frameH: number;
  onChange: (crop: ImageCropTransform, recordHistory?: boolean) => void;
  /** When true, pan only while Alt is held so normal drag moves the element on canvas. */
  requireAltKey?: boolean;
}

export function useImageCrop({
  enabled,
  crop,
  base,
  frameW,
  frameH,
  onChange,
  requireAltKey = false,
}: UseImageCropOptions) {
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const pendingCropRef = useRef(crop);
  pendingCropRef.current = crop;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      if (requireAltKey && !e.altKey) return;
      e.stopPropagation();
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startOffsetX: crop.offsetX,
        startOffsetY: crop.offsetY,
      };
    },
    [enabled, requireAltKey, crop.offsetX, crop.offsetY]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !enabled) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const next = panImageInCrop(
        { ...crop, offsetX: drag.startOffsetX, offsetY: drag.startOffsetY },
        dx,
        dy
      );
      pendingCropRef.current = next;
      onChange(next, false);
    },
    [enabled, crop, onChange]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      onChange(pendingCropRef.current, true);
    },
    [crop, onChange]
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!enabled) return;
      e.stopPropagation();
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const focalX = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * frameW;
      const focalY = ((e.clientY - rect.top) / Math.max(rect.height, 1)) * frameH;
      const delta = -e.deltaY * 0.0015;
      const next = zoomCropAtPoint(crop, base, delta, focalX, focalY);
      onChange(next, false);
    },
    [enabled, crop, base, frameW, frameH, onChange]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
  };
}
