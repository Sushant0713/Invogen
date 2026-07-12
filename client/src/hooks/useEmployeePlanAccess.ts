import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import type { SubscriptionStatusPayload } from '@/hooks/useAdminSubscription';

export const employeePlanSyncQueryOptions = {
  staleTime: 0,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
} as const;

export type EmployeePlanAccess = Pick<
  SubscriptionStatusPayload,
  'canAddTemplate' | 'templateAccessConfigured' | 'allowedTemplateIds' | 'showMadeWithInvogen' | 'madeWithImage'
>;

export function useEmployeePlanAccess(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['employee-plan-access'],
    queryFn: async () => {
      const res = await api.get<{ data: EmployeePlanAccess }>('/employee/plan-advertising');
      return res.data.data;
    },
    ...employeePlanSyncQueryOptions,
    enabled: options?.enabled ?? true,
  });
}
