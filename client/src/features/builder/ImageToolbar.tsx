import { useState, type MouseEvent } from 'react';
import {
  ChevronUp,
  ChevronDown,
  FlipHorizontal2,
  FlipVertical2,
  Upload,
  Maximize2,
  StretchHorizontal,
  Ratio,
  RotateCcw,
  RotateCw,
  Sun,
  Contrast,
  Droplets,
  Wind,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  type ImageObjectFit,
  normalizeImageProps,
} from './image-components';
import { resolveBrandingImageSrc } from './company-branding';
import { useCompanyBranding } from './CompanyBrandingProvider';
import { useAppSelector } from '@/hooks/useAppDispatch';
import { getImageUploadPatch } from './image-crop';
import {
  cropTransformToProps,
  getImageCropFromProps,
  realignCropForFit,
} from './image-editor/cropUtils';
import { useImageUpload } from './use-image-upload';

const TOOLBAR_SLOT_CLASS =
  'w-full shrink-0 border-b border-gray-200 bg-[#ececf0] min-h-[52px]';

const FIT_CYCLE: ImageObjectFit[] = ['contain', 'cover', 'fill'];

const FIT_LABELS: Record<ImageObjectFit, string> = {
  contain: 'Fit',
  cover: 'Fill',
  fill: 'Stretch',
};

// ── Shared toolbar icon button ────────────────────────────────────────────────

