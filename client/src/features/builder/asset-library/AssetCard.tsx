import { memo, useRef, type DragEvent } from 'react';
import { ComponentType } from '@invogen/shared';
import type { AssetItem } from './asset-catalog';
import { getAssetIcon } from './asset-icons';
import { FavoriteButton } from './FavoriteButton';
import { PALETTE_DRAG_MIME, setActivePaletteDrag } from '../builder-dnd';
import { LibraryIconTile } from '../LibraryIconTile';
import { getIconCatalogEntry } from '../icon-components';
import { normalizePaletteDragProps } from '../palette-catalog';

interface AssetCardProps {
  item: AssetItem;
  selected: boolean;
  isFavorite: boolean;
  onSelect: (item: AssetItem) => void;
  onInsert: (item: AssetItem) => void;
}

function createDragGhost(label: string): HTMLElement {
  const ghost = document.createElement('div');
  ghost.className =
    'flex items-center gap-2 rounded-lg border border-primary/30 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-lg';
  ghost.textContent = label;
  ghost.style.position = 'fixed';
  ghost.style.top = '-1000px';
  ghost.style.left = '-1000px';
  ghost.style.pointerEvents = 'none';
  document.body.appendChild(ghost);
  return ghost;
}

function resolveAssetGlyphKey(item: AssetItem): string | null {
  if (typeof item.glyphKey === 'string' && item.glyphKey) return item.glyphKey;
  const fromProps = item.defaultProps?.iconKey;
  if (typeof fromProps === 'string' && fromProps && getIconCatalogEntry(fromProps)) {
    return fromProps;
  }
  return null;
}

export const AssetCard = memo(function AssetCard({
  item,
  selected,
  isFavorite,
  onSelect,
  onInsert,
}: AssetCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const label = item.label ?? item.name ?? item.type;
  const Icon = getAssetIcon(item.type, item.iconKey ?? item.id);
  const glyphKey =
    item.type === ComponentType.FIELD || item.category?.startsWith('fields_')
      ? resolveAssetGlyphKey(item)
      : null;
  const glyphEntry = glyphKey ? getIconCatalogEntry(glyphKey) : null;

  const startDrag = (event: DragEvent<HTMLDivElement>) => {
    const defaultProps = normalizePaletteDragProps(item.type, item.defaultProps || {});
    const payload = { type: item.type, paletteId: item.id, defaultProps, label };
    event.dataTransfer.setData(PALETTE_DRAG_MIME, JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'copy';
    setActivePaletteDrag(payload);

    const ghost = createDragGhost(label);
    event.dataTransfer.setDragImage(ghost, 48, 20);
    requestAnimationFrame(() => document.body.removeChild(ghost));
  };

  const endDrag = () => setActivePaletteDrag(null);

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={startDrag}
      onDragEnd={endDrag}
      onClick={() => onSelect(item)}
      onDoubleClick={(e) => {
        e.preventDefault();
        onInsert(item);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onInsert(item);
      }}
      title={`${label} — drag to canvas or double-click to insert`}
      className={`group/asset relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border bg-white p-2 transition-all duration-200 ease-out ${
        selected
          ? 'border-primary bg-primary-50/50 shadow-md ring-2 ring-primary/25'
          : 'border-gray-200/90 hover:scale-[1.03] hover:border-primary/35 hover:bg-gray-50 hover:shadow-md'
      } active:cursor-grabbing`}
    >
      <FavoriteButton assetId={item.id} isFavorite={isFavorite} className="absolute right-1 top-1" />

      {glyphKey ? (
        <LibraryIconTile
          iconKey={glyphKey}
          accent={glyphEntry?.accent}
          accentSoft={glyphEntry?.accentSoft}
          size={40}
          className="shrink-0 transition-transform duration-200 group-hover/asset:scale-105"
        />
      ) : (
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-200 ${
            selected
              ? 'bg-primary/15 text-primary'
              : 'bg-gray-100 text-gray-600 group-hover/asset:bg-primary/10 group-hover/asset:text-primary'
          }`}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
        </div>
      )}

      <span className="line-clamp-2 w-full px-0.5 text-center text-[10px] font-medium leading-tight text-gray-700">
        {label}
      </span>
    </div>
  );
});
