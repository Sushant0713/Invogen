import { ComponentType } from '@invogen/shared';
import { getResolvedImageSrc } from './image-components';

export type CompanyBrandingScope = 'admin' | 'super-admin' | 'employee';

export type CompanyBranding = {
  logo: string;
  signature: string;
};

export const EMPTY_COMPANY_BRANDING: CompanyBranding = {
  logo: '',
  signature: '',
};

export const COMPANY_BRANDING_QUERY_KEY = 'company-branding';

const PLACEHOLDER_SRC_RE = /^\{\{[\w.]+\}\}$/;

export function brandingScopeFromApiBase(apiBase: string): CompanyBrandingScope {
  if (apiBase.includes('super-admin')) return 'super-admin';
  if (apiBase.includes('/employee')) return 'employee';
  return 'admin';
}

export function companyApiForScope(scope: CompanyBrandingScope): string {
  if (scope === 'employee') return '/employee/company';
  return '/admin/company';
}

export function productsApiForScope(scope: CompanyBrandingScope): string {
  if (scope === 'employee') return '/employee/products/catalog';
  return '/admin/products';
}

export function isBrandingImageType(type: string): boolean {
  return type === ComponentType.LOGO || type === ComponentType.SIGNATURE;
}

/** True when the element should read logo/signature from company settings (no template override). */
export function isCompanyBrandingSource(src?: string): boolean {
  const trimmed = src?.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_SRC_RE.test(trimmed);
}

export function usesCompanyBrandingSource(type: string, src?: string): boolean {
  return isBrandingImageType(type) && isCompanyBrandingSource(src);
}

export function resolveBrandingImageSrc(
  type: string,
  src: string | undefined,
  branding: CompanyBranding | null | undefined
): string | undefined {
  if (!isBrandingImageType(type)) {
    return src?.trim() ? getResolvedImageSrc(src) : undefined;
  }

  if (!isCompanyBrandingSource(src)) {
    return getResolvedImageSrc(src);
  }

  if (!branding) return undefined;
  const key = type === ComponentType.LOGO ? branding.logo : branding.signature;
  return getResolvedImageSrc(key);
}

export function getBrandingSettingsLabel(type: string): string {
  return type === ComponentType.LOGO ? 'company logo' : 'company signature';
}
