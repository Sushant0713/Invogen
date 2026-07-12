import { queryOptions, useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import {
  MAINTENANCE_QUERY_KEY,
  type MaintenanceStatus,
} from '@/lib/maintenance-status-cache';

export type { MaintenanceStatus };

/** Poll maintenance status without hammering auth rate limits. */
export const maintenanceStatusQueryOptions = queryOptions({
  queryKey: MAINTENANCE_QUERY_KEY,
  queryFn: async () => (await api.get('/auth/maintenance')).data.data as MaintenanceStatus,
  staleTime: 60_000,
  refetchInterval: (query) => (query.state.data?.enabled ? 20_000 : 60_000),
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
});

export function useMaintenanceStatus() {
  return useQuery(maintenanceStatusQueryOptions);
}
