import { memo } from 'react';
import type { ImageCropTransform } from './types';
import type { CoverBaseSize } from './cropUtils';
import { getDisplayedImageSize } from './cropUtils';
import { rectToPixels } from './cropRect';
import { CroppedImageDisplay } from './CroppedImageDisplay';
import { CropModeHandles } from './CropModeHandles';
import { useImageCrop } from './hooks/useImageCrop';
import type { ImageProps } from '../image-components';
import { buildImageFilter } from '../image-components';

interface Props {
  src: string;
  alt: string;
  frameW: number;
  frameH: number;
  base: CoverBaseSize;
  crop: ImageCropTransform;
  image: ImageProps;
  onCropChange: (crop: ImageCropTransform, recordHistory?: boolean) => void;
}

function CropModeEditorInner({
  src,
  alt,
  frameW,
  frameH,
  base,
  crop,
  image,
  onCropChange,
}: Props) {
  const panHandlers = useImageCrop({
    enabled: true,
    crop,
    base,
    frameW,
    frameH,
    onChange: onCropChange,
  });

  const display = getDisplayedImageSize(crop, base);
  const rectPx = rectToPixels(crop.rect, frameW, frameH);
  const filter = buildImageFilter(image);
  const dim = 'rgba(0,0,0,0.55)';

  const flipScale = image.flipX && image.flipY
    ? 'scale(-1,-1)'
    : image.flipX
      ? 'scaleX(-1)'
      : image.flipY
        ? 'scaleY(-1)'
        : '';

  const imgTransform = [`rotate(${crop.rotation}deg)`, flipScale].filter(Boolean).join(' ');

  return (
    <div
      className="relative h-full w-full"
      style={{ overflow: 'visible' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Full image — draggable to reposition inside crop mask */}
      <div
        className="absolute inset-0 overflow-visible"
        style={{ zIndex: 1 }}
        {...panHandlers}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="absolute max-w-none cursor-grab select-none active:cursor-grabbing"
          style={{
            left: crop.offsetX,
            top: crop.offsetY,
            width: display.width,
            height: display.height,
            transform: imgTransform || undefined,
            transformOrigin: 'center center',
            filter,
          }}
        />
      </div>

      {/* Dim regions outside the crop rectangle */}
      {rectPx.y > 0 && (
        <div
          className="pointer-events-none absolute left-0 right-0 z-10"
          style={{ top: 0, height: rectPx.y, background: dim }}
        />
      )}
      {rectPx.y + rectPx.height < frameH && (
        <div
          className="pointer-events-none absolute left-0 right-0 z-10"
          style={{ top: rectPx.y + rectPx.height, height: frameH - rectPx.y - rectPx.height, background: dim }}
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

      {/* Crop handles: sides crop edges, corners scale image */}
      <CropModeHandles
        crop={crop}
        base={base}
        frameW={frameW}
        frameH={frameH}
        onCropChange={onCropChange}
      />

      {/* Clip preview of final result */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" style={{ borderRadius: image.borderRadius }}>
        <CroppedImageDisplay
          src={src}
          alt={alt}
          frameW={frameW}
          frameH={frameH}
          base={base}
          crop={crop}
          image={image}
        />
      </div>
    </div>
  );
}

export const CropModeEditor = memo(CropModeEditorInner);
