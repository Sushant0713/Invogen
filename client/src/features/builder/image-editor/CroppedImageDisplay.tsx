import { memo } from 'react';
import type { ImageCropTransform } from './types';
import type { CoverBaseSize } from './cropUtils';
import { getDisplayedImageSize } from './cropUtils';
import { rectToPixels } from './cropRect';
import { buildImageFilter } from '../image-components';
import type { ImageProps } from '../image-components';

interface Props {
  src: string;
  alt: string;
  frameW: number;
  frameH: number;
  base: CoverBaseSize;
  crop: ImageCropTransform;
  image: ImageProps;
  interactive?: boolean;
  cropHandlers?: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onWheel: (e: React.WheelEvent) => void;
  };
}

function CroppedImageDisplayInner({
  src,
  alt,
  frameW,
  frameH,
  base,
  crop,
  image,
  interactive,
  cropHandlers,
}: Props) {
  const display = getDisplayedImageSize(crop, base);
  const rectPx = rectToPixels(crop.rect, frameW, frameH);
  const filter = buildImageFilter(image);

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
      {...(interactive && cropHandlers
        ? {
            onPointerDown: cropHandlers.onPointerDown,
            onPointerMove: cropHandlers.onPointerMove,
            onPointerUp: cropHandlers.onPointerUp,
            onWheel: cropHandlers.onWheel,
          }
        : {})}
    >
      <div
        className="absolute overflow-hidden"
        style={{
          left: rectPx.x,
          top: rectPx.y,
          width: rectPx.width,
          height: rectPx.height,
          borderRadius: image.borderRadius,
        }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={`absolute max-w-none select-none ${interactive ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
          style={{
            left: crop.offsetX - rectPx.x,
            top: crop.offsetY - rectPx.y,
            width: display.width,
            height: display.height,
            transform: imgTransform || undefined,
            transformOrigin: 'center center',
            filter,
          }}
        />
      </div>
    </div>
  );
}

export const CroppedImageDisplay = memo(CroppedImageDisplayInner);