function ToolbarIconButton({
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
        disabled
          ? 'cursor-not-allowed text-gray-300'
          : active
            ? 'bg-primary/15 text-primary'
            : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-0.5 h-6 w-px bg-gray-200" />;
}

// ── Popover panel ─────────────────────────────────────────────────────────────

function PopoverPanel({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="absolute left-1/2 top-full z-[200] mt-2 w-64 -translate-x-1/2 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

// ── Slider row ────────────────────────────────────────────────────────────────

function SliderRow({
  label,
  icon,
  value,
  min,
  max,
  defaultValue,
  onChange,
  onCommit,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  const isChanged = value !== defaultValue;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
          {icon}
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-8 text-right text-xs tabular-nums text-gray-500">{value}</span>
          {isChanged && (
            <button
              type="button"
              title={`Reset ${label}`}
              onClick={() => onCommit(defaultValue)}
              className="text-gray-400 hover:text-primary"
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
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
        className="h-4 w-full cursor-pointer accent-primary"
      />
    </div>
  );
}

// ── Adjust popover ────────────────────────────────────────────────────────────

function AdjustPopover({
  open,
  props,
  onUpdateProp,
  onUpdateProps,
}: {
  open: boolean;
  props: Record<string, unknown>;
  onUpdateProp: (key: string, value: unknown, recordHistory?: boolean) => void;
  onUpdateProps: (patch: Record<string, unknown>, recordHistory?: boolean) => void;
}) {
  const image = normalizeImageProps(props);
  const isAnyChanged =
    (image.brightness ?? 100) !== 100 ||
    (image.contrast ?? 100) !== 100 ||
    (image.saturate ?? 100) !== 100 ||
    (image.blur ?? 0) !== 0;

  return (
    <PopoverPanel open={open}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">Adjustments</p>
        {isAnyChanged && (
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() =>
              onUpdateProps({ brightness: 100, contrast: 100, saturate: 100, blur: 0 }, true)
            }
          >
            Reset all
          </button>
        )}
      </div>
      <div className="space-y-4">
        <SliderRow
          label="Brightness"
          icon={<Sun className="h-3.5 w-3.5" />}
          value={image.brightness ?? 100}
          min={0}
          max={200}
          defaultValue={100}
          onChange={(v) => onUpdateProp('brightness', v, false)}
          onCommit={(v) => onUpdateProp('brightness', v, true)}
        />
        <SliderRow
          label="Contrast"
          icon={<Contrast className="h-3.5 w-3.5" />}
          value={image.contrast ?? 100}
          min={0}
          max={200}
          defaultValue={100}
          onChange={(v) => onUpdateProp('contrast', v, false)}
          onCommit={(v) => onUpdateProp('contrast', v, true)}
        />
        <SliderRow
          label="Saturation"
          icon={<Droplets className="h-3.5 w-3.5" />}
          value={image.saturate ?? 100}
          min={0}
          max={200}
          defaultValue={100}
          onChange={(v) => onUpdateProp('saturate', v, false)}
          onCommit={(v) => onUpdateProp('saturate', v, true)}
        />
        <SliderRow
          label="Blur"
          icon={<Wind className="h-3.5 w-3.5" />}
          value={image.blur ?? 0}
          min={0}
          max={20}
          defaultValue={0}
          onChange={(v) => onUpdateProp('blur', v, false)}
          onCommit={(v) => onUpdateProp('blur', v, true)}
        />
      </div>
    </PopoverPanel>
  );
}

// ── Effects (shadow) popover ──────────────────────────────────────────────────

function EffectsPopover({
  open,
  props,
  onUpdateProp,
  onUpdateProps,
}: {
  open: boolean;
  props: Record<string, unknown>;
  onUpdateProp: (key: string, value: unknown, recordHistory?: boolean) => void;
  onUpdateProps: (patch: Record<string, unknown>, recordHistory?: boolean) => void;
}) {
  const image = normalizeImageProps(props);
  const shadowOn = !!image.shadowEnabled;

  return (
    <PopoverPanel open={open}>
      <p className="mb-3 text-xs font-semibold text-gray-700">Shadow</p>

      {/* Toggle */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-gray-600">Drop shadow</span>
        <button
          type="button"
          onClick={() => onUpdateProp('shadowEnabled', !shadowOn, true)}
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
        <div className="space-y-3">
          <SliderRow
            label="X offset"
            icon={<span className="text-[10px] font-bold text-gray-500">X</span>}
            value={image.shadowX ?? 4}
            min={-40}
            max={40}
            defaultValue={4}
            onChange={(v) => onUpdateProp('shadowX', v, false)}
            onCommit={(v) => onUpdateProp('shadowX', v, true)}
          />
          <SliderRow
            label="Y offset"
            icon={<span className="text-[10px] font-bold text-gray-500">Y</span>}
            value={image.shadowY ?? 4}
            min={-40}
            max={40}
            defaultValue={4}
            onChange={(v) => onUpdateProp('shadowY', v, false)}
            onCommit={(v) => onUpdateProp('shadowY', v, true)}
          />
          <SliderRow
            label="Blur"
            icon={<Wind className="h-3.5 w-3.5" />}
            value={image.shadowBlur ?? 8}
            min={0}
            max={40}
            defaultValue={8}
            onChange={(v) => onUpdateProp('shadowBlur', v, false)}
            onCommit={(v) => onUpdateProp('shadowBlur', v, true)}
          />
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-gray-600">Color</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={image.shadowColor?.slice(0, 7) ?? '#000000'}
                onChange={(e) => onUpdateProp('shadowColor', e.target.value + '80', false)}
                onBlur={(e) => onUpdateProp('shadowColor', e.target.value + '80', true)}
                className="h-7 w-12 cursor-pointer rounded border border-gray-200 p-0.5"
              />
              <span className="text-xs text-gray-400">{image.shadowColor ?? '#00000080'}</span>
            </div>
          </div>
          <button
            type="button"
            className="w-full rounded-lg border border-gray-200 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
            onClick={() =>
              onUpdateProps({ shadowEnabled: false, shadowX: 4, shadowY: 4, shadowBlur: 8, shadowColor: '#00000040' }, true)
            }
          >
            Remove shadow
          </button>
        </div>
      )}
    </PopoverPanel>
  );
}

// ── Rotation controls ─────────────────────────────────────────────────────────

function RotationControls({
  props,
  onUpdateProp,
}: {
  props: Record<string, unknown>;
  onUpdateProp: (key: string, value: unknown, recordHistory?: boolean) => void;
}) {
  const image = normalizeImageProps(props);
  const rotation = image.rotation ?? 0;

  const rotate = (delta: number) => {
    const next = ((rotation + delta) % 360 + 360) % 360;
    onUpdateProp('rotation', next, true);
  };

  return (
    <div className="flex items-center gap-0.5">
      <ToolbarIconButton title="Rotate left 90°" onClick={() => rotate(-90)}>
        <RotateCcw className="h-4 w-4" />
      </ToolbarIconButton>
      <ToolbarIconButton title="Rotate right 90°" onClick={() => rotate(90)}>
        <RotateCw className="h-4 w-4" />
      </ToolbarIconButton>
      {/* Fine-grain angle input */}
      <div className="relative flex items-center">
        <input
          type="number"
          min={0}
          max={359}
          step={1}
          value={rotation}
          onChange={(e) => onUpdateProp('rotation', ((Number(e.target.value) % 360) + 360) % 360, false)}
          onBlur={(e) => onUpdateProp('rotation', ((Number(e.target.value) % 360) + 360) % 360, true)}
          title="Rotation angle (°)"
          className="h-7 w-12 rounded-md border border-gray-200 bg-white text-center text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        <span className="pointer-events-none absolute right-1 text-[10px] text-gray-400">°</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  elementId: string;
  props: Record<string, unknown>;
  layerIndex: number;
  maxLayer: number;
  onUpdateProp: (key: string, value: unknown, recordHistory?: boolean) => void;
  onUpdateProps: (patch: Record<string, unknown>, recordHistory?: boolean) => void;
  onForward: () => void;
  onBackward: () => void;
}

type OpenPanel = 'adjust' | 'effects' | null;

export function ImageToolbar({
  elementId,
  props,
  layerIndex,
  maxLayer,
  onUpdateProp,
  onUpdateProps,
  onForward,
  onBackward,
}: Props) {
  const branding = useCompanyBranding();
  const element = useAppSelector((s) => {
    const page = s.builder.pages[s.builder.activePageIndex];
    return page.elements.find((el) => el.id === elementId);
  });
  const image = normalizeImageProps(props);
  const resolvedSrc = resolveBrandingImageSrc(
    element?.type ?? '',
    image.src,
    branding
  );
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);

  const { input, pickFile, uploading } = useImageUpload((url) => {
    onUpdateProps(getImageUploadPatch(url), true);
  });

  const cycleFit = () => {
    const fit = image.objectFit ?? 'contain';
    const idx = FIT_CYCLE.indexOf(fit);
    const next = FIT_CYCLE[(idx + 1) % FIT_CYCLE.length];
    const naturalW = image.imageNaturalW ?? 0;
    const naturalH = image.imageNaturalH ?? 0;

    if (element && naturalW > 0 && naturalH > 0) {
      const crop = getImageCropFromProps(props, element.width, element.height);
      onUpdateProps(
        {
          objectFit: next,
          ...cropTransformToProps(
            realignCropForFit(
              crop,
              element.width,
              element.height,
              naturalW,
              naturalH,
              next
            )
          ),
        },
        true
      );
      return;
    }

    onUpdateProp('objectFit', next, true);
  };

  const togglePanel = (panel: OpenPanel) => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  };

  const FitIcon =
    image.objectFit === 'cover'
      ? Ratio
      : image.objectFit === 'fill'
        ? StretchHorizontal
        : Maximize2;

  const hasAdjustments =
    (image.brightness ?? 100) !== 100 ||
    (image.contrast ?? 100) !== 100 ||
    (image.saturate ?? 100) !== 100 ||
    (image.blur ?? 0) !== 0;

  const hasShadow = !!image.shadowEnabled;

  return (
    <div className={TOOLBAR_SLOT_CLASS}>
      {input}
      <div className="builder-context-toolbar-scroll flex min-h-[52px] items-center overflow-x-auto py-2.5 px-2">
        <div
          className="pointer-events-auto mx-auto flex w-max max-w-full items-center gap-0.5 rounded-full border border-gray-200/80 bg-white px-2 py-1 shadow-md"
          onMouseDown={stopBubble}
          onClick={stopBubble}
        >
          {/* Upload / Replace */}
          <ToolbarIconButton
            title={uploading ? 'Uploading…' : image.src ? 'Replace image' : 'Upload image'}
            onClick={pickFile}
            disabled={uploading}
          >
            <Upload className="h-4 w-4" />
          </ToolbarIconButton>

          <Divider />

          {/* Adjustments popover */}
          {resolvedSrc && (
                <div className="relative">
                  <ToolbarIconButton
                    title="Adjustments (brightness, contrast, saturation, blur)"
                    active={openPanel === 'adjust' || hasAdjustments}
                    onClick={() => togglePanel('adjust')}
                  >
                    <Sun className="h-4 w-4" />
                  </ToolbarIconButton>
                  <AdjustPopover
                    open={openPanel === 'adjust'}
                    props={props}
                    onUpdateProp={onUpdateProp}
                    onUpdateProps={onUpdateProps}
                  />
                </div>
              )}

              {/* Shadow / effects popover */}
              {resolvedSrc && (
                <div className="relative">
                  <ToolbarIconButton
                    title="Shadow & effects"
                    active={openPanel === 'effects' || hasShadow}
                    onClick={() => togglePanel('effects')}
                  >
                    <Sparkles className="h-4 w-4" />
                  </ToolbarIconButton>
                  <EffectsPopover
                    open={openPanel === 'effects'}
                    props={props}
                    onUpdateProp={onUpdateProp}
                    onUpdateProps={onUpdateProps}
                  />
                </div>
              )}

              <Divider />

              {/* Rotation */}
              <RotationControls props={props} onUpdateProp={onUpdateProp} />

              <Divider />

              {/* Flip */}
              <ToolbarIconButton
                title="Flip horizontal"
                active={image.flipX}
                onClick={() => onUpdateProp('flipX', !image.flipX, true)}
              >
                <FlipHorizontal2 className="h-4 w-4" />
              </ToolbarIconButton>
              <ToolbarIconButton
                title="Flip vertical"
                active={image.flipY}
                onClick={() => onUpdateProp('flipY', !image.flipY, true)}
              >
                <FlipVertical2 className="h-4 w-4" />
              </ToolbarIconButton>

              <Divider />

              {/* Fit cycle */}
              <ToolbarIconButton
                title={`${FIT_LABELS[image.objectFit ?? 'contain']} — click to change`}
                onClick={cycleFit}
              >
                <FitIcon className="h-4 w-4" />
              </ToolbarIconButton>

              {/* Rounded corners */}
              <ToolbarIconButton
                title="Rounded corners"
                active={(image.borderRadius ?? 0) > 0}
                onClick={() =>
                  onUpdateProp('borderRadius', (image.borderRadius ?? 0) > 0 ? 0 : 12, true)
                }
              >
                <span className="text-xs font-semibold">◢</span>
              </ToolbarIconButton>

              <Divider />

              {/* Layer order */}
              <ToolbarIconButton
                title="Bring forward"
                disabled={layerIndex >= maxLayer}
                onClick={onForward}
              >
                <ChevronUp className="h-4 w-4" />
              </ToolbarIconButton>
              <ToolbarIconButton
                title="Send backward"
                disabled={layerIndex <= 0}
                onClick={onBackward}
              >
                <ChevronDown className="h-4 w-4" />
              </ToolbarIconButton>
        </div>
      </div>
    </div>
  );
}

function stopBubble(event: MouseEvent) {
  event.stopPropagation();
}
