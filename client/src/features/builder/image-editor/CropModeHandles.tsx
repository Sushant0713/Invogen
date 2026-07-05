import { memo, useCallback, useRef } from 'react';
import type { CropCorner, CropEdge, ImageCropTransform } from './types';
import type { CoverBaseSize } from './cropUtils';
import { scaleImageInCrop } from './cropUtils';
import { applyCropEdge, rectToPixels } from './cropRect';

type HandleKind =
  | { type: 'edge'; edge: CropEdge }
  | { type: 'corner'; corner: CropCorner };

interface Props {
  crop: ImageCropTransform;
  base: CoverBaseSize;
  frameW: number;
  frameH: number;
  onCropChange: (crop: ImageCropTransform, recordHistory?: boolean) => void;
}

const HANDLE = 14;
const CORNER = 18;

function CropModeHandlesInner({ crop, base, frameW, frameH, onCropChange }: Props) {
  const sessionRef = useRef<{
    kind: HandleKind;
    startX: number;
    startY: number;
    startCrop: ImageCropTransform;
    startDisplay: { width: number; height: number };
  } | null>(null);

  const rectPx = rectToPixels(crop.rect, frameW, frameH);

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent, kind: HandleKind) => {
      e.stopPropagation();
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const display = {
        width: base.width * crop.scale,
        height: base.height * crop.scale,
      };
      sessionRef.current = {
        kind,
        startX: e.clientX,
        startY: e.clientY,
        startCrop: crop,
        startDisplay: display,
      };
    },
    [crop, base]
  );

  const onHandlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const session = sessionRef.current;
      if (!session) return;
      const dx = e.clientX - session.startX;
      const dy = e.clientY - session.startY;
      const { startCrop } = session;

      if (session.kind.type === 'edge') {
        let delta = 0;
        switch (session.kind.edge) {
          case 'left':
            delta = dx;
            break;
          case 'right':
            delta = dx;
            break;
          case 'top':
            delta = dy;
            break;
          case 'bottom':
            delta = dy;
            break;
        }
        const nextRect = applyCropEdge(
          startCrop.rect,
          session.kind.edge,
          delta,
          frameW,
          frameH
        );
        onCropChange({ ...startCrop, rect: nextRect }, false);
        return;
      }

      const { corner } = session.kind;
      let diagonal = 0;
      switch (corner) {
        case 'se':
          diagonal = (dx + dy) / 2;
          break;
        case 'sw':
          diagonal = (-dx + dy) / 2;
          break;
        case 'ne':
          diagonal = (dx - dy) / 2;
          break;
        case 'nw':
          diagonal = (-dx - dy) / 2;
          break;
      }
      const denom = Math.max(session.startDisplay.width, session.startDisplay.height, 48);
      const scaleFactor = 1 + diagonal / denom;
      const next = scaleImageInCrop(startCrop, base, frameW, frameH, scaleFactor);
      onCropChange(next, false);
    },
    [base, frameW, frameH, onCropChange]
  );

  const onHandlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!sessionRef.current) return;
      sessionRef.current = null;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      onCropChange(crop, true);
    },
    [crop, onCropChange]
  );

  const edgeStyle = (edge: CropEdge): React.CSSProperties => {
    const midX = rectPx.x + rectPx.width / 2;
    const midY = rectPx.y + rectPx.height / 2;
    switch (edge) {
      case 'left':
        return {
          left: rectPx.x - HANDLE / 2,
          top: midY - HANDLE / 2,
          width: HANDLE,
          height: HANDLE,
          cursor: 'ew-resize',
        };
      case 'right':
        return {
          left: rectPx.x + rectPx.width - HANDLE / 2,
          top: midY - HANDLE / 2,
          width: HANDLE,
          height: HANDLE,
          cursor: 'ew-resize',
        };
      case 'top':
        return {
          left: midX - HANDLE / 2,
          top: rectPx.y - HANDLE / 2,
          width: HANDLE,
          height: HANDLE,
          cursor: 'ns-resize',
        };
      case 'bottom':
        return {
          left: midX - HANDLE / 2,
          top: rectPx.y + rectPx.height - HANDLE / 2,
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
          left: rectPx.x - CORNER / 2,
          top: rectPx.y - CORNER / 2,
          cursor: 'nwse-resize',
        };
      case 'ne':
        return {
          left: rectPx.x + rectPx.width - CORNER / 2,
          top: rectPx.y - CORNER / 2,
          cursor: 'nesw-resize',
        };
      case 'sw':
        return {
          left: rectPx.x - CORNER / 2,
          top: rectPx.y + rectPx.height - CORNER / 2,
          cursor: 'nesw-resize',
        };
      case 'se':
        return {
          left: rectPx.x + rectPx.width - CORNER / 2,
          top: rectPx.y + rectPx.height - CORNER / 2,
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

  const edges: CropEdge[] = ['left', 'right', 'top', 'bottom'];
  const corners: CropCorner[] = ['nw', 'ne', 'sw', 'se'];

  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-hidden>
      {/* Crop rectangle border + grid */}
      <div
        className="pointer-events-none absolute border-2 border-white/90"
        style={{
          left: rectPx.x,
          top: rectPx.y,
          width: rectPx.width,
          height: rectPx.height,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.45)',
        }}
      >
        <CropGrid w={rectPx.width} h={rectPx.height} />
      </div>

      {edges.map((edge) => (
        <div
          key={edge}
          className="pointer-events-auto absolute flex items-center justify-center"
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
          className="pointer-events-auto absolute flex items-center justify-center"
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
