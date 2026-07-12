import { memo, useCallback, useRef } from 'react';
import type { CropCorner, CropEdge, ImageCropTransform } from './types';
import type { CoverBaseSize } from './cropUtils';
import { cropEdgeDrag } from './cropUtils';
import { rectToPixels } from './cropRect';
import {
  computeAnchoredResize,
  type ElementBounds,
  type ResizeSession,
} from '../element-resize';

type HandleKind =
  | { type: 'edge'; edge: CropEdge }
  | { type: 'corner'; corner: CropCorner };

export interface CropFrameBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  crop: ImageCropTransform;
  base: CoverBaseSize;
  frameW: number;
  frameH: number;
  zoom?: number;
  frameBounds: CropFrameBounds;
  /** When true, pan/zoom mode is active — hide resize/crop handles. */
  panEnabled?: boolean;
  onCropChange: (crop: ImageCropTransform, recordHistory?: boolean) => void;
  onFrameResize?: (bounds: ElementBounds, recordHistory?: boolean) => void;
}

const HANDLE = 14;
const CORNER = 18;
const MIN_FRAME_SIZE = 24;

const CORNER_DIRECTION: Record<CropCorner, string> = {
  nw: 'topLeft',
  ne: 'topRight',
  sw: 'bottomLeft',
  se: 'bottomRight',
};

function edgeCumulativePx(edge: CropEdge, dx: number, dy: number): number {
  switch (edge) {
    case 'left':
      return dx;
    case 'right':
      return dx;
    case 'top':
      return dy;
    case 'bottom':
      return dy;
  }
}

function cornerResizeBounds(
  corner: CropCorner,
  startFrame: CropFrameBounds,
  dx: number,
  dy: number
): ElementBounds {
  const session: ResizeSession = {
    startX: startFrame.x,
    startY: startFrame.y,
    startW: startFrame.width,
    startH: startFrame.height,
  };

  let position = { x: startFrame.x, y: startFrame.y };
  let size = { width: startFrame.width, height: startFrame.height };

  switch (corner) {
    case 'se':
      size = { width: startFrame.width + dx, height: startFrame.height + dy };
      break;
    case 'nw':
      position = { x: startFrame.x + dx, y: startFrame.y + dy };
      size = { width: startFrame.width - dx, height: startFrame.height - dy };
      break;
    case 'ne':
      position = { x: startFrame.x, y: startFrame.y + dy };
      size = { width: startFrame.width + dx, height: startFrame.height - dy };
      break;
    case 'sw':
      position = { x: startFrame.x + dx, y: startFrame.y };
      size = { width: startFrame.width - dx, height: startFrame.height + dy };
      break;
  }

  return computeAnchoredResize(
    session,
    CORNER_DIRECTION[corner],
    position,
    size,
    MIN_FRAME_SIZE
  );
}

