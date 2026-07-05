import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ComponentType } from '@invogen/shared';
import { ImageIcon, Upload, Barcode } from 'lucide-react';
import type { CanvasElement } from '@invogen/shared';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import { setImageCropMode } from '@/store/slices/builderSlice';
import {
  getImageFrameStyle,
  getImagePlaceholderLabel,
  normalizeImageProps,
} from './image-components';
import {
  getBrandingSettingsLabel,
  isBrandingImageType,
  resolveBrandingImageSrc,
  usesCompanyBrandingSource,
} from './company-branding';
import { useCompanyBranding } from './CompanyBrandingProvider';
import {
  cropTransformToProps,
  defaultCropForFrame,
  getFitBaseSize,
  getImageCropFromProps,
  isDefaultImageCrop,
  normalizeImageCropTransform,
  getImageUploadPatch,
} from './image-editor/cropUtils';
import { CropModeEditor } from './image-editor/CropModeEditor';
import { CroppedImageDisplay } from './image-editor/CroppedImageDisplay';
import type { ImageCropTransform } from './image-editor/types';
import { useImageUpload } from './use-image-upload';

interface Props {
  element: CanvasElement;
  props: Record<string, unknown>;
  isSelected?: boolean;
  onSelect?: () => void;
  onUpdateProps?: (patch: Record<string, unknown>, recordHistory?: boolean) => void;
}

