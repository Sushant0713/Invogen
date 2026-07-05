import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  type CompanyBranding,
  type CompanyBrandingScope,
  EMPTY_COMPANY_BRANDING,
} from './company-branding';
import { useCompanyBrandingQuery } from './use-company-branding-query';

const CompanyBrandingContext = createContext<CompanyBranding>(EMPTY_COMPANY_BRANDING);

export function CompanyBrandingProvider({
  scope,
  children,
}: {
  scope: CompanyBrandingScope;
  children: ReactNode;
}) {
  const { data } = useCompanyBrandingQuery(scope);
  const value = useMemo(() => data ?? EMPTY_COMPANY_BRANDING, [data]);

  return (
    <CompanyBrandingContext.Provider value={value}>
      {children}
    </CompanyBrandingContext.Provider>
  );
}

export function useCompanyBranding(): CompanyBranding {
  return useContext(CompanyBrandingContext);
}
