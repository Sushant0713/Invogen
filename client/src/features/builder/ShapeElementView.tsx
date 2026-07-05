import { useMemo } from 'react';
import type { CanvasElement } from '@invogen/shared';
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

  const clipStyle = shapeClipStyle(clip);
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
      <ShapeView type={element.type} props={props} />
    </div>
  );
}
