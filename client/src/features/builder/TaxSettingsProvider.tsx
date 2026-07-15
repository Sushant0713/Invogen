import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  type TaxSettings,
  type TaxSettingsScope,
  EMPTY_TAX_SETTINGS,
} from './tax-settings';
import { useTaxSettingsQuery } from './use-tax-settings-query';

const TaxSettingsContext = createContext<TaxSettings>(EMPTY_TAX_SETTINGS);

export function TaxSettingsProvider({
  scope,
  override,
  children,
}: {
  scope: TaxSettingsScope;
  /** When set, skips the API query and uses these rates (e.g. platform invoice billing defaults). */
  override?: TaxSettings;
  children: ReactNode;
}) {
  const { data } = useTaxSettingsQuery(scope);
  const value = useMemo(() => override ?? data ?? EMPTY_TAX_SETTINGS, [override, data]);

  return (
    <TaxSettingsContext.Provider value={value}>
      {children}
    </TaxSettingsContext.Provider>
  );
}

export function useTaxSettings(): TaxSettings {
  return useContext(TaxSettingsContext);
}
