import { useMemo } from 'react';
import type { CanvasElement } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import { setShapeCropMode } from '@/store/slices/builderSlice';
import { ShapeView } from '@/features/document-editor/object-renderer/ShapeView';
import { ShapeCropEditor } from './ShapeCropEditor';
import {
  getShapeClipFromProps,
  isDefaultShapeClip,
  shapeClipStyle,
  shapeClipToProps,
  type ShapeClip,
} from './shape-clip';

interface Props {
  element: CanvasElement;
  props: Record<string, unknown>;
  isSelected?: boolean;
  onUpdateProps?: (patch: Record<string, unknown>, recordHistory?: boolean) => void;
}

/** SVG polygon for cropped rectangles — survives PDF print better than CSS clip-path alone. */
function CroppedRectSvg({
  clip,
  props,
}: {
  clip: ShapeClip;
  props: Record<string, unknown>;
}) {
  const fill = typeof props.fill === 'string' ? props.fill : 'transparent';
  const stroke = typeof props.stroke === 'string' ? props.stroke : '#111827';
  const strokeWidth = typeof props.strokeWidth === 'number' ? props.strokeWidth : 0;
  const points = clip.polygon.map((p) => `${p.x * 100},${p.y * 100}`).join(' ');

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="h-full w-full"
      style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}
      aria-hidden
    >
      <polygon
        points={points}
        fill={fill}
        stroke={strokeWidth > 0 ? stroke : 'none'}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function canRenderAsCroppedSvg(type: string, clip: ShapeClip): boolean {
  if (clip.mode !== 'polygon' || isDefaultShapeClip(clip)) return false;
  return (
    type === ComponentType.RECTANGLE
    || type === ComponentType.ROUNDED_RECT
  );
}

export function ShapeElementView({ element, props, isSelected, onUpdateProps }: Props) {
  const dispatch = useAppDispatch();
  const shapeCropElementId = useAppSelector((s) => s.builder.shapeCropElementId);
  const isCropMode = shapeCropElementId === element.id;
  const clip = useMemo(() => getShapeClipFromProps(props), [props]);

  const handleClipChange = (next: ShapeClip, recordHistory?: boolean) => {
    onUpdateProps?.({ ...props, ...shapeClipToProps(next) }, recordHistory);
  };

  if (isCropMode) {
    return (
      <ShapeCropEditor
        type={element.type}
        props={props}
        clip={clip}
        frameW={element.width}
        frameH={element.height}
        onClipChange={handleClipChange}
      />
    );
  }

  const useSvgCrop = canRenderAsCroppedSvg(element.type, clip);
  const clipStyle = useSvgCrop ? undefined : shapeClipStyle(clip);
  const hasClip = !isDefaultShapeClip(clip);

  return (
    <div
      className="h-full w-full"
      style={clipStyle}
      onDoubleClick={(e) => {
        if (element.locked) return;
        e.stopPropagation();
        dispatch(setShapeCropMode(element.id));
      }}
      title={isSelected && !hasClip ? 'Double-click to cut shape' : undefined}
    >
      {useSvgCrop ? (
        <CroppedRectSvg clip={clip} props={props} />
      ) : (
        <ShapeView type={element.type} props={props} />
      )}
    </div>
  );
}
