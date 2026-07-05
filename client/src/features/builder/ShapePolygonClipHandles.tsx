import { memo, useCallback, useRef, useId } from 'react';
import type { NormalizedPoint } from './shape-clip';
import { movePolygonPoint, polygonToPixelPoints } from './shape-clip';

interface Props {
  polygon: NormalizedPoint[];
  frameW: number;
  frameH: number;
  onPolygonChange: (polygon: NormalizedPoint[], recordHistory?: boolean) => void;
}

const HANDLE = 18;

function ShapePolygonClipHandlesInner({ polygon, frameW, frameH, onPolygonChange }: Props) {
  const sessionRef = useRef<{
    index: number;
    startX: number;
    startY: number;
    startPolygon: NormalizedPoint[];
  } | null>(null);

  const pointsPx = polygonToPixelPoints(polygon, frameW, frameH);
  const polyline = pointsPx.map((p) => `${p.x},${p.y}`).join(' ');

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent, index: number) => {
      e.stopPropagation();
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      sessionRef.current = {
        index,
        startX: e.clientX,
        startY: e.clientY,
        startPolygon: polygon,
      };
    },
    [polygon]
  );

  const onHandlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const session = sessionRef.current;
      if (!session) return;
      const dx = e.clientX - session.startX;
      const dy = e.clientY - session.startY;
      const next = movePolygonPoint(
        session.startPolygon,
        session.index,
        dx,
        dy,
        frameW,
        frameH
      );
      onPolygonChange(next, false);
    },
    [frameW, frameH, onPolygonChange]
  );

  const onHandlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!sessionRef.current) return;
      sessionRef.current = null;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      onPolygonChange(polygon, true);
    },
    [polygon, onPolygonChange]
  );

  const grip = (
    <span
      className="block h-3.5 w-3.5 rounded-full border-2 border-primary bg-white shadow-[0_1px_4px_rgba(0,0,0,0.25)]"
      aria-hidden
    />
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-hidden>
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        <polygon
          points={polyline}
          fill="none"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        <polygon
          points={polyline}
          fill="none"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {pointsPx.map((point, index) => (
        <div
          key={`poly-handle-${index}`}
          className="shape-clip-handle pointer-events-auto absolute flex items-center justify-center"
          style={{
            left: point.x - HANDLE / 2,
            top: point.y - HANDLE / 2,
            width: HANDLE,
            height: HANDLE,
          }}
          onPointerDown={(e) => onHandlePointerDown(e, index)}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        >
          {grip}
        </div>
      ))}
    </div>
  );
}

export const ShapePolygonClipHandles = memo(ShapePolygonClipHandlesInner);

interface DimOverlayProps {
  polygon: NormalizedPoint[];
  frameW: number;
  frameH: number;
}

export function ShapePolygonDimOverlay({ polygon, frameW, frameH }: DimOverlayProps) {
  const maskId = useId();
  const pointsPx = polygonToPixelPoints(polygon, frameW, frameH);
  const polyline = pointsPx.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full">
      <defs>
        <mask id={maskId}>
          <rect width="100%" height="100%" fill="white" />
          <polygon points={polyline} fill="black" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.45)" mask={`url(#${maskId})`} />
    </svg>
  );
}
