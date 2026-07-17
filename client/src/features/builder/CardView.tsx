import type { CanvasElement } from '@invogen/shared';
import { getTextElementStyle } from './text-styles';
import { getCardDisplayLines } from './card-components';
import { LibraryIconTile } from './LibraryIconTile';
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
  const fontSize = typeof props.fontSize === 'number' && props.fontSize > 0 ? props.fontSize : 12;
  const iconSize = Math.round(fontSize * 1.35);
  const iconGap = Math.max(4, Math.round(fontSize * 0.4));

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
            display: line.iconKey ? 'flex' : undefined,
            alignItems: line.iconKey
              ? line.iconBesideBlock
                ? 'flex-start'
                : 'center'
              : undefined,
            gap: line.iconKey ? iconGap : undefined,
          }}
        >
          {line.iconKey ? (
            <LibraryIconTile iconKey={line.iconKey} size={iconSize} className="shrink-0" />
          ) : null}
          <span style={{ flex: line.iconBesideBlock ? 1 : undefined, minWidth: 0 }}>
            {line.text}
          </span>
        </div>
      ))}
    </div>
  );
}
