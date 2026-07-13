import { useCallback, useRef, type RefObject } from 'react';
import { RotateCw } from 'lucide-react';
import { BUILDER_ROTATION_HANDLE_Z } from './element-layers';
import type { ElementBounds } from './element-resize';
import {
  cornersToSvgPoints,
  getRotationHandlePosition,
  getRotatedElementCorners,
} from './element-rotation';
import {
  normalizeDividerRotation,
  normalizeDividerRotationLive,
} from './divider-rotation';
import {
  type DividerEdgeHandle,
  computeDividerEdgeResize,
  getDividerEdgeResizeCursor,
  getDividerEdgeWorldPosition,
  getOppositeDividerEdge,
} from './divider-resize';

const EDGE_HANDLES: DividerEdgeHandle[] = ['left', 'right'];

interface Props {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zoom: number;
  overlayRef: RefObject<HTMLDivElement | null>;
  onRotate: (rotation: number, recordHistory?: boolean) => void;
  onBoundsChange: (bounds: ElementBounds, recordHistory?: boolean) => void;
}

export function DividerRotationOverlay({
  x,
  y,
  width,
  height,
  rotation,
  zoom,
  overlayRef,
  onRotate,
  onBoundsChange,
}: Props) {
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;

  const boundsRef = useRef({ x, y, width, height });
  boundsRef.current = { x, y, width, height };

  const rotateDragRef = useRef<{
    startAngle: number;
    startRotation: number;
    centerX: number;
    centerY: number;
  } | null>(null);
  const resizeDragRef = useRef<{
    edge: DividerEdgeHandle;
    anchorWorld: { x: number; y: number };
    rotationDeg: number;
    crossHeight: number;
    lastBounds: ElementBounds;
  } | null>(null);

  const handlePos = getRotationHandlePosition(x, y, width, height, rotation);
  const centerX = handlePos.centerX * zoom;
  const centerY = handlePos.centerY * zoom;
  const handleX = handlePos.handleX * zoom;
  const handleY = handlePos.handleY * zoom;

  const corners = getRotatedElementCorners(x, y, width, height, 0);
  const points = cornersToSvgPoints(corners, zoom);

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

  const getRotateAngle = useCallback(
    (clientX: number, clientY: number, centerX: number, centerY: number) => {
      const p = toCanvasPoint(clientX, clientY);
      return (Math.atan2(p.y - centerY, p.x - centerX) * 180) / Math.PI;
    },
    [toCanvasPoint]
  );

  const finishRotate = useCallback(() => {
    rotateDragRef.current = null;
    onRotate(normalizeDividerRotation(rotationRef.current), true);
  }, [onRotate]);

  const onRotatePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();

      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const b = boundsRef.current;
      const centerX = b.x + b.width / 2;
      const centerY = b.y + b.height / 2;

      rotateDragRef.current = {
        startAngle: getRotateAngle(e.clientX, e.clientY, centerX, centerY),
        startRotation: rotationRef.current,
        centerX,
        centerY,
      };

      const onWindowPointerMove = (ev: PointerEvent) => {
        const drag = rotateDragRef.current;
        if (!drag) return;
        const angle = getRotateAngle(ev.clientX, ev.clientY, drag.centerX, drag.centerY);
        let delta = angle - drag.startAngle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        const next = normalizeDividerRotationLive(drag.startRotation + delta);
        rotationRef.current = next;
        onRotate(
          ev.shiftKey
            ? normalizeDividerRotation(Math.round(next / 15) * 15)
            : next,
          false
        );
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
    [finishRotate, getRotateAngle, onRotate]
  );

  const onResizePointerDown = useCallback(
    (edge: DividerEdgeHandle, e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();

      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const b = boundsRef.current;
      const opposite = getOppositeDividerEdge(edge);
      const anchorWorld = getDividerEdgeWorldPosition(
        b.x,
        b.y,
        b.width,
        b.height,
        rotationRef.current,
        opposite
      );

      resizeDragRef.current = {
        edge,
        anchorWorld,
        rotationDeg: rotationRef.current,
        crossHeight: b.height,
        lastBounds: b,
      };

      const onWindowPointerMove = (ev: PointerEvent) => {
        const drag = resizeDragRef.current;
        if (!drag) return;
        const pointerWorld = toCanvasPoint(ev.clientX, ev.clientY);
        const next = computeDividerEdgeResize(
          drag.edge,
          drag.anchorWorld,
          pointerWorld,
          drag.rotationDeg,
          drag.crossHeight
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
    [onBoundsChange, toCanvasPoint]
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

      {EDGE_HANDLES.map((edge) => {
        const pos = getDividerEdgeWorldPosition(x, y, width, height, rotation, edge);
        return (
          <button
            key={edge}
            type="button"
            title="Resize line length"
            className="pointer-events-auto absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-white shadow-[0_1px_4px_rgba(0,0,0,0.25)] hover:scale-110"
            style={{
              left: pos.x * zoom,
              top: pos.y * zoom,
              zIndex: BUILDER_ROTATION_HANDLE_Z,
              cursor: getDividerEdgeResizeCursor(rotation),
            }}
            onPointerDown={(e) => onResizePointerDown(edge, e)}
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
