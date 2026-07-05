import { Setting } from '../models';
import { AppError } from '../utils/AppError';

export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  companyName: string;
}

let cache: { expires: number; status: MaintenanceStatus } | null = null;
const CACHE_TTL_MS = 5_000;

export const maintenanceService = {
  clearCache() {
    cache = null;
  },

  async getStatus(): Promise<MaintenanceStatus> {
    if (cache && cache.expires > Date.now()) {
      return cache.status;
    }

    const [companySetting, securitySetting, legacySetting] = await Promise.all([
      Setting.findOne({ key: 'company_profile', scope: 'system' }),
      Setting.findOne({ key: 'security_settings', scope: 'system' }),
      Setting.findOne({ key: 'maintenance_mode', scope: 'system' }),
    ]);

    const company = (companySetting?.value || {}) as {
      maintenanceMode?: boolean;
      name?: string;
    };
    const security = (securitySetting?.value || {}) as { maintenanceMessage?: string };

    const enabled = company.maintenanceMode === true || legacySetting?.value === true;
    const status: MaintenanceStatus = {
      enabled,
      message:
        security.maintenanceMessage?.trim() ||
        'We are currently performing scheduled maintenance. Please check back soon.',
      companyName: company.name?.trim() || 'Invogen',
    };

    cache = { expires: Date.now() + CACHE_TTL_MS, status };
    return status;
  },

  async assertPortalAccessible(portal: 'super-admin' | 'admin' | 'employee') {
    if (portal === 'super-admin') return;
    const status = await this.getStatus();
    if (status.enabled) {
      throw new AppError(status.message, 503);
    }
  },
};
