import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { mergePaletteWithApi } from '../palette-catalog';
import {
  enrichAssets,
  filterAssets,
  groupAssetsByCategory,
  type AssetItem,
} from './asset-catalog';
import { SearchBar } from './SearchBar';
import { SidebarHeader } from './SidebarHeader';
import { CategorySection } from './CategorySection';
import { RecentAssets } from './RecentAssets';
import { AssetGrid } from './AssetGrid';
import { CategoryHeader } from './CategoryHeader';
import {
  setSelectedAssetId,
  toggleSectionCollapsed,
  useSidebarStore,
} from './sidebar-store';
import { useInsertAsset } from './use-insert-asset';

export function AssetLibrarySidebar() {
  const search = useSidebarStore((s) => s.search);
  const selectedAssetId = useSidebarStore((s) => s.selectedAssetId);
  const favoriteAssetIds = useSidebarStore((s) => s.favoriteAssetIds);
  const recentAssetIds = useSidebarStore((s) => s.recentAssetIds);
  const favoritesCollapsed = useSidebarStore((s) => s.collapsedSections.__favorites ?? false);

  const insertAsset = useInsertAsset();

  const { data: components } = useQuery({
    queryKey: ['components'],
    queryFn: async () => {
      try {
        return (await api.get('/super-admin/components')).data.data as Record<string, unknown>[];
      } catch {
        return undefined;
      }
    },
    staleTime: 60_000,
  });

  const allAssets = useMemo(
    () => enrichAssets(mergePaletteWithApi(components)),
    [components]
  );

  const assetsById = useMemo(() => {
    const map = new Map<string, AssetItem>();
    for (const item of allAssets) map.set(item.id, item);
    return map;
  }, [allAssets]);

  const filteredAssets = useMemo(
    () => filterAssets(allAssets, search),
    [allAssets, search]
  );

  const groups = useMemo(
    () => groupAssetsByCategory(filteredAssets),
    [filteredAssets]
  );

  const favoriteItems = useMemo(
    () =>
      favoriteAssetIds
        .map((id) => assetsById.get(id))
        .filter((item): item is AssetItem => !!item)
        .filter((item) => !search || filterAssets([item], search).length > 0),
    [favoriteAssetIds, assetsById, search]
  );

  const recentItems = useMemo(
    () =>
      recentAssetIds
        .map((id) => assetsById.get(id))
        .filter((item): item is AssetItem => !!item)
        .filter((item) => !search || filterAssets([item], search).length > 0),
    [recentAssetIds, assetsById, search]
  );

  const handleSelect = useCallback((item: AssetItem) => {
    setSelectedAssetId(item.id);
  }, []);

  const handleInsert = useCallback(
    (item: AssetItem) => {
      insertAsset(item);
      setSelectedAssetId(item.id);
    },
    [insertAsset]
  );

  const showFavorites = favoriteItems.length > 0 && !search;
  const showRecent = recentItems.length > 0 && !search;

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="shrink-0 space-y-3 border-b border-gray-100 p-3 dark:border-gray-800">
        <SidebarHeader />
        <SearchBar value={search} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
        <div className="space-y-4">
          {showFavorites && (
            <section className="space-y-2">
              <CategoryHeader
                label="Favourites"
                count={favoriteItems.length}
                collapsed={favoritesCollapsed}
                onToggle={() => toggleSectionCollapsed('__favorites')}
              />
              {!favoritesCollapsed && (
                <AssetGrid
                  items={favoriteItems}
                  selectedAssetId={selectedAssetId}
                  favoriteAssetIds={favoriteAssetIds}
                  onSelect={handleSelect}
                  onInsert={handleInsert}
                />
              )}
            </section>
          )}

          {showRecent && (
            <RecentAssets
              items={recentItems}
              selectedAssetId={selectedAssetId}
              favoriteAssetIds={favoriteAssetIds}
              onSelect={handleSelect}
              onInsert={handleInsert}
            />
          )}

          {groups.map((group) => (
            <CategorySection
              key={group.category}
              category={group.category}
              label={group.label}
              items={group.items}
              selectedAssetId={selectedAssetId}
              favoriteAssetIds={favoriteAssetIds}
              onSelect={handleSelect}
              onInsert={handleInsert}
            />
          ))}

          {filteredAssets.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No assets match your search.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
