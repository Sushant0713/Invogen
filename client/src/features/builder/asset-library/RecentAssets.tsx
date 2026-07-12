import { memo } from 'react';
import { X } from 'lucide-react';
import type { AssetItem } from './asset-catalog';
import { AssetGrid } from './AssetGrid';
import { CategoryHeader } from './CategoryHeader';
import { removeRecentAsset, toggleSectionCollapsed, useSidebarStore } from './sidebar-store';

interface RecentAssetsProps {
  items: AssetItem[];
  selectedAssetId: string | null;
  favoriteAssetIds: string[];
  onSelect: (item: AssetItem) => void;
  onInsert: (item: AssetItem) => void;
}

export const RecentAssets = memo(function RecentAssets({
  items,
  selectedAssetId,
  favoriteAssetIds,
  onSelect,
  onInsert,
}: RecentAssetsProps) {
  const collapsed = useSidebarStore((s) => s.collapsedSections.__recent ?? false);

  if (items.length === 0) return null;

  return (
    <section className="space-y-2">
      <CategoryHeader
        label="Recently Used"
        count={items.length}
        collapsed={collapsed}
        onToggle={() => toggleSectionCollapsed('__recent')}
      />
      {!collapsed && (
        <>
          <AssetGrid
            items={items}
            selectedAssetId={selectedAssetId}
            favoriteAssetIds={favoriteAssetIds}
            onSelect={onSelect}
            onInsert={onInsert}
          />
          <div className="flex flex-wrap gap-1.5">
            {items.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600"
              >
                {item.label ?? item.type}
                <button
                  type="button"
                  title="Remove from recently used"
                  onClick={() => removeRecentAsset(item.id)}
                  className="rounded-full p-0.5 hover:bg-gray-200 hover:text-red-500"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
});
