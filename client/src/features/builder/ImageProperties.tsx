import { useState } from 'react';
import { ComponentType } from '@invogen/shared';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Trash2,
  Upload,
  Sun,
  Contrast,
  Droplets,
  Wind,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  RotateCw,
  RefreshCw,
  Crop,
} from 'lucide-react';
import {
  type ImageObjectFit,
  normalizeImageProps,
} from './image-components';
import {
  getBrandingSettingsLabel,
  isBrandingImageType,
  resolveBrandingImageSrc,
  usesCompanyBrandingSource,
} from './company-branding';
import { useCompanyBranding } from './CompanyBrandingProvider';
import { getImageUploadPatch } from './image-crop';
import { useImageUpload } from './use-image-upload';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import { setImageCropMode } from '@/store/slices/builderSlice';

const FIT_OPTIONS: { value: ImageObjectFit; label: string }[] = [
  { value: 'contain', label: 'Fit (show all)' },
  { value: 'cover', label: 'Fill frame' },
  { value: 'fill', label: 'Stretch' },
];

interface Props {
  elementType: string;
  elementId: string;
  props: Record<string, unknown>;
  onChange: (key: string, value: unknown, recordHistory?: boolean) => void;
  onChangeMany: (patch: Record<string, unknown>, recordHistory?: boolean) => void;
}

// ── Collapsible section wrapper ───────────────────────────────────────────────

function Section({
  title,
  icon,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between bg-gray-50 px-3 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-gray-500">{icon}</span>}
          <span className="text-xs font-semibold text-gray-700">{title}</span>
          {badge && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {badge}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        )}
      </button>
      {open && <div className="px-3 py-3 space-y-3">{children}</div>}
    </div>
  );
}

// ── Slider with label + reset ─────────────────────────────────────────────────

