import { rehydrateSidebarPreferences } from '@/features/builder/asset-library/sidebar-store';
import { notifyTemplatePreferencesChange } from '@/features/template-gallery/template-manager';

/** Reload recent/favourite data for the current signed-in user. */
export function rehydrateUserLocalPreferences(): void {
  rehydrateSidebarPreferences();
  notifyTemplatePreferencesChange();
}
