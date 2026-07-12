import { memo, useCallback } from 'react';
import type { ImageCropTransform } from './types';
import type { CoverBaseSize } from './cropUtils';
import { zoomCropAtPoint } from './cropUtils';
import { rectToPixels } from './cropRect';
import { CroppedImageDisplay } from './CroppedImageDisplay';
import { CropModeHandles, type CropFrameBounds } from './CropModeHandles';
import { useImageCrop } from './hooks/useImageCrop';
import type { ImageProps } from '../image-components';
import type { ElementBounds } from '../element-resize';

interface Props {
  src: string;
  alt: string;
  frameW: number;
  frameH: number;
  base: CoverBaseSize;
  crop: ImageCropTransform;
  image: ImageProps;
  zoom?: number;
  frameBounds: CropFrameBounds;
  /** When true, drag/wheel pan and zoom the image inside the frame. */
  panEnabled?: boolean;
  onCropChange: (crop: ImageCropTransform, recordHistory?: boolean) => void;
  onFrameResize?: (bounds: ElementBounds, recordHistory?: boolean) => void;
}

function CropModeEditorInner({
  src,
  alt,
  frameW,
  frameH,
  base,
  crop,
  image,
  zoom,
  frameBounds,
  panEnabled = false,
  onCropChange,
  onFrameResize,
}: Props) {
  const panHandlers = useImageCrop({
    enabled: panEnabled,
    crop,
    base,
    frameW,
    frameH,
    onChange: onCropChange,
  });

  const rectPx = rectToPixels(crop.rect, frameW, frameH);
  const dim = 'rgba(0,0,0,0.45)';

  const isPartialCrop =
    crop.rect.x > 0.001
    || crop.rect.y > 0.001
    || crop.rect.width < 0.999
    || crop.rect.height < 0.999;
  const showDim = panEnabled || isPartialCrop;

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!panEnabled) return;
      panHandlers.onWheel(e);
    },
    [panEnabled, panHandlers]
  );

  return (
    <div
      className="relative h-full w-full"
      style={{ overflow: 'visible' }}
      onWheel={onWheel}
    >
      <CroppedImageDisplay
        src={src}
        alt={alt}
        frameW={frameW}
        frameH={frameH}
        base={base}
        crop={crop}
        image={image}
        interactive={panEnabled}
        cropHandlers={panEnabled ? panHandlers : undefined}
      />

      {showDim && (
        <>
          {rectPx.y > 0 && (
            <div
              className="pointer-events-none absolute left-0 right-0 z-10"
              style={{ top: 0, height: rectPx.y, background: dim }}
            />
          )}
          {rectPx.y + rectPx.height < frameH && (
            <div
              className="pointer-events-none absolute left-0 right-0 z-10"
              style={{
                top: rectPx.y + rectPx.height,
                height: frameH - rectPx.y - rectPx.height,
                background: dim,
              }}
            />
          )}
          {rectPx.x > 0 && (
            <div
              className="pointer-events-none absolute z-10"
              style={{ left: 0, top: rectPx.y, width: rectPx.x, height: rectPx.height, background: dim }}
            />
          )}
          {rectPx.x + rectPx.width < frameW && (
            <div
              className="pointer-events-none absolute z-10"
              style={{
                left: rectPx.x + rectPx.width,
                top: rectPx.y,
                width: frameW - rectPx.x - rectPx.width,
                height: rectPx.height,
                background: dim,
              }}
            />
          )}
        </>
      )}

      <CropModeHandles
        crop={crop}
        base={base}
        frameW={frameW}
        frameH={frameH}
        zoom={zoom}
        frameBounds={frameBounds}
        panEnabled={panEnabled}
        onCropChange={onCropChange}
        onFrameResize={onFrameResize}
      />
    </div>
  );
}

export const CropModeEditor = memo(CropModeEditorInner);
