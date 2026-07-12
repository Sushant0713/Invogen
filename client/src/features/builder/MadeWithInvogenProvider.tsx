import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { resolveMediaUrl } from '@/lib/media';
import { useSubscriptionStatus, adminPlanSyncQueryOptions } from '@/hooks/useAdminSubscription';

export type MadeWithInvogenSource = 'admin' | 'employee' | 'none';

type MadeWithInvogenValue = {
  /** Plan allows advertising and super admin configured an image. */
  show: boolean;
  imageUrl?: string;
};

const DEFAULT_VALUE: MadeWithInvogenValue = {
  show: false,
};

const MadeWithInvogenContext = createContext<MadeWithInvogenValue>(DEFAULT_VALUE);

type AuthBranding = {
  madeWithImage?: string;
};

type EmployeePlanAdvertising = {
  showMadeWithInvogen?: boolean;
  madeWithImage?: string;
};

function resolveMadeWithImageUrl(raw?: string): string | undefined {
  return resolveMediaUrl(raw);
}

/**
 * Loads plan "Made with" advertising flag + super-admin badge image.
 * Use `forcedShow` + `forcedImage` for public invoice links.
 */
export function MadeWithInvogenProvider({
  children,
  source = 'admin',
  forcedShow,
  forcedImage,
}: {
  children: ReactNode;
  source?: MadeWithInvogenSource;
  /** When set, skip subscription fetch and use this value (public invoice view). */
  forcedShow?: boolean;
  forcedImage?: string;
}) {
  const isPublicOverride = forcedShow !== undefined;
  const useAdminStatus = !isPublicOverride && source === 'admin';
  const useEmployeeStatus = !isPublicOverride && source === 'employee';

  const { data: adminStatus } = useSubscriptionStatus({ enabled: useAdminStatus });

  const { data: employeeAdvertising } = useQuery({
    queryKey: ['made-with-invogen-plan', 'employee'],
    queryFn: async (): Promise<EmployeePlanAdvertising> => {
      const res = await api.get<{ data: EmployeePlanAdvertising }>('/employee/plan-advertising');
      return res.data.data;
    },
    enabled: useEmployeeStatus,
    ...adminPlanSyncQueryOptions,
  });

  const { data: branding } = useQuery({
    queryKey: ['auth-branding'],
    queryFn: async () =>
      (await api.get<{ data: AuthBranding }>('/auth/branding')).data.data,
    enabled: isPublicOverride || useAdminStatus || useEmployeeStatus,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const planAllowsAd = isPublicOverride
    ? forcedShow === true
    : useAdminStatus
      ? adminStatus?.showMadeWithInvogen === true
      : useEmployeeStatus
        ? employeeAdvertising?.showMadeWithInvogen === true
        : false;

  const imageUrl = useMemo(() => {
    if (isPublicOverride) {
      return (
        resolveMadeWithImageUrl(forcedImage)
        || resolveMadeWithImageUrl(branding?.madeWithImage)
      );
    }
    if (useAdminStatus) {
      return (
        resolveMadeWithImageUrl(adminStatus?.madeWithImage)
        || resolveMadeWithImageUrl(branding?.madeWithImage)
      );
    }
    if (useEmployeeStatus) {
      return (
        resolveMadeWithImageUrl(employeeAdvertising?.madeWithImage)
        || resolveMadeWithImageUrl(branding?.madeWithImage)
      );
    }
    return undefined;
  }, [
    isPublicOverride,
    forcedImage,
    useAdminStatus,
    useEmployeeStatus,
    adminStatus?.madeWithImage,
    employeeAdvertising?.madeWithImage,
    branding?.madeWithImage,
  ]);

  const value = useMemo<MadeWithInvogenValue>(() => {
    if (!planAllowsAd || !imageUrl) return DEFAULT_VALUE;
    return {
      show: true,
      imageUrl,
    };
  }, [planAllowsAd, imageUrl]);

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
