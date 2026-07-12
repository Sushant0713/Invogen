import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  type CompanyBranding,
  type CompanyBrandingScope,
  EMPTY_COMPANY_BRANDING,
} from './company-branding';
import { useCompanyBrandingQuery } from './use-company-branding-query';

const CompanyBrandingContext = createContext<CompanyBranding>(EMPTY_COMPANY_BRANDING);
const CompanyScopeContext = createContext<CompanyBrandingScope>('admin');

export function CompanyBrandingProvider({
  scope,
  override,
  children,
}: {
  scope: CompanyBrandingScope;
  /** Skip fetch latency — used for headless PDF render pages. */
  override?: Partial<CompanyBranding>;
  children: ReactNode;
}) {
  const { data } = useCompanyBrandingQuery(scope);
  const value = useMemo(
    () => ({
      ...(data ?? EMPTY_COMPANY_BRANDING),
      ...(override ?? {}),
    }),
    [data, override]
  );

  return (
    <CompanyScopeContext.Provider value={scope}>
      <CompanyBrandingContext.Provider value={value}>{children}</CompanyBrandingContext.Provider>
    </CompanyScopeContext.Provider>
  );
}

export function useCompanyBranding(): CompanyBranding {
  return useContext(CompanyBrandingContext);
}

export function useCompanyScope(): CompanyBrandingScope {
  return useContext(CompanyScopeContext);
}
