import type { QueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import {
  type CompanyBranding,
  type CompanyBrandingScope,
  COMPANY_BRANDING_QUERY_KEY,
  EMPTY_COMPANY_BRANDING,
} from './company-branding';

type SettingRow = { key: string; value: unknown; scope?: string };

function parseCompanyProfile(settings: SettingRow[] | undefined): CompanyBranding {
  const profile = settings?.find(
    (row) => row.key === 'company_profile' && (!row.scope || row.scope === 'system')
  )?.value;
  if (!profile || typeof profile !== 'object') return EMPTY_COMPANY_BRANDING;
  const value = profile as Record<string, unknown>;
  return {
    logo: typeof value.logo === 'string' ? value.logo : '',
    signature: typeof value.signature === 'string' ? value.signature : '',
  };
}

function parseAdminCompany(company: Record<string, unknown> | undefined): CompanyBranding {
  if (!company) return EMPTY_COMPANY_BRANDING;
  return {
    logo: typeof company.logo === 'string' ? company.logo : '',
    signature: typeof company.signature === 'string' ? company.signature : '',
  };
}

export function invalidateCompanyBranding(
  queryClient: QueryClient,
  scope?: CompanyBrandingScope
) {
  if (scope) {
    void queryClient.invalidateQueries({ queryKey: [COMPANY_BRANDING_QUERY_KEY, scope] });
    return;
  }
  void queryClient.invalidateQueries({ queryKey: [COMPANY_BRANDING_QUERY_KEY] });
}

export function useCompanyBrandingQuery(scope: CompanyBrandingScope) {
  return useQuery({
    queryKey: [COMPANY_BRANDING_QUERY_KEY, scope],
    queryFn: async (): Promise<CompanyBranding> => {
      if (scope === 'super-admin') {
        const res = await api.get('/super-admin/settings', { params: { scope: 'system' } });
        return parseCompanyProfile(res.data.data as SettingRow[]);
      }
      const res = await api.get('/admin/company');
      return parseAdminCompany(res.data.data as Record<string, unknown>);
    },
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
