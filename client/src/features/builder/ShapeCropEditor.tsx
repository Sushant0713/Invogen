import { memo } from 'react';
import { ShapeView } from '@/features/document-editor/object-renderer/ShapeView';
import type { CropRect } from './image-editor/types';
import type { NormalizedPoint, ShapeClip } from './shape-clip';
import { rectToPixels, shapeClipStyle } from './shape-clip';
import { ShapeClipHandles } from './ShapeClipHandles';
import { ShapePolygonClipHandles, ShapePolygonDimOverlay } from './ShapePolygonClipHandles';

interface Props {
  type: string;
  props: Record<string, unknown>;
  clip: ShapeClip;
  frameW: number;
  frameH: number;
  onClipChange: (clip: ShapeClip, recordHistory?: boolean) => void;
}

function ShapeCropEditorInner({
  type,
  props,
  clip,
  frameW,
  frameH,
  onClipChange,
}: Props) {
  const rectPx = rectToPixels(clip.rect, frameW, frameH);
  const clipStyle = shapeClipStyle(clip);

  const handleRectChange = (rect: CropRect, recordHistory?: boolean) => {
    onClipChange({ ...clip, mode: 'rect', rect }, recordHistory);
  };

  const handlePolygonChange = (polygon: NormalizedPoint[], recordHistory?: boolean) => {
    onClipChange({ ...clip, mode: 'polygon', polygon }, recordHistory);
  };

  return (
    <div className="relative h-full w-full">
      <div className="h-full w-full" style={clipStyle}>
        <ShapeView type={type} props={props} />
      </div>

      {clip.mode === 'rect' ? (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div
            className="absolute left-0 right-0 bg-black/45"
            style={{ top: 0, height: rectPx.y }}
          />
          <div
            className="absolute left-0 right-0 bg-black/45"
            style={{ top: rectPx.y + rectPx.height, bottom: 0 }}
          />
          <div
            className="absolute bg-black/45"
            style={{ top: rectPx.y, left: 0, width: rectPx.x, height: rectPx.height }}
          />
          <div
            className="absolute bg-black/45"
            style={{
              top: rectPx.y,
              left: rectPx.x + rectPx.width,
              right: 0,
              height: rectPx.height,
            }}
          />
        </div>
      ) : (
        <ShapePolygonDimOverlay polygon={clip.polygon} frameW={frameW} frameH={frameH} />
      )}

      {clip.mode === 'rect' ? (
        <ShapeClipHandles
          clip={clip.rect}
          frameW={frameW}
          frameH={frameH}
          onClipChange={handleRectChange}
        />
      ) : (
        <ShapePolygonClipHandles
          polygon={clip.polygon}
          frameW={frameW}
          frameH={frameH}
          onPolygonChange={handlePolygonChange}
        />
      )}
    </div>
  );
}

export const ShapeCropEditor = memo(ShapeCropEditorInner);
