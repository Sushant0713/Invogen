import type { QueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import type { CompanyBrandingScope } from './company-branding';
import { companyApiForScope } from './company-branding';
import {
  EMPTY_PRODUCT_SETTINGS,
  PRODUCT_SETTINGS_QUERY_KEY,
  parseProductSettings,
  type ProductSettings,
} from './product-settings';

export function invalidateProductSettings(queryClient: QueryClient, scope?: CompanyBrandingScope) {
  if (scope) {
    void queryClient.invalidateQueries({ queryKey: [PRODUCT_SETTINGS_QUERY_KEY, scope] });
    return;
  }
  void queryClient.invalidateQueries({ queryKey: [PRODUCT_SETTINGS_QUERY_KEY] });
}

export function useProductSettingsQuery(scope: CompanyBrandingScope = 'admin', enabled = true) {
  return useQuery({
    queryKey: [PRODUCT_SETTINGS_QUERY_KEY, scope],
    queryFn: async (): Promise<ProductSettings> => {
      const res = await api.get(companyApiForScope(scope));
      return parseProductSettings(res.data.data as Record<string, unknown>);
    },
    enabled,
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 1,
    placeholderData: EMPTY_PRODUCT_SETTINGS,
  });
}
