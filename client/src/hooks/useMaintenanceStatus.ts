import { queryOptions, useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import {
  MAINTENANCE_QUERY_KEY,
  type MaintenanceStatus,
} from '@/lib/maintenance-status-cache';

export type { MaintenanceStatus };

/** Assume platform is up when the status check fails (API down / proxy 502). */
export const MAINTENANCE_STATUS_FALLBACK: MaintenanceStatus = {
  enabled: false,
  message: '',
  companyName: 'Invogen',
};

/** Poll maintenance status without hammering auth rate limits. */
export const maintenanceStatusQueryOptions = queryOptions({
  queryKey: MAINTENANCE_QUERY_KEY,
  queryFn: async ({ signal }) =>
    (await api.get('/auth/maintenance', { signal, timeout: 5_000 })).data.data as MaintenanceStatus,
  staleTime: 15_000,
  retry: 1,
  retryDelay: 500,
  // Fail open so login / public pages are not stuck on a blank loader when the API is down.
  placeholderData: MAINTENANCE_STATUS_FALLBACK,
  refetchInterval: (query) => (query.state.data?.enabled ? 10_000 : 30_000),
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
});

export function useMaintenanceStatus() {
  return useQuery(maintenanceStatusQueryOptions);
}
