import { memo } from 'react';
import type { AssetItem } from './asset-catalog';
import { AssetCard } from './AssetCard';

interface AssetGridProps {
  items: AssetItem[];
  selectedAssetId: string | null;
  favoriteAssetIds: string[];
  onSelect: (item: AssetItem) => void;
  onInsert: (item: AssetItem) => void;
}

export const AssetGrid = memo(function AssetGrid({
  items,
  selectedAssetId,
  favoriteAssetIds,
  onSelect,
  onInsert,
}: AssetGridProps) {
  const favSet = new Set(favoriteAssetIds);

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <AssetCard
          key={item.id}
          item={item}
          selected={selectedAssetId === item.id}
          isFavorite={favSet.has(item.id)}
          onSelect={onSelect}
          onInsert={onInsert}
        />
      ))}
    </div>
  );
});
