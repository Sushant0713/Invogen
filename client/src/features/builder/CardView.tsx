import type { CanvasElement } from '@invogen/shared';
import { getTextElementStyle } from './text-styles';
import { getCardDisplayLines } from './card-components';
import { getFieldKindPlaceholder, resolveFieldKind } from '@/lib/form-fields';

interface Props {
  element: CanvasElement;
  props: Record<string, unknown>;
  isSelected?: boolean;
  onSelect?: () => void;
}

function customFieldPreviewPlaceholder(label: string): string {
  const kind = resolveFieldKind({ label });
  if (kind) return getFieldKindPlaceholder(kind) ?? 'Enter value';
  return 'Enter value';
}

export function CardView({ element, props, isSelected, onSelect }: Props) {
  const textStyle = getTextElementStyle(props, element.type);
  const lines = getCardDisplayLines(element.type, props, {
    customValuePlaceholder: customFieldPreviewPlaceholder,
  });

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.detail >= 2 || !isSelected) {
      e.stopPropagation();
    }
  };

  return (
    <div
      className="builder-card-surface h-full w-full"
      style={{
        ...textStyle,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: 1.45,
      }}
      onPointerDown={handlePointerDown}
      onClick={(e) => {
        e.stopPropagation();
        if (!isSelected) onSelect?.();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {lines.map((line, index) => (
        <div
          key={`${line.text}-${index}`}
          style={{
            fontWeight: line.bold ? 700 : textStyle.fontWeight,
            opacity: line.isPlaceholder ? 0.55 : 1,
          }}
        >
          {line.text}
        </div>
      ))}
    </div>
  );
}
