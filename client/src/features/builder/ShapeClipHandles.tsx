import { memo, useCallback, useRef } from 'react';
import type { CropCorner, CropEdge, CropRect } from './image-editor/types';
import { applyCropEdge, rectToPixels } from './image-editor/cropRect';
import { applyCropCorner } from './shape-clip';

type HandleKind =
  | { type: 'edge'; edge: CropEdge }
  | { type: 'corner'; corner: CropCorner };

interface Props {
  clip: CropRect;
  frameW: number;
  frameH: number;
  onClipChange: (clip: CropRect, recordHistory?: boolean) => void;
}

const HANDLE = 14;
const CORNER = 18;

function ShapeClipHandlesInner({ clip, frameW, frameH, onClipChange }: Props) {
  const sessionRef = useRef<{
    kind: HandleKind;
    startX: number;
    startY: number;
    startClip: CropRect;
  } | null>(null);

  const rectPx = rectToPixels(clip, frameW, frameH);

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent, kind: HandleKind) => {
      e.stopPropagation();
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      sessionRef.current = {
        kind,
        startX: e.clientX,
        startY: e.clientY,
        startClip: clip,
      };
    },
    [clip]
  );

  const onHandlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const session = sessionRef.current;
      if (!session) return;
      const dx = e.clientX - session.startX;
      const dy = e.clientY - session.startY;

      if (session.kind.type === 'edge') {
        const next = applyCropEdge(
          session.startClip,
          session.kind.edge,
          session.kind.edge === 'left' || session.kind.edge === 'right' ? dx : dy,
          frameW,
          frameH
        );
        onClipChange(next, false);
        return;
      }

      const next = applyCropCorner(
        session.startClip,
        session.kind.corner,
        dx,
        dy,
        frameW,
        frameH
      );
      onClipChange(next, false);
    },
    [frameW, frameH, onClipChange]
  );

  const onHandlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!sessionRef.current) return;
      sessionRef.current = null;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      onClipChange(clip, true);
    },
    [clip, onClipChange]
  );

  const edgeStyle = (edge: CropEdge): React.CSSProperties => {
    const midX = rectPx.x + rectPx.width / 2;
    const midY = rectPx.y + rectPx.height / 2;
    switch (edge) {
      case 'left':
        return { left: rectPx.x - HANDLE / 2, top: midY - HANDLE / 2, width: HANDLE, height: HANDLE };
      case 'right':
        return { left: rectPx.x + rectPx.width - HANDLE / 2, top: midY - HANDLE / 2, width: HANDLE, height: HANDLE };
      case 'top':
        return { left: midX - HANDLE / 2, top: rectPx.y - HANDLE / 2, width: HANDLE, height: HANDLE };
      case 'bottom':
        return { left: midX - HANDLE / 2, top: rectPx.y + rectPx.height - HANDLE / 2, width: HANDLE, height: HANDLE };
    }
  };

  const cornerStyle = (corner: CropCorner): React.CSSProperties => {
    switch (corner) {
      case 'nw':
        return { left: rectPx.x - CORNER / 2, top: rectPx.y - CORNER / 2, width: CORNER, height: CORNER };
      case 'ne':
        return { left: rectPx.x + rectPx.width - CORNER / 2, top: rectPx.y - CORNER / 2, width: CORNER, height: CORNER };
      case 'sw':
        return { left: rectPx.x - CORNER / 2, top: rectPx.y + rectPx.height - CORNER / 2, width: CORNER, height: CORNER };
      case 'se':
        return { left: rectPx.x + rectPx.width - CORNER / 2, top: rectPx.y + rectPx.height - CORNER / 2, width: CORNER, height: CORNER };
    }
  };

  const grip = (
    <span
      className="block h-3.5 w-3.5 rounded-full border-2 border-primary bg-white shadow-[0_1px_4px_rgba(0,0,0,0.25)]"
      aria-hidden
    />
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-hidden>
      <div
        className="pointer-events-none absolute border-2 border-white/90"
        style={{
          left: rectPx.x,
          top: rectPx.y,
          width: rectPx.width,
          height: rectPx.height,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
        }}
      />
      {(['left', 'right', 'top', 'bottom'] as CropEdge[]).map((edge) => (
        <div
          key={edge}
          className="shape-clip-handle pointer-events-auto absolute flex items-center justify-center"
          style={edgeStyle(edge)}
          onPointerDown={(e) => onHandlePointerDown(e, { type: 'edge', edge })}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        >
          {grip}
        </div>
      ))}
      {(['nw', 'ne', 'sw', 'se'] as CropCorner[]).map((corner) => (
        <div
          key={corner}
          className="shape-clip-handle pointer-events-auto absolute flex items-center justify-center"
          style={cornerStyle(corner)}
          onPointerDown={(e) => onHandlePointerDown(e, { type: 'corner', corner })}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        >
          {grip}
        </div>
      ))}
    </div>
  );
}

export const ShapeClipHandles = memo(ShapeClipHandlesInner);
