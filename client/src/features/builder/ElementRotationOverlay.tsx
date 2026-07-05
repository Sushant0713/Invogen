import { useCallback, useRef, type RefObject } from 'react';
import { RotateCw } from 'lucide-react';
import { BUILDER_ROTATION_HANDLE_Z } from './element-layers';
import type { ElementBounds } from './element-resize';
import {
  cornersToSvgPoints,
  getRotationHandlePosition,
  getRotatedElementCorners,
  normalizeRotation,
  snapRotationDegrees,
} from './element-rotation';
import {
  type RotatedCornerHandle,
  OPPOSITE_CORNER,
  computeRotatedCornerResize,
  getCornerWorldPosition,
  getRotatedResizeCursor,
} from './rotated-resize';

const CORNER_HANDLES: RotatedCornerHandle[] = [
  'topLeft',
  'topRight',
  'bottomRight',
  'bottomLeft',
];

interface Props {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zoom: number;
  minSize: number;
  lockAspectRatio?: boolean;
  overlayRef: RefObject<HTMLDivElement | null>;
  onRotate: (rotation: number, recordHistory?: boolean) => void;
  onBoundsChange: (bounds: ElementBounds, recordHistory?: boolean) => void;
}

export function ElementRotationOverlay({
  x,
  y,
  width,
  height,
  rotation,
  zoom,
  minSize,
  lockAspectRatio = false,
  overlayRef,
  onRotate,
  onBoundsChange,
}: Props) {
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;

  const boundsRef = useRef({ x, y, width, height });
  boundsRef.current = { x, y, width, height };

  const rotateDragRef = useRef<{ startAngle: number; startRotation: number } | null>(null);
  const resizeDragRef = useRef<{
    corner: RotatedCornerHandle;
    anchorWorld: { x: number; y: number };
    aspectRatio: number;
    lastBounds: ElementBounds;
  } | null>(null);

  const handlePos = getRotationHandlePosition(x, y, width, height, rotation);
  const centerX = handlePos.centerX * zoom;
  const centerY = handlePos.centerY * zoom;
  const handleX = handlePos.handleX * zoom;
  const handleY = handlePos.handleY * zoom;

  const corners = getRotatedElementCorners(x, y, width, height, rotation);
  const points = cornersToSvgPoints(corners, zoom);
  const showRotatedResize = rotation !== 0;

  const toCanvasPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return { x: clientX / zoom, y: clientY / zoom };
      return {
        x: (clientX - rect.left) / zoom,
        y: (clientY - rect.top) / zoom,
      };
    },
    [overlayRef, zoom]
  );

  const getAngle = useCallback(
    (clientX: number, clientY: number) => {
      const p = toCanvasPoint(clientX, clientY);
      const dx = p.x - handlePos.centerX;
      const dy = p.y - handlePos.centerY;
      return (Math.atan2(dy, dx) * 180) / Math.PI;
    },
    [handlePos.centerX, handlePos.centerY, toCanvasPoint]
  );

  const finishRotate = useCallback(() => {
    rotateDragRef.current = null;
    onRotate(normalizeRotation(rotationRef.current), true);
  }, [onRotate]);

  const onRotatePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();

      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      rotateDragRef.current = {
        startAngle: getAngle(e.clientX, e.clientY),
        startRotation: rotationRef.current,
      };

      const onWindowPointerMove = (ev: PointerEvent) => {
        const drag = rotateDragRef.current;
        if (!drag) return;
        const angle = getAngle(ev.clientX, ev.clientY);
        const delta = angle - drag.startAngle;
        onRotate(snapRotationDegrees(drag.startRotation + delta, ev.shiftKey), false);
      };

      const onWindowPointerUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onWindowPointerMove);
        window.removeEventListener('pointerup', onWindowPointerUp);
        window.removeEventListener('pointercancel', onWindowPointerUp);
        try {
          target.releasePointerCapture(ev.pointerId);
        } catch {
          // already released
        }
        finishRotate();
      };

      window.addEventListener('pointermove', onWindowPointerMove);
      window.addEventListener('pointerup', onWindowPointerUp);
      window.addEventListener('pointercancel', onWindowPointerUp);
    },
    [finishRotate, getAngle, onRotate]
  );

  const onResizePointerDown = useCallback(
    (corner: RotatedCornerHandle, e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();

      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const b = boundsRef.current;
      const opposite = OPPOSITE_CORNER[corner];
      const anchorWorld = getCornerWorldPosition(
        b.x,
        b.y,
        b.width,
        b.height,
        rotationRef.current,
        opposite
      );

      resizeDragRef.current = {
        corner,
        anchorWorld,
        aspectRatio: b.width / Math.max(b.height, 1),
        lastBounds: b,
      };

      const onWindowPointerMove = (ev: PointerEvent) => {
        const drag = resizeDragRef.current;
        if (!drag) return;
        const pointerWorld = toCanvasPoint(ev.clientX, ev.clientY);
        const next = computeRotatedCornerResize(
          drag.corner,
          drag.anchorWorld,
          pointerWorld,
          rotationRef.current,
          minSize,
          lockAspectRatio || ev.shiftKey
            ? { aspectRatio: drag.aspectRatio }
            : undefined
        );
        drag.lastBounds = next;
        onBoundsChange(next, false);
      };

      const onWindowPointerUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onWindowPointerMove);
        window.removeEventListener('pointerup', onWindowPointerUp);
        window.removeEventListener('pointercancel', onWindowPointerUp);
        try {
          target.releasePointerCapture(ev.pointerId);
        } catch {
          // already released
        }
        const finalBounds = resizeDragRef.current?.lastBounds;
        resizeDragRef.current = null;
        if (finalBounds) onBoundsChange(finalBounds, true);
      };

      window.addEventListener('pointermove', onWindowPointerMove);
      window.addEventListener('pointerup', onWindowPointerUp);
      window.addEventListener('pointercancel', onWindowPointerUp);
    },
    [lockAspectRatio, minSize, onBoundsChange, toCanvasPoint]
  );

  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 overflow-visible"
        style={{ zIndex: BUILDER_ROTATION_HANDLE_Z }}
        aria-hidden
      >
        <polygon
          points={points}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={centerX}
          y1={centerY}
          x2={handleX}
          y2={handleY}
          stroke="#3b82f6"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {showRotatedResize &&
        CORNER_HANDLES.map((corner) => {
          const pos = getCornerWorldPosition(x, y, width, height, rotation, corner);
          return (
            <button
              key={corner}
              type="button"
              title="Resize"
              className="pointer-events-auto absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-white shadow-[0_1px_4px_rgba(0,0,0,0.25)] hover:scale-110"
              style={{
                left: pos.x * zoom,
                top: pos.y * zoom,
                zIndex: BUILDER_ROTATION_HANDLE_Z,
                cursor: getRotatedResizeCursor(corner, rotation),
              }}
              onPointerDown={(e) => onResizePointerDown(corner, e)}
            />
          );
        })}

      <button
        type="button"
        title="Rotate (hold Shift to snap 15°)"
        className="pointer-events-auto absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 border-[#3b82f6] bg-white text-[#3b82f6] shadow-md hover:bg-blue-50 active:cursor-grabbing"
        style={{ left: handleX, top: handleY, zIndex: BUILDER_ROTATION_HANDLE_Z }}
        onPointerDown={onRotatePointerDown}
      >
        <RotateCw className="h-4 w-4" />
      </button>
    </>
  );
}
