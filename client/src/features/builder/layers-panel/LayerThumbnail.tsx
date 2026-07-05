import { memo } from 'react';
import type { CanvasElement } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { getAssetIcon } from '../asset-library/asset-icons';
import { isImageComponentType } from '../image-components';
import { isShapeComponentType, getShapeDefaultProps } from '../shape-components';
import { ShapeView } from '@/features/document-editor/object-renderer/ShapeView';
import { resolveBrandingImageSrc } from '../company-branding';
import { useCompanyBranding } from '../CompanyBrandingProvider';
import { isTextStylable } from '../text-styles';

interface Props {
  element: CanvasElement;
  className?: string;
}

function LayerThumbnailInner({ element, className = '' }: Props) {
  const branding = useCompanyBranding();
  const props = (element.props ?? {}) as Record<string, unknown>;
  const shapeProps = isShapeComponentType(element.type)
    ? { ...getShapeDefaultProps(element.type), ...props }
    : props;
  const Icon = getAssetIcon(element.type);

  const imageSrc = isImageComponentType(element.type)
    ? resolveBrandingImageSrc(element.type, typeof props.src === 'string' ? props.src : '', branding)
    : undefined;

  const textContent =
    typeof props.content === 'string'
      ? props.content
      : typeof props.text === 'string'
        ? props.text
        : '';

  return (
    <div
      className={`flex h-9 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200/50 bg-white ${className}`}
    >
      {isShapeComponentType(element.type) ? (
        <div className="h-full w-full p-0.5">
          <ShapeView type={element.type} props={shapeProps} />
        </div>
      ) : imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          className="max-h-full max-w-full object-contain"
          draggable={false}
        />
      ) : isTextStylable(element.type) && textContent.trim() ? (
        <span
          className="line-clamp-2 px-0.5 text-center leading-tight text-gray-600"
          style={{
            fontSize: Math.max(6, Math.min(9, 72 / Math.max(textContent.length, 4))),
            fontWeight: element.type === ComponentType.HEADING ? 700 : 400,
          }}
        >
          {textContent.trim().slice(0, 24)}
        </span>
      ) : element.type === ComponentType.WATERMARK ? (
        <span className="text-[8px] font-bold uppercase tracking-wider text-gray-300">WM</span>
      ) : (
        <Icon className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
      )}
    </div>
  );
}

export const LayerThumbnail = memo(
  LayerThumbnailInner,
  (prev, next) =>
    prev.element.id === next.element.id
    && prev.element.type === next.element.type
    && prev.element.width === next.element.width
    && prev.element.height === next.element.height
    && prev.element.props === next.element.props
    && prev.className === next.className
);
