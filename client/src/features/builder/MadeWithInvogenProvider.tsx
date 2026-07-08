import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { resolveMediaUrl } from '@/lib/media';
import type { SubscriptionStatusPayload } from '@/hooks/useAdminSubscription';

export type MadeWithInvogenSource = 'admin' | 'employee' | 'none';

type MadeWithInvogenValue = {
  show: boolean;
  name: string;
  logoUrl?: string;
};

const DEFAULT_VALUE: MadeWithInvogenValue = {
  show: false,
  name: 'Invogen',
};

const MadeWithInvogenContext = createContext<MadeWithInvogenValue>(DEFAULT_VALUE);

type AuthBranding = {
  name: string;
  logo: string;
};

/**
 * Loads plan "Made with Invogen" advertising flag + platform branding.
 * Use `forcedShow` for public invoice links (no auth subscription endpoint).
 */
export function MadeWithInvogenProvider({
  children,
  source = 'admin',
  forcedShow,
}: {
  children: ReactNode;
  source?: MadeWithInvogenSource;
  /** When set, skip subscription fetch and use this value (public invoice view). */
  forcedShow?: boolean;
}) {
  const useAdminStatus = forcedShow === undefined && source === 'admin';
  const useEmployeeStatus = forcedShow === undefined && source === 'employee';

  // Reuse AdminLayout's `admin-subscription-status` cache when available.
  const { data: adminStatus } = useQuery({
    queryKey: ['admin-subscription-status'],
    queryFn: async () => {
      const res = await api.get<{ data: SubscriptionStatusPayload }>(
        '/admin/subscription/status'
      );
      return res.data.data;
    },
    enabled: useAdminStatus,
    staleTime: 0,
  });

  const { data: employeeFlag } = useQuery({
    queryKey: ['made-with-invogen-plan', 'employee'],
    queryFn: async (): Promise<boolean> => {
      const res = await api.get<{ data: { showMadeWithInvogen?: boolean } }>(
        '/employee/plan-advertising'
      );
      return res.data.data?.showMadeWithInvogen === true;
    },
    enabled: useEmployeeStatus,
    staleTime: 60_000,
  });

  const show =
    forcedShow ??
    (useAdminStatus
      ? adminStatus?.showMadeWithInvogen === true
      : useEmployeeStatus
        ? employeeFlag === true
        : false);

  const { data: branding } = useQuery({
    queryKey: ['auth-branding'],
    queryFn: async () =>
      (await api.get<{ data: AuthBranding }>('/auth/branding')).data.data,
    enabled: show,
    staleTime: 5 * 60_000,
  });

  const value = useMemo<MadeWithInvogenValue>(() => {
    if (!show) return DEFAULT_VALUE;
    return {
      show: true,
      name: branding?.name?.trim() || 'Invogen',
      logoUrl: resolveMediaUrl(branding?.logo),
    };
  }, [show, branding?.name, branding?.logo]);

  return (
    <MadeWithInvogenContext.Provider value={value}>
      {children}
    </MadeWithInvogenContext.Provider>
  );
}

export function useMadeWithInvogen(): MadeWithInvogenValue {
  return useContext(MadeWithInvogenContext);
}

export function madeWithInvogenSourceFromApiBase(apiBase: string): MadeWithInvogenSource {
  if (apiBase.includes('super-admin')) return 'none';
  if (apiBase.includes('employee')) return 'employee';
  return 'admin';
}
