import { useSyncExternalStore } from 'react';
import { readScopedJson, writeScopedJson } from '@/lib/user-storage';
import { PALETTE_CATEGORY_ORDER } from '../palette-layout';

const FAVORITES_KEY = 'invogen:asset-favorites';
const RECENT_KEY = 'invogen:asset-recent';
const SECTIONS_KEY = 'invogen:sidebar-sections';
const MAX_RECENT = 10;

export interface SidebarState {
  search: string;
  selectedAssetId: string | null;
  favoriteAssetIds: string[];
  recentAssetIds: string[];
  collapsedSections: Record<string, boolean>;
}

function defaultCollapsed(): Record<string, boolean> {
  const collapsed: Record<string, boolean> = {
    __favorites: false,
    __recent: false,
  };
  for (const cat of PALETTE_CATEGORY_ORDER) {
    collapsed[cat] = false;
  }
  return { ...collapsed, ...readScopedJson<Record<string, boolean>>(SECTIONS_KEY, {}) };
}

function loadPreferenceState(): Pick<SidebarState, 'favoriteAssetIds' | 'recentAssetIds' | 'collapsedSections'> {
  return {
    favoriteAssetIds: readScopedJson<string[]>(FAVORITES_KEY, []),
    recentAssetIds: readScopedJson<string[]>(RECENT_KEY, []),
    collapsedSections: defaultCollapsed(),
  };
}

let state: SidebarState = {
  search: '',
  selectedAssetId: null,
  ...loadPreferenceState(),
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setState(patch: Partial<SidebarState>): void {
  state = { ...state, ...patch };
  emit();
}

export function rehydrateSidebarPreferences(): void {
  setState(loadPreferenceState());
}

export function subscribeSidebar(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSidebarState(): SidebarState {
  return state;
}

export function setSidebarSearch(search: string): void {
  setState({ search });
}

export function setSelectedAssetId(id: string | null): void {
  setState({ selectedAssetId: id });
}

export function toggleAssetFavorite(assetId: string): boolean {
  const exists = state.favoriteAssetIds.includes(assetId);
  const favoriteAssetIds = exists
    ? state.favoriteAssetIds.filter((t) => t !== assetId)
    : [...state.favoriteAssetIds, assetId];
  writeScopedJson(FAVORITES_KEY, favoriteAssetIds);
  setState({ favoriteAssetIds });
  return !exists;
}

export function isAssetFavorite(assetId: string): boolean {
  return state.favoriteAssetIds.includes(assetId);
}

export function recordAssetUse(assetId: string): void {
  const filtered = state.recentAssetIds.filter((t) => t !== assetId);
  const recentAssetIds = [assetId, ...filtered].slice(0, MAX_RECENT);
  writeScopedJson(RECENT_KEY, recentAssetIds);
  setState({ recentAssetIds });
}

export function removeRecentAsset(assetId: string): void {
  const recentAssetIds = state.recentAssetIds.filter((t) => t !== assetId);
  writeScopedJson(RECENT_KEY, recentAssetIds);
  setState({ recentAssetIds });
}

export function toggleSectionCollapsed(category: string): void {
  const collapsedSections = {
    ...state.collapsedSections,
    [category]: !state.collapsedSections[category],
  };
  writeScopedJson(SECTIONS_KEY, collapsedSections);
  setState({ collapsedSections });
}

export function isSectionCollapsed(category: string): boolean {
  return !!state.collapsedSections[category];
}

export function useSidebarStore<T>(selector: (s: SidebarState) => T): T {
  return useSyncExternalStore(subscribeSidebar, () => selector(getSidebarState()));
}
