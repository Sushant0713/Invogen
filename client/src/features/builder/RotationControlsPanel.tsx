import { RotateCcw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getElementRotation, normalizeRotation, rotateByDegrees } from './element-rotation';

interface RotationControlsPanelProps {
  props: Record<string, unknown>;
  onChange: (rotation: number, recordHistory?: boolean) => void;
  disabled?: boolean;
}

export function RotationControlsPanel({ props, onChange, disabled }: RotationControlsPanelProps) {
  const rotation = getElementRotation(props);

  return (
    <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/50 p-3">
      <p className="text-xs font-semibold text-gray-700">Rotation</p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 px-2"
          disabled={disabled}
          title="Rotate 90° counter-clockwise"
          onClick={() => onChange(rotateByDegrees(rotation, -90), true)}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Input
          label=""
          type="number"
          min={0}
          max={359}
          className="flex-1"
          disabled={disabled}
          value={String(rotation)}
          onChange={(e) => onChange(normalizeRotation(Number(e.target.value)), false)}
          onBlur={(e) => onChange(normalizeRotation(Number(e.target.value)), true)}
        />
        <span className="shrink-0 text-xs text-gray-500">°</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 px-2"
          disabled={disabled}
          title="Rotate 90° clockwise"
          onClick={() => onChange(rotateByDegrees(rotation, 90), true)}
        >
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[11px] text-gray-400">
        Drag the handle above the selection to rotate. After rotating, use the corner handles on the blue frame to resize.
      </p>
    </div>
  );
}
