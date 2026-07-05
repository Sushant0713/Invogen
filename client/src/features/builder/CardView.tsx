import type { CanvasElement } from '@invogen/shared';
import { getTextElementStyle } from './text-styles';
import { getCardDisplayLines } from './card-components';

interface Props {
  element: CanvasElement;
  props: Record<string, unknown>;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function CardView({ element, props, isSelected, onSelect }: Props) {
  const textStyle = getTextElementStyle(props, element.type);
  const lines = getCardDisplayLines(element.type, props);

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
          style={{ fontWeight: line.bold ? 700 : textStyle.fontWeight }}
        >
          {line.text}
        </div>
      ))}
    </div>
  );
}
