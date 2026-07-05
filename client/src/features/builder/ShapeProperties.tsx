import { SHAPE_COLOR_PRESETS } from './shape-components';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ComponentType } from '@invogen/shared';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setShapeCropMode } from '@/store/slices/builderSlice';
import { isDefaultShapeClip, getShapeClipFromProps } from './shape-clip';
import { RotationControlsPanel } from './RotationControlsPanel';

interface ShapePropertiesProps {
  type: string;
  elementId: string;
  props: Record<string, unknown>;
  onChange: (key: string, value: unknown, recordHistory?: boolean) => void;
}

export function ShapeProperties({ type, elementId, props, onChange }: ShapePropertiesProps) {
  const dispatch = useAppDispatch();
  const clip = getShapeClipFromProps(props);
  const hasCustomClip = !isDefaultShapeClip(clip);
  const fill = (props.fill as string) ?? '#FF7700';
  const stroke = (props.stroke as string) ?? '#1f2937';
  const strokeWidth = Number(props.strokeWidth ?? 2);
  const cornerRadius = Number(props.cornerRadius ?? props.borderRadius ?? 8);
  const isLineLike = type === ComponentType.LINE || type === ComponentType.ARROW;
  const showCornerRadius = type === ComponentType.ROUNDED_RECT || type === ComponentType.RECTANGLE;

  return (
    <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3">
      <p className="text-xs font-semibold text-gray-700">Shape style</p>

      {!isLineLike && (
        <div>
          <label className="mb-1.5 block text-xs text-gray-500">Fill colour</label>
          <div className="flex flex-wrap gap-1.5">
            {SHAPE_COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                title={color === 'transparent' ? 'Transparent' : color}
                onClick={() => onChange('fill', color, true)}
                className={`h-7 w-7 rounded-lg border-2 transition-transform hover:scale-110 ${
                  fill === color ? 'border-primary ring-2 ring-primary/30' : 'border-gray-200'
                }`}
                style={{
                  background: color === 'transparent'
                    ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)'
                    : color,
                  backgroundSize: color === 'transparent' ? '8px 8px' : undefined,
                  backgroundPosition: color === 'transparent' ? '0 0, 4px 4px' : undefined,
                }}
              />
            ))}
          </div>
          <Input
            label="Custom fill"
            type="color"
            className="mt-2"
            value={fill === 'transparent' ? '#ffffff' : fill}
            onChange={(e) => onChange('fill', e.target.value, true)}
          />
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs text-gray-500">
          {isLineLike ? 'Line colour' : 'Border colour'}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SHAPE_COLOR_PRESETS.filter((c) => c !== 'transparent').map((color) => (
            <button
              key={`stroke-${color}`}
              type="button"
              onClick={() => onChange('stroke', color, true)}
              className={`h-7 w-7 rounded-lg border-2 transition-transform hover:scale-110 ${
                stroke === color ? 'border-primary ring-2 ring-primary/30' : 'border-gray-200'
              }`}
              style={{ background: color }}
            />
          ))}
        </div>
        <Input
          label="Custom border"
          type="color"
          className="mt-2"
          value={stroke}
          onChange={(e) => onChange('stroke', e.target.value, true)}
        />
      </div>

      <Input
        label={isLineLike ? 'Line thickness' : 'Border width'}
        type="number"
        min={1}
        max={24}
        value={String(strokeWidth)}
        onChange={(e) => onChange('strokeWidth', Number(e.target.value))}
        onBlur={(e) => onChange('strokeWidth', Number(e.target.value), true)}
      />

      {showCornerRadius && (
        <Input
          label="Corner radius"
          type="number"
          min={0}
          max={64}
          value={String(cornerRadius)}
          onChange={(e) => onChange('cornerRadius', Number(e.target.value))}
          onBlur={(e) => onChange('cornerRadius', Number(e.target.value), true)}
        />
      )}

      <RotationControlsPanel
        props={props}
        onChange={(rotation, recordHistory) => onChange('rotation', rotation, recordHistory)}
      />

      <div className="space-y-2 border-t border-gray-100 pt-3">
        <p className="text-xs font-semibold text-gray-700">Cut shape</p>
        <p className="text-[11px] text-gray-500">
          Trim straight or slant edges. Use Slant mode for diagonal cuts — drag corners or pick a preset.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => dispatch(setShapeCropMode(elementId))}
        >
          {hasCustomClip ? 'Edit cut' : 'Cut shape'}
        </Button>
      </div>
    </div>
  );
}