function CropModeHandlesInner({
  crop,
  base,
  frameW,
  frameH,
  zoom = 1,
  frameBounds,
  panEnabled = false,
  onCropChange,
  onFrameResize,
}: Props) {
  const sessionRef = useRef<{
    kind: HandleKind;
    startX: number;
    startY: number;
    startCrop: ImageCropTransform;
    startFrame: CropFrameBounds;
  } | null>(null);
  const pendingCropRef = useRef(crop);
  const pendingBoundsRef = useRef<ElementBounds | null>(null);

  pendingCropRef.current = crop;

  const rectPx = rectToPixels(crop.rect, frameW, frameH);
  const handleRect = rectPx;

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent, kind: HandleKind) => {
      e.stopPropagation();
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      pendingBoundsRef.current = null;
      sessionRef.current = {
        kind,
        startX: e.clientX,
        startY: e.clientY,
        startCrop: crop,
        startFrame: frameBounds,
      };
    },
    [crop, frameBounds]
  );

  const onHandlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const session = sessionRef.current;
      if (!session) return;

      const dx = (e.clientX - session.startX) / Math.max(zoom, 0.01);
      const dy = (e.clientY - session.startY) / Math.max(zoom, 0.01);

      if (session.kind.type === 'edge') {
        const cumulative = edgeCumulativePx(session.kind.edge, dx, dy);
        const next = cropEdgeDrag(
          session.startCrop,
          base,
          session.kind.edge,
          cumulative,
          frameW,
          frameH
        );
        pendingCropRef.current = next;
        onCropChange(next, false);
        return;
      }

      if (!onFrameResize) return;
      const bounds = cornerResizeBounds(session.kind.corner, session.startFrame, dx, dy);
      pendingBoundsRef.current = bounds;
      onFrameResize(bounds, false);
    },
    [base, frameW, frameH, onCropChange, onFrameResize, zoom]
  );

  const onHandlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const session = sessionRef.current;
      if (!session) return;
      sessionRef.current = null;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

      if (session.kind.type === 'edge') {
        onCropChange(pendingCropRef.current, true);
        return;
      }

      if (pendingBoundsRef.current && onFrameResize) {
        onFrameResize(pendingBoundsRef.current, true);
        pendingBoundsRef.current = null;
      }
    },
    [onCropChange, onFrameResize]
  );

  const edgeStyle = (edge: CropEdge): React.CSSProperties => {
    const midX = handleRect.x + handleRect.width / 2;
    const midY = handleRect.y + handleRect.height / 2;
    switch (edge) {
      case 'left':
        return {
          left: handleRect.x - HANDLE / 2,
          top: midY - HANDLE / 2,
          width: HANDLE,
          height: HANDLE,
          cursor: 'ew-resize',
        };
      case 'right':
        return {
          left: handleRect.x + handleRect.width - HANDLE / 2,
          top: midY - HANDLE / 2,
          width: HANDLE,
          height: HANDLE,
          cursor: 'ew-resize',
        };
      case 'top':
        return {
          left: midX - HANDLE / 2,
          top: handleRect.y - HANDLE / 2,
          width: HANDLE,
          height: HANDLE,
          cursor: 'ns-resize',
        };
      case 'bottom':
        return {
          left: midX - HANDLE / 2,
          top: handleRect.y + handleRect.height - HANDLE / 2,
          width: HANDLE,
          height: HANDLE,
          cursor: 'ns-resize',
        };
    }
  };

  const cornerStyle = (corner: CropCorner): React.CSSProperties => {
    switch (corner) {
      case 'nw':
        return {
          left: handleRect.x - CORNER / 2,
          top: handleRect.y - CORNER / 2,
          cursor: 'nwse-resize',
        };
      case 'ne':
        return {
          left: handleRect.x + handleRect.width - CORNER / 2,
          top: handleRect.y - CORNER / 2,
          cursor: 'nesw-resize',
        };
      case 'sw':
        return {
          left: handleRect.x - CORNER / 2,
          top: handleRect.y + handleRect.height - CORNER / 2,
          cursor: 'nesw-resize',
        };
      case 'se':
        return {
          left: handleRect.x + handleRect.width - CORNER / 2,
          top: handleRect.y + handleRect.height - CORNER / 2,
          cursor: 'nwse-resize',
        };
    }
  };

  const grip = (isCorner: boolean) => (
    <span
      className={
        isCorner
          ? 'block h-3.5 w-3.5 rounded-full border-2 border-primary bg-white shadow-[0_1px_4px_rgba(0,0,0,0.25)]'
          : 'block rounded-full bg-primary shadow-[0_1px_3px_rgba(0,0,0,0.2)]'
      }
      style={isCorner ? undefined : { width: 28, height: 6 }}
      aria-hidden
    />
  );

  if (panEnabled) return null;

  const edges: CropEdge[] = ['left', 'right', 'top', 'bottom'];
  const corners: CropCorner[] = ['nw', 'ne', 'sw', 'se'];

  return (
    <div className="pointer-events-none absolute inset-0 z-[80]" aria-hidden>
      <div
        className="pointer-events-none absolute border-2 border-white/90"
        style={{
          left: handleRect.x,
          top: handleRect.y,
          width: handleRect.width,
          height: handleRect.height,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.45)',
        }}
      >
        <CropGrid w={handleRect.width} h={handleRect.height} />
      </div>

      {edges.map((edge) => (
        <div
          key={edge}
          className="builder-image-crop-handle pointer-events-auto absolute flex items-center justify-center"
          style={edgeStyle(edge)}
          onPointerDown={(e) => onHandlePointerDown(e, { type: 'edge', edge })}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        >
          {grip(false)}
        </div>
      ))}

      {corners.map((corner) => (
        <div
          key={corner}
          className="builder-image-crop-handle pointer-events-auto absolute flex items-center justify-center"
          style={{ ...cornerStyle(corner), width: CORNER, height: CORNER }}
          onPointerDown={(e) => onHandlePointerDown(e, { type: 'corner', corner })}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        >
          {grip(true)}
        </div>
      ))}
    </div>
  );
}

function CropGrid({ w, h }: { w: number; h: number }) {
  const thirdW = w / 3;
  const thirdH = h / 3;
  return (
    <svg className="absolute inset-0 h-full w-full" aria-hidden>
      <line x1={thirdW} y1={0} x2={thirdW} y2={h} stroke="rgba(255,255,255,0.35)" strokeWidth={0.75} />
      <line x1={thirdW * 2} y1={0} x2={thirdW * 2} y2={h} stroke="rgba(255,255,255,0.35)" strokeWidth={0.75} />
      <line x1={0} y1={thirdH} x2={w} y2={thirdH} stroke="rgba(255,255,255,0.35)" strokeWidth={0.75} />
      <line x1={0} y1={thirdH * 2} x2={w} y2={thirdH * 2} stroke="rgba(255,255,255,0.35)" strokeWidth={0.75} />
    </svg>
  );
}

export const CropModeHandles = memo(CropModeHandlesInner);
