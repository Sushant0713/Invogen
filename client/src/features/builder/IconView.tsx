import type { CanvasElement } from '@invogen/shared';
import { LibraryIconTile } from './LibraryIconTile';

interface Props {
  element: CanvasElement;
  props: Record<string, unknown>;
  isSelected?: boolean;
  onSelect?: () => void;
}

/**
 * Soft tile icon — accent wash + dual-tone glyph. Scales with the element box
 * (so attached icons grow/shrink when the host is resized).
 */
export function IconView({ element, props, isSelected, onSelect }: Props) {
  const iconKey = typeof props.iconKey === 'string' ? props.iconKey : 'phone';
  const accent = typeof props.accent === 'string' ? props.accent : undefined;
  const accentSoft = typeof props.accentSoft === 'string' ? props.accentSoft : undefined;
  const variant = props.variant === 'solid' ? 'solid' : 'soft';
  const size = Math.max(16, Math.min(element.width, element.height));

  return (
    <div
      className="builder-icon-surface flex h-full w-full items-center justify-center"
      onPointerDown={(e) => {
        if (e.detail >= 2 || !isSelected) e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!isSelected) onSelect?.();
      }}
    >
      <LibraryIconTile
        iconKey={iconKey}
        accent={accent}
        accentSoft={accentSoft}
        variant={variant}
        size={size}
      />
    </div>
  );
}
