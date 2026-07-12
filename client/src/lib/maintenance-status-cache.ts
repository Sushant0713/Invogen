import { queryClient } from '@/lib/query-client';

export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  companyName: string;
}

export const MAINTENANCE_QUERY_KEY = ['maintenance-status'] as const;

export function setMaintenanceStatusCache(
  enabled: boolean,
  message?: string,
  companyName?: string
) {
  queryClient.setQueryData<MaintenanceStatus>(MAINTENANCE_QUERY_KEY, (prev) => ({
    enabled,
    message:
      message?.trim() ||
      prev?.message ||
      'We are currently performing scheduled maintenance. Please check back soon.',
    companyName: companyName?.trim() || prev?.companyName || 'Invogen',
  }));
}
