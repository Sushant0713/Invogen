import { useCallback, useRef } from 'react';
import { RotateCw } from 'lucide-react';
import { normalizeRotation, snapRotationDegrees } from '../element-rotation';

interface Props {
  centerX: number;
  centerY: number;
  handleX: number;
  handleY: number;
  rotation: number;
  zoom: number;
  onChange: (rotation: number, recordHistory?: boolean) => void;
}

export function RotationHandle({
  centerX,
  centerY,
  handleX,
  handleY,
  rotation,
  zoom,
  onChange,
}: Props) {
  const dragRef = useRef<{ startAngle: number; startRotation: number } | null>(null);

  const getAngle = useCallback(
    (clientX: number, clientY: number) => {
      const dx = clientX / zoom - centerX;
      const dy = clientY / zoom - centerY;
      return (Math.atan2(dy, dx) * 180) / Math.PI;
    },
    [centerX, centerY, zoom]
  );

  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 z-[90] overflow-visible"
        aria-hidden
      >
        <line
          x1={centerX}
          y1={centerY}
          x2={handleX}
          y2={handleY}
          stroke="#3b82f6"
          strokeWidth={1}
        />
      </svg>
      <button
        type="button"
        title="Rotate (hold Shift to snap 15°)"
        className="absolute z-[95] flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#3b82f6] bg-white text-[#3b82f6] shadow-md hover:bg-blue-50"
        style={{
          left: handleX,
          top: handleY,
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
          dragRef.current = {
            startAngle: getAngle(e.clientX, e.clientY),
            startRotation: rotation,
          };
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (!drag) return;
          const angle = getAngle(e.clientX, e.clientY);
          const delta = angle - drag.startAngle;
          const next = snapRotationDegrees(drag.startRotation + delta, e.shiftKey);
          onChange(next, false);
        }}
        onPointerUp={(e) => {
          if (!dragRef.current) return;
          dragRef.current = null;
          (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
          onChange(normalizeRotation(rotation), true);
        }}
      >
        <RotateCw className="h-3.5 w-3.5" />
      </button>
    </>
  );
}
