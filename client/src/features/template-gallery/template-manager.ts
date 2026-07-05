import { readScopedJson, writeScopedJson } from '@/lib/user-storage';

const FAVORITES_KEY = 'invogen:template-favorites';
const RECENT_KEY = 'invogen:template-recent';
const MAX_RECENT = 12;

/** Recently used entries older than this are removed automatically. */
export const RECENT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const preferenceListeners = new Set<() => void>();

export function subscribeTemplatePreferences(listener: () => void): () => void {
  preferenceListeners.add(listener);
  return () => preferenceListeners.delete(listener);
}

export function notifyTemplatePreferencesChange(): void {
  for (const listener of preferenceListeners) {
    listener();
  }
}

export function getFavoriteTemplateIds(): string[] {
  return readScopedJson<string[]>(FAVORITES_KEY, []);
}

export function isTemplateFavorite(id: string): boolean {
  return getFavoriteTemplateIds().includes(id);
}

export function toggleTemplateFavorite(id: string): boolean {
  const favorites = getFavoriteTemplateIds();
  const exists = favorites.includes(id);
  const next = exists ? favorites.filter((f) => f !== id) : [...favorites, id];
  writeScopedJson(FAVORITES_KEY, next);
  notifyTemplatePreferencesChange();
  return !exists;
}

export interface RecentTemplateEntry {
  id: string;
  usedAt: number;
}

function pruneRecentEntries(entries: RecentTemplateEntry[]): RecentTemplateEntry[] {
  const cutoff = Date.now() - RECENT_TTL_MS;
  return entries.filter((e) => e.usedAt >= cutoff);
}

function loadRecentEntries(): RecentTemplateEntry[] {
  const entries = readScopedJson<RecentTemplateEntry[]>(RECENT_KEY, []);
  const pruned = pruneRecentEntries(entries);
  if (pruned.length !== entries.length) {
    writeScopedJson(RECENT_KEY, pruned);
  }
  return pruned;
}

export function getRecentTemplateIds(): string[] {
  return loadRecentEntries().map((e) => e.id);
}

export function getRecentEntries(): RecentTemplateEntry[] {
  return loadRecentEntries();
}

export function recordTemplateUse(id: string): void {
  const entries = loadRecentEntries().filter((e) => e.id !== id);
  const next = [{ id, usedAt: Date.now() }, ...entries].slice(0, MAX_RECENT);
  writeScopedJson(RECENT_KEY, next);
  notifyTemplatePreferencesChange();
}

export function removeRecentTemplate(id: string): void {
  const entries = loadRecentEntries().filter((e) => e.id !== id);
  writeScopedJson(RECENT_KEY, entries);
  notifyTemplatePreferencesChange();
}
