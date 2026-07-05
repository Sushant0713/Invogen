import { memo } from 'react';
import type { AssetItem } from './asset-catalog';
import { AssetGrid } from './AssetGrid';
import { CategoryHeader } from './CategoryHeader';
import { toggleSectionCollapsed, useSidebarStore } from './sidebar-store';

interface CategorySectionProps {
  category: string;
  label: string;
  items: AssetItem[];
  selectedAssetId: string | null;
  favoriteAssetIds: string[];
  onSelect: (item: AssetItem) => void;
  onInsert: (item: AssetItem) => void;
}

export const CategorySection = memo(function CategorySection({
  category,
  label,
  items,
  selectedAssetId,
  favoriteAssetIds,
  onSelect,
  onInsert,
}: CategorySectionProps) {
  const collapsed = useSidebarStore((s) => s.collapsedSections[category] ?? false);

  if (items.length === 0) return null;

  return (
    <section className="space-y-2">
      <CategoryHeader
        label={label}
        count={items.length}
        collapsed={collapsed}
        onToggle={() => toggleSectionCollapsed(category)}
      />
      {!collapsed && (
        <AssetGrid
          items={items}
          selectedAssetId={selectedAssetId}
          favoriteAssetIds={favoriteAssetIds}
          onSelect={onSelect}
          onInsert={onInsert}
        />
      )}
    </section>
  );
});
