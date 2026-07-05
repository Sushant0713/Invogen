import type { CSSProperties, ReactNode } from 'react';
import type { Props as RndProps } from 'react-rnd';

const cornerGrip = (
  <span
    className="builder-corner-grip block h-3.5 w-3.5 rounded-full border-2 border-primary bg-white shadow-[0_1px_4px_rgba(0,0,0,0.25)]"
    aria-hidden
  />
);

const sideGrip = (axis: 'horizontal' | 'vertical') => (
  <span
    className="builder-edge-grip block rounded-full bg-primary shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
    style={
      axis === 'horizontal'
        ? { width: 28, height: 6 }
        : { width: 6, height: 28 }
    }
    aria-hidden
  />
);

/** Canva-style: white circle, gray border, 10px. */
const tableCornerGrip = (
  <span
    className="builder-table-corner-grip block rounded-full border border-gray-400 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
    style={{ width: 10, height: 10 }}
    aria-hidden
  />
);

const tableEdgeGrip = (axis: 'horizontal' | 'vertical') => (
  <span
    className="builder-table-edge-grip block rounded-full border border-gray-400 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
    style={
      axis === 'horizontal'
        ? { width: 10, height: 10 }
        : { width: 10, height: 10 }
    }
    aria-hidden
  />
);

const cornerBox: CSSProperties = {
  width: 18,
  height: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 80,
};

const edgeBox = (extra: CSSProperties): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 80,
  ...extra,
});

export const allResizeEnable = {
  top: true,
  right: true,
  bottom: true,
  left: true,
  topLeft: true,
  topRight: true,
  bottomLeft: true,
  bottomRight: true,
} as const;

export const resizeHandleComponent: NonNullable<RndProps['resizeHandleComponent']> = {
  top: sideGrip('horizontal'),
  right: sideGrip('vertical'),
  bottom: sideGrip('horizontal'),
  left: sideGrip('vertical'),
  topLeft: cornerGrip,
  topRight: cornerGrip,
  bottomLeft: cornerGrip,
  bottomRight: cornerGrip,
};

export const resizeHandleStyles: NonNullable<RndProps['resizeHandleStyles']> = {
  top: edgeBox({ width: '60%', height: 14, top: -7, left: '20%', cursor: 'ns-resize' }),
  right: edgeBox({ width: 14, height: '60%', right: -7, top: '20%', cursor: 'ew-resize' }),
  bottom: edgeBox({ width: '60%', height: 14, bottom: -7, left: '20%', cursor: 'ns-resize' }),
  left: edgeBox({ width: 14, height: '60%', left: -7, top: '20%', cursor: 'ew-resize' }),
  topLeft: { ...cornerBox, left: -5, top: -5, cursor: 'nwse-resize' },
  topRight: { ...cornerBox, right: -5, top: -5, cursor: 'nesw-resize' },
  bottomLeft: { ...cornerBox, left: -5, bottom: -5, cursor: 'nesw-resize' },
  bottomRight: { ...cornerBox, right: -5, bottom: -5, cursor: 'nwse-resize' },
};

/** Canva-style table resize: circular white handles on every edge and corner. */
export const tableResizeHandleComponent: NonNullable<RndProps['resizeHandleComponent']> = {
  top: tableEdgeGrip('horizontal'),
  right: tableEdgeGrip('vertical'),
  bottom: tableEdgeGrip('horizontal'),
  left: tableEdgeGrip('vertical'),
  topLeft: tableCornerGrip,
  topRight: tableCornerGrip,
  bottomLeft: tableCornerGrip,
  bottomRight: tableCornerGrip,
};

export const tableResizeHandleStyles: NonNullable<RndProps['resizeHandleStyles']> = {
  top: edgeBox({ width: 16, height: 16, top: -8, left: '50%', marginLeft: -8, cursor: 'ns-resize' }),
  right: edgeBox({ width: 16, height: 16, right: -8, top: '50%', marginTop: -8, cursor: 'ew-resize' }),
  bottom: edgeBox({ width: 16, height: 16, bottom: -8, left: '50%', marginLeft: -8, cursor: 'ns-resize' }),
  left: edgeBox({ width: 16, height: 16, left: -8, top: '50%', marginTop: -8, cursor: 'ew-resize' }),
  topLeft: { ...cornerBox, left: -8, top: -8, cursor: 'nwse-resize' },
  topRight: { ...cornerBox, right: -8, top: -8, cursor: 'nesw-resize' },
  bottomLeft: { ...cornerBox, left: -8, bottom: -8, cursor: 'nesw-resize' },
  bottomRight: { ...cornerBox, right: -8, bottom: -8, cursor: 'nwse-resize' },
};

export function getElementResizeProps(
  isSelected: boolean,
  locked: boolean,
  isDragging: boolean,
  isEditing: boolean,
  isCropMode = false,
  rotationDeg = 0,
  options?: { canvaTable?: boolean }
): Pick<RndProps, 'enableResizing' | 'resizeHandleComponent' | 'resizeHandleStyles'> {
  if (isCropMode || rotationDeg !== 0) {
    return { enableResizing: false };
  }
  // Tables keep resize handles while selected (even in cell-edit mode).
  if (locked || !isSelected || isDragging || (isEditing && !options?.canvaTable)) {
    return { enableResizing: false };
  }
  if (options?.canvaTable) {
    return {
      enableResizing: allResizeEnable,
      resizeHandleComponent: tableResizeHandleComponent,
      resizeHandleStyles: tableResizeHandleStyles,
    };
  }
  return {
    enableResizing: allResizeEnable,
    resizeHandleComponent,
    resizeHandleStyles,
  };
}

/** Bottom move control — drag only this control to move the table (not the table body). */
export function TableMoveHandle({ active }: { active?: boolean }): ReactNode {
  return (
    <div
      className={`builder-table-move-handle flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-colors hover:border-blue-500 hover:bg-blue-50 ${
        active ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      aria-label="Drag to move table"
      title="Drag to move table"
    >
      {/* Four-way move arrows (Canva-style) */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="text-gray-800"
      >
        <polyline points="5 9 2 12 5 15" />
        <polyline points="9 5 12 2 15 5" />
        <polyline points="15 19 12 22 9 19" />
        <polyline points="19 9 22 12 19 15" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="12" y1="2" x2="12" y2="22" />
      </svg>
    </div>
  );
}
