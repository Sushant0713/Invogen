import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { TemplateListResponse, TemplateSummary } from '@invogen/shared';
import api from '@/api/client';
import {
  getFavoriteTemplateIds,
  getRecentTemplateIds,
  removeRecentTemplate,
  subscribeTemplatePreferences,
  toggleTemplateFavorite,
} from './template-manager';
import { TEMPLATE_CATEGORY_ALL } from './template-categories';

const PAGE_SIZE = 24;

export interface UseTemplateGalleryOptions {
  apiBase: string;
  queryKey: string;
}

export function useTemplateGallery({ apiBase, queryKey }: UseTemplateGalleryOptions) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(TEMPLATE_CATEGORY_ALL);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteTemplateIds());
  const [recentRevision, setRecentRevision] = useState(0);

  useEffect(() => {
    return subscribeTemplatePreferences(() => {
      setFavoriteIds(getFavoriteTemplateIds());
      setRecentRevision((n) => n + 1);
    });
  }, []);

  const favorites = favoriteIds;

  const recentIds = useMemo(
    () => getRecentTemplateIds().slice(0, 8),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [recentRevision]
  );

  const { data: recentTemplates = [] } = useQuery({
    queryKey: ['template-recent', apiBase, recentIds],
    queryFn: async () => {
      const res = await api.get(apiBase, {
        params: { ids: recentIds.join(','), limit: recentIds.length },
      });
      const items = (res.data.data ?? []) as TemplateSummary[];
      const order = new Map(recentIds.map((id, i) => [id, i]));
      return [...items].sort(
        (a, b) => (order.get(a._id) ?? 0) - (order.get(b._id) ?? 0)
      );
    },
    enabled: recentIds.length > 0,
    staleTime: 60_000,
  });

  const query = useInfiniteQuery({
    queryKey: [queryKey, apiBase, search, category, favoritesOnly],
    queryFn: async ({ pageParam = 1 }) => {
      const params: Record<string, string | number> = {
        page: pageParam,
        limit: PAGE_SIZE,
      };
      if (search.trim()) params.search = search.trim();
      if (category !== TEMPLATE_CATEGORY_ALL) params.category = category;
      if (favoritesOnly) {
        const favIds = getFavoriteTemplateIds();
        if (favIds.length === 0) {
          return {
            data: [] as TemplateSummary[],
            meta: { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 },
          };
        }
        params.ids = favIds.join(',');
        params.limit = Math.max(favIds.length, PAGE_SIZE);
      }

      const res = await api.get(apiBase, { params });
      return {
        data: res.data.data as TemplateSummary[],
        meta: res.data.meta,
      } as TemplateListResponse;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (favoritesOnly) return undefined;
      const { page, totalPages } = lastPage.meta;
      return page < totalPages ? page + 1 : undefined;
    },
    staleTime: 60_000,
  });

  const templates = useMemo(() => {
    const list = query.data?.pages.flatMap((p) => p.data) ?? [];
    if (!favoritesOnly) return list;
    const favSet = new Set(favoriteIds);
    return list.filter((t) => favSet.has(t._id));
  }, [query.data, favoritesOnly, favoriteIds]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) set.add(t.category);
    for (const t of recentTemplates) set.add(t.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [templates, recentTemplates]);

  const handleToggleFavorite = useCallback((id: string) => {
    toggleTemplateFavorite(id);
    setFavoriteIds(getFavoriteTemplateIds());
  }, []);

  const handleRemoveRecent = useCallback((id: string) => {
    removeRecentTemplate(id);
    setRecentRevision((n) => n + 1);
  }, []);

  const isFavorite = useCallback(
    (id: string) => favoriteIds.includes(id),
    [favoriteIds]
  );

  return {
    search,
    setSearch,
    category,
    setCategory,
    favoritesOnly,
    setFavoritesOnly,
    favorites,
    favoriteIds,
    isFavorite,
    templates,
    categories,
    recentTemplates,
    handleToggleFavorite,
    handleRemoveRecent,
    ...query,
  };
}
