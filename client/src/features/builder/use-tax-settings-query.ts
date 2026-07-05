import type { QueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import {
  type TaxSettings,
  type TaxSettingsScope,
  TAX_SETTINGS_QUERY_KEY,
  EMPTY_TAX_SETTINGS,
  parseAdminCompanyTax,
  parseSystemTaxSettings,
} from './tax-settings';

type SettingRow = { key: string; value: unknown; scope?: string };

export function invalidateTaxSettings(queryClient: QueryClient, scope?: TaxSettingsScope) {
  if (scope) {
    void queryClient.invalidateQueries({ queryKey: [TAX_SETTINGS_QUERY_KEY, scope] });
    return;
  }
  void queryClient.invalidateQueries({ queryKey: [TAX_SETTINGS_QUERY_KEY] });
}

export function useTaxSettingsQuery(scope: TaxSettingsScope) {
  return useQuery({
    queryKey: [TAX_SETTINGS_QUERY_KEY, scope],
    queryFn: async (): Promise<TaxSettings> => {
      if (scope === 'super-admin') {
        const res = await api.get('/super-admin/settings', { params: { scope: 'system' } });
        return parseSystemTaxSettings(res.data.data as SettingRow[]);
      }
      const res = await api.get('/admin/company');
      return parseAdminCompanyTax(res.data.data as Record<string, unknown>);
    },
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 1,
    placeholderData: EMPTY_TAX_SETTINGS,
  });
}
