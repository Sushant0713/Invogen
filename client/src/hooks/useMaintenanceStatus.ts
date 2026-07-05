import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';

export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  companyName: string;
}

export function useMaintenanceStatus() {
  return useQuery({
    queryKey: ['maintenance-status'],
    queryFn: async () => (await api.get('/auth/maintenance')).data.data as MaintenanceStatus,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
