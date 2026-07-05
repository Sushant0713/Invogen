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
  children,
}: {
  scope: TaxSettingsScope;
  children: ReactNode;
}) {
  const { data } = useTaxSettingsQuery(scope);
  const value = useMemo(() => data ?? EMPTY_TAX_SETTINGS, [data]);

  return (
    <TaxSettingsContext.Provider value={value}>
      {children}
    </TaxSettingsContext.Provider>
  );
}

export function useTaxSettings(): TaxSettings {
  return useContext(TaxSettingsContext);
}