function ImageViewInner({
  element,
  props,
  isSelected,
  onSelect,
  onUpdateProps,
}: Props) {
  const dispatch = useAppDispatch();
  const imageCropElementId = useAppSelector((s) => s.builder.imageCropElementId);
  const isCropMode = imageCropElementId === element.id;

  const branding = useCompanyBranding();
  const image = normalizeImageProps(props);
  const fromSettings = usesCompanyBrandingSource(element.type, image.src);
  const src = resolveBrandingImageSrc(element.type, image.src, branding);
  const label = getImagePlaceholderLabel(element.type);
  const brandingLabel = getBrandingSettingsLabel(element.type);
  const barcodeValue = typeof props.value === 'string' ? props.value : '';
  const isBarcode = element.type === ComponentType.BARCODE;
  const isReferenceBg = props.isReferenceBackground === true;

  const [naturalSize, setNaturalSize] = useState({
    w: image.imageNaturalW ?? 0,
    h: image.imageNaturalH ?? 0,
  });
  const loadedSrcRef = useRef<string | undefined>(src);

  useEffect(() => {
    if (!src) {
      loadedSrcRef.current = undefined;
      setNaturalSize({ w: 0, h: 0 });
      return;
    }

    const srcChanged = loadedSrcRef.current !== src;
    if (!srcChanged && image.imageNaturalW && image.imageNaturalH) {
      setNaturalSize({ w: image.imageNaturalW, h: image.imageNaturalH });
      return;
    }

    let cancelled = false;
    if (srcChanged) {
      setNaturalSize({ w: 0, h: 0 });
    }

    const img = new Image();
    img.onload = () => {
      if (cancelled || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;

      loadedSrcRef.current = src;
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });

      const fit = image.objectFit ?? 'contain';
      const storedCrop = props.imageCrop
        ? normalizeImageCropTransform(props.imageCrop)
        : null;
      const shouldResetCrop =
        srcChanged || !storedCrop || isDefaultImageCrop(storedCrop);

      onUpdateProps?.(
        {
          imageNaturalW: img.naturalWidth,
          imageNaturalH: img.naturalHeight,
          ...(shouldResetCrop
            ? cropTransformToProps(
                defaultCropForFrame(
                  element.width,
                  element.height,
                  img.naturalWidth,
                  img.naturalHeight,
                  fit
                )
              )
            : {}),
        },
        false
      );
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, image.imageNaturalW, image.imageNaturalH, image.objectFit, props.imageCrop, element.width, element.height, onUpdateProps]);

  const base = useMemo(
    () =>
      getFitBaseSize(
        element.width,
        element.height,
        naturalSize.w,
        naturalSize.h,
        image.objectFit ?? 'contain'
      ),
    [element.width, element.height, naturalSize.w, naturalSize.h, image.objectFit]
  );

  const crop = useMemo(() => {
    if (naturalSize.w > 0 && naturalSize.h > 0) {
      return getImageCropFromProps(props, element.width, element.height);
    }
    return image.imageCrop ?? defaultCropForFrame(element.width, element.height, 1, 1);
  }, [props, element.width, element.height, naturalSize, image.imageCrop]);

  const { input, pickFile, uploading } = useImageUpload((url) => {
    loadedSrcRef.current = undefined;
    onUpdateProps?.(getImageUploadPatch(url), true);
    dispatch(setImageCropMode(element.id));
  });

  const handleCropChange = (next: ImageCropTransform, recordHistory?: boolean) => {
    onUpdateProps?.(cropTransformToProps(next), recordHistory);
  };

  const openUpload = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    onSelect?.();
    pickFile();
  };

  const enterCrop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    onSelect?.();
    if (naturalSize.w > 0 && !props.imageCrop) {
      onUpdateProps?.(
        {
          ...cropTransformToProps(
            defaultCropForFrame(
              element.width,
              element.height,
              naturalSize.w,
              naturalSize.h,
              image.objectFit ?? 'contain'
            )
          ),
        },
        false
      );
    }
    dispatch(setImageCropMode(element.id));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isSelected && !isCropMode) {
      e.stopPropagation();
    }
  };

  if (!src) {
    return (
      <div
        className="builder-image-surface flex h-full min-h-[80px] w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 bg-gray-50 p-2 text-gray-400"
        style={{ borderRadius: image.borderRadius }}
        onPointerDown={handlePointerDown}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.();
        }}
        onDoubleClick={openUpload}
      >
        {input}
        {uploading ? (
          <span className="text-xs">Uploading…</span>
        ) : (
          <>
            {isBarcode ? (
              <Barcode className="h-8 w-8 opacity-60" />
            ) : (
              <ImageIcon className="h-8 w-8 opacity-60" />
            )}
            <span className="text-xs font-medium text-gray-500">{label}</span>
            {isBrandingImageType(element.type) && (
              <span className="max-w-[180px] text-center text-[10px] text-gray-400">
                {fromSettings
                  ? `Upload ${brandingLabel} in company settings, or override here`
                  : `Using ${brandingLabel} from company settings`}
              </span>
            )}
            {isBarcode && barcodeValue && (
              <span className="font-mono text-[10px] text-gray-400">{barcodeValue}</span>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:border-primary/30 hover:text-primary"
              onClick={openUpload}
            >
              <Upload className="h-3.5 w-3.5" />
              {isBarcode
                ? 'Upload barcode'
                : isBrandingImageType(element.type)
                  ? 'Override image'
                  : 'Upload image'}
            </button>
            {!isBrandingImageType(element.type) && (
              <span className="text-[10px] text-gray-400">or double-click</span>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className="builder-image-surface relative h-full min-h-[40px] w-full"
      style={getImageFrameStyle(image)}
      onPointerDown={handlePointerDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onDoubleClick={enterCrop}
    >
      {input}
      {fromSettings && !isCropMode && (
        <div className="pointer-events-none absolute left-2 top-2 z-30 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white">
          From settings
        </div>
      )}
      {isReferenceBg && !isCropMode && (
        <div className="pointer-events-none absolute left-2 top-2 z-30 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white">
          Reference — delete when finished
        </div>
      )}
      {isBarcode && barcodeValue && !isCropMode && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 bg-white/90 py-0.5 text-center font-mono text-[10px] text-gray-600">
          {barcodeValue}
        </div>
      )}
      {isCropMode && naturalSize.w > 0 ? (
        <CropModeEditor
          src={src}
          alt={image.alt || label}
          frameW={element.width}
          frameH={element.height}
          base={base}
          crop={crop}
          image={image}
          onCropChange={handleCropChange}
        />
      ) : naturalSize.w > 0 ? (
        <CroppedImageDisplay
          src={src}
          alt={image.alt || label}
          frameW={element.width}
          frameH={element.height}
          base={base}
          crop={crop}
          image={image}
        />
      ) : (
        <img
          src={src}
          alt={image.alt || label}
          className="pointer-events-none h-full w-full object-contain"
        />
      )}
    </div>
  );
}

export const ImageView = memo(ImageViewInner);
