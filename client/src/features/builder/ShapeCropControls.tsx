import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setShapeCropMode } from '@/store/slices/builderSlice';
import { Check } from 'lucide-react';
import {
  FULL_SHAPE_POLYGON,
  SLANT_CUT_PRESETS,
  getShapeClipFromProps,
  rectToPolygon,
  shapeClipToProps,
  type NormalizedPoint,
  type ShapeClip,
  type ShapeClipMode,
} from './shape-clip';

interface Props {
  elementId: string;
  props: Record<string, unknown>;
  onClipChange: (clip: ShapeClip, recordHistory?: boolean) => void;
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-primary text-white shadow-sm'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

export function ShapeCropControls({ elementId: _elementId, props, onClipChange }: Props) {
  const dispatch = useAppDispatch();
  const clip = getShapeClipFromProps(props);

  const setMode = (mode: ShapeClipMode) => {
    if (mode === clip.mode) return;
    if (mode === 'polygon') {
      onClipChange(
        { mode: 'polygon', rect: clip.rect, polygon: rectToPolygon(clip.rect) },
        true
      );
      return;
    }
    onClipChange(
      { mode: 'rect', rect: clip.rect, polygon: [...FULL_SHAPE_POLYGON] },
      true
    );
  };

  const applyPreset = (polygon: NormalizedPoint[]) => {
    onClipChange(
      {
        mode: 'polygon',
        rect: clip.rect,
        polygon: polygon.map((p) => ({ ...p })),
      },
      true
    );
  };

  return (
    <div
      className="flex max-w-[min(92vw,420px)] flex-col gap-1.5"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center justify-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1.5 shadow-lg ring-1 ring-black/5">
        <ModeButton active={clip.mode === 'rect'} onClick={() => setMode('rect')}>
          Straight
        </ModeButton>
        <ModeButton active={clip.mode === 'polygon'} onClick={() => setMode('polygon')}>
          Slant
        </ModeButton>

        {clip.mode === 'polygon' && (
          <>
            <span className="mx-0.5 h-5 w-px bg-gray-200" />
            <div className="flex max-w-[220px] items-center gap-1 overflow-x-auto">
              {SLANT_CUT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.title}
                  onClick={() => applyPreset(preset.polygon)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:border-primary hover:bg-primary/5"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </>
        )}

        <span className="mx-0.5 h-5 w-px bg-gray-200" />
        <button
          type="button"
          title="Apply cut (Esc)"
          onClick={() => dispatch(setShapeCropMode(null))}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90"
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function shapeClipPropsPatch(clip: ShapeClip): Record<string, unknown> {
  return shapeClipToProps(clip);
}