function PropSlider({
  label,
  icon,
  propKey,
  value,
  min,
  max,
  defaultValue,
  onChange,
  onCommit,
}: {
  label: string;
  icon?: React.ReactNode;
  propKey: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  onChange: (key: string, v: number, record?: boolean) => void;
  onCommit: (key: string, v: number, record?: boolean) => void;
}) {
  const isChanged = value !== defaultValue;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          {icon}
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-8 text-right text-xs tabular-nums text-gray-400">{value}</span>
          {isChanged && (
            <button
              type="button"
              title={`Reset ${label}`}
              onClick={() => onCommit(propKey, defaultValue, true)}
              className="text-gray-300 hover:text-primary"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(propKey, Number(e.target.value), false)}
        onPointerUp={(e) => onCommit(propKey, Number((e.target as HTMLInputElement).value), true)}
        className="h-4 w-full cursor-pointer accent-primary"
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ImageProperties({
  elementType,
  elementId,
  props,
  onChange,
  onChangeMany,
}: Props) {
  const dispatch = useAppDispatch();
  const isCropMode = useAppSelector((s) => s.builder.imageCropElementId === elementId);
  const branding = useCompanyBranding();
  const image = normalizeImageProps(props);
  const isBrandingType = isBrandingImageType(elementType);
  const fromSettings = usesCompanyBrandingSource(elementType, image.src);
  const previewSrc = resolveBrandingImageSrc(elementType, image.src, branding);
  const brandingLabel = getBrandingSettingsLabel(elementType);
  const isBarcode = elementType === ComponentType.BARCODE;
  const barcodeValue = typeof props.value === 'string' ? props.value : '';

  const { input, pickFile, uploading } = useImageUpload((url) => {
    onChangeMany(getImageUploadPatch(url), true);
  });

  const rotation = image.rotation ?? 0;
  const rotateBy = (delta: number) => {
    const next = ((rotation + delta) % 360 + 360) % 360;
    onChange('rotation', next, true);
  };

  const hasAdjustments =
    (image.brightness ?? 100) !== 100 ||
    (image.contrast ?? 100) !== 100 ||
    (image.saturate ?? 100) !== 100 ||
    (image.blur ?? 0) !== 0;

  const shadowOn = !!image.shadowEnabled;

  return (
    <div className="space-y-3">
      {input}

      {isBrandingType && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-gray-600">
          {fromSettings ? (
            <p>
              Uses your {brandingLabel} from company settings. Upload below to override for this template only.
            </p>
          ) : (
            <p>
              Custom image override. Clear it to use the {brandingLabel} from company settings again.
            </p>
          )}
        </div>
      )}

      {/* ── Image preview ─────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        {previewSrc ? (
          <img
            src={previewSrc}
            alt=""
            className="mx-auto max-h-36 w-full object-contain p-2"
            style={{
              filter: [
                (image.brightness ?? 100) !== 100 ? `brightness(${image.brightness}%)` : '',
                (image.contrast ?? 100) !== 100 ? `contrast(${image.contrast}%)` : '',
                (image.saturate ?? 100) !== 100 ? `saturate(${image.saturate}%)` : '',
                (image.blur ?? 0) > 0 ? `blur(${image.blur}px)` : '',
              ].filter(Boolean).join(' ') || undefined,
            }}
          />
        ) : (
          <div className="flex h-28 items-center justify-center text-xs text-gray-400">
            {isBarcode
              ? 'No barcode image yet'
              : isBrandingType
                ? `No ${brandingLabel} in settings`
                : 'No image yet'}
          </div>
        )}
      </div>

      {/* ── Upload / Crop / Remove ────────────────────── */}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="flex-1"
          onClick={pickFile}
          disabled={uploading}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {uploading ? 'Uploading…' : previewSrc ? 'Replace' : isBarcode ? 'Upload barcode' : isBrandingType ? 'Override' : 'Upload'}
        </Button>
        {previewSrc && (
          <Button
            type="button"
            size="sm"
            variant={isCropMode ? 'primary' : 'secondary'}
            onClick={() => dispatch(setImageCropMode(isCropMode ? null : elementId))}
            title={isCropMode ? 'Done repositioning' : 'Pan / zoom inside frame'}
          >
            <Crop className="h-3.5 w-3.5" />
          </Button>
        )}
        {previewSrc && (image.src || isBrandingType) && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              isBrandingType
                ? onChangeMany({ src: '', useCompanyBranding: true }, true)
                : onChange('src', '', true)
            }
            title={isBrandingType && !image.src ? 'No custom override to remove' : 'Remove image'}
            disabled={isBrandingType && !image.src}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {previewSrc && (
        <p className="text-[11px] text-gray-400">
          {isCropMode
            ? 'Drag to reposition · scroll to zoom · Esc to finish'
            : 'Drag side edges to crop · corners to scale · drag box to move'}
        </p>
      )}

      {/* ── Barcode value ─────────────────────────────── */}
      {isBarcode && (
        <div>
          <label className="text-xs text-gray-500">Barcode value</label>
          <p className="mt-0.5 text-[11px] text-gray-400">
            Shown under the barcode on the invoice (e.g. product or invoice number).
          </p>
          <input
            type="text"
            className="mt-1 w-full rounded-lg border p-2 font-mono text-sm"
            placeholder="1234567890"
            value={barcodeValue}
            onChange={(e) => onChange('value', e.target.value)}
            onBlur={(e) => onChange('value', e.target.value, true)}
          />
        </div>
      )}

      {/* ── Image URL ────────────────────────────────── */}
      <div>
        <label className="text-xs text-gray-500">Image URL</label>
        <input
          type="url"
          className="mt-1 w-full rounded-lg border p-2 text-sm"
          placeholder="https://… or paste upload URL"
          value={image.src}
          onChange={(e) => onChange('src', e.target.value)}
          onBlur={(e) => onChange('src', e.target.value, true)}
        />
      </div>

      {/* ── Fit ──────────────────────────────────────── */}
      <div>
        <label className="text-xs text-gray-500">Fit</label>
        <select
          className="mt-1 w-full rounded-lg border p-2 text-sm"
          value={image.objectFit}
          onChange={(e) => onChange('objectFit', e.target.value, true)}
        >
          {FIT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Rotation ─────────────────────────────────── */}
      <div>
        <label className="text-xs text-gray-500">Rotation</label>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            title="Rotate left 90°"
            onClick={() => rotateBy(-90)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <div className="relative flex-1">
            <input
              type="number"
              min={0}
              max={359}
              step={1}
              value={rotation}
              onChange={(e) => onChange('rotation', ((Number(e.target.value) % 360) + 360) % 360, false)}
              onBlur={(e) => onChange('rotation', ((Number(e.target.value) % 360) + 360) % 360, true)}
              className="w-full rounded-lg border p-2 pr-6 text-sm"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">°</span>
          </div>
          <button
            type="button"
            title="Rotate right 90°"
            onClick={() => rotateBy(90)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Flip ─────────────────────────────────────── */}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={image.flipX ? 'primary' : 'secondary'}
          className="flex-1"
          onClick={() => onChange('flipX', !image.flipX, true)}
        >
          Flip ↔
        </Button>
        <Button
          type="button"
          size="sm"
          variant={image.flipY ? 'primary' : 'secondary'}
          className="flex-1"
          onClick={() => onChange('flipY', !image.flipY, true)}
        >
          Flip ↕
        </Button>
      </div>

      {/* ── Adjustments section ───────────────────────── */}
      <Section
        title="Adjustments"
        icon={<Sun className="h-3.5 w-3.5" />}
        badge={hasAdjustments ? 'On' : undefined}
        defaultOpen={hasAdjustments}
      >
        <PropSlider
          label="Brightness"
          icon={<Sun className="h-3.5 w-3.5" />}
          propKey="brightness"
          value={image.brightness ?? 100}
          min={0}
          max={200}
          defaultValue={100}
          onChange={onChange}
          onCommit={onChange}
        />
        <PropSlider
          label="Contrast"
          icon={<Contrast className="h-3.5 w-3.5" />}
          propKey="contrast"
          value={image.contrast ?? 100}
          min={0}
          max={200}
          defaultValue={100}
          onChange={onChange}
          onCommit={onChange}
        />
        <PropSlider
          label="Saturation"
          icon={<Droplets className="h-3.5 w-3.5" />}
          propKey="saturate"
          value={image.saturate ?? 100}
          min={0}
          max={200}
          defaultValue={100}
          onChange={onChange}
          onCommit={onChange}
        />
        <PropSlider
          label="Blur"
          icon={<Wind className="h-3.5 w-3.5" />}
          propKey="blur"
          value={image.blur ?? 0}
          min={0}
          max={20}
          defaultValue={0}
          onChange={onChange}
          onCommit={onChange}
        />
        {hasAdjustments && (
          <button
            type="button"
            className="w-full rounded-lg border border-gray-200 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
            onClick={() =>
              onChangeMany({ brightness: 100, contrast: 100, saturate: 100, blur: 0 }, true)
            }
          >
            Reset all adjustments
          </button>
        )}
      </Section>

      {/* ── Shadow / Effects section ──────────────────── */}
      <Section
        title="Shadow"
        icon={<Sparkles className="h-3.5 w-3.5" />}
        badge={shadowOn ? 'On' : undefined}
        defaultOpen={shadowOn}
      >
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">Drop shadow</span>
          <button
            type="button"
            onClick={() => onChange('shadowEnabled', !shadowOn, true)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              shadowOn ? 'bg-primary' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                shadowOn ? 'translate-x-4' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {shadowOn && (
          <>
            <PropSlider
              label="X offset"
              icon={<span className="text-[10px] font-bold text-gray-500">X</span>}
              propKey="shadowX"
              value={image.shadowX ?? 4}
              min={-40}
              max={40}
              defaultValue={4}
              onChange={onChange}
              onCommit={onChange}
            />
            <PropSlider
              label="Y offset"
              icon={<span className="text-[10px] font-bold text-gray-500">Y</span>}
              propKey="shadowY"
              value={image.shadowY ?? 4}
              min={-40}
              max={40}
              defaultValue={4}
              onChange={onChange}
              onCommit={onChange}
            />
            <PropSlider
              label="Blur"
              icon={<Wind className="h-3.5 w-3.5" />}
              propKey="shadowBlur"
              value={image.shadowBlur ?? 8}
              min={0}
              max={40}
              defaultValue={8}
              onChange={onChange}
              onCommit={onChange}
            />
            <div>
              <label className="text-xs text-gray-500">Shadow color</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={image.shadowColor?.slice(0, 7) ?? '#000000'}
                  onChange={(e) => onChange('shadowColor', e.target.value + '80', false)}
                  onBlur={(e) => onChange('shadowColor', e.target.value + '80', true)}
                  className="h-8 w-14 cursor-pointer rounded border border-gray-200 p-0.5"
                />
                <span className="text-xs text-gray-400">{image.shadowColor ?? '#00000080'}</span>
              </div>
            </div>
          </>
        )}
      </Section>

      {/* ── Frame style ──────────────────────────────── */}
      <Input
        label="Corner radius (px)"
        type="number"
        min={0}
        max={999}
        value={String(image.borderRadius)}
        onChange={(e) => onChange('borderRadius', Number(e.target.value))}
        onBlur={(e) => onChange('borderRadius', Number(e.target.value), true)}
      />

      <Input
        label="Border width (px)"
        type="number"
        min={0}
        max={20}
        value={String(image.borderWidth)}
        onChange={(e) => onChange('borderWidth', Number(e.target.value))}
        onBlur={(e) => onChange('borderWidth', Number(e.target.value), true)}
      />

      <Input
        label="Border color"
        type="color"
        value={image.borderColor}
        onChange={(e) => onChange('borderColor', e.target.value, true)}
      />

      {/* ── Alt text ─────────────────────────────────── */}
      <div>
        <label className="text-xs text-gray-500">Alt text</label>
        <input
          type="text"
          className="mt-1 w-full rounded-lg border p-2 text-sm"
          placeholder="Description for accessibility"
          value={image.alt}
          onChange={(e) => onChange('alt', e.target.value)}
          onBlur={(e) => onChange('alt', e.target.value, true)}
        />
      </div>

      <p className="text-[11px] text-gray-400">
        Side edges crop immediately when selected. Use Crop for pan/zoom inside the frame.
      </p>
    </div>
  );
}
