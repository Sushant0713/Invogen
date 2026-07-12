import type { CompanyBrandingScope } from './company-branding';

export type TaxDisplayMode = 'split' | 'combined' | 'igst';

export type TaxSettings = {
  isEnabled: boolean;
  cgstRate: number;
  sgstRate: number;
  /** Combined GST rate when using single GST column (defaults to CGST + SGST). */
  gstRate: number;
  /** IGST rate for inter-state invoices (single IGST column). */
  igstRate: number;
  /** Default tax column layout for invoice tables. */
  taxDisplayMode: TaxDisplayMode;
  includeInPrice: boolean;
};

export const EMPTY_TAX_SETTINGS: TaxSettings = {
  isEnabled: true,
  cgstRate: 9,
  sgstRate: 9,
  gstRate: 18,
  igstRate: 18,
  taxDisplayMode: 'split',
  includeInPrice: false,
};

export function getCombinedGstRate(tax: TaxSettings): number {
  if (typeof tax.gstRate === 'number' && tax.gstRate > 0) return tax.gstRate;
  return tax.cgstRate + tax.sgstRate;
}

export function getIgstRate(tax: TaxSettings): number {
  if (typeof tax.igstRate === 'number' && tax.igstRate > 0) return tax.igstRate;
  return getCombinedGstRate(tax);
}

export function normalizeTaxDisplayMode(value: unknown): TaxDisplayMode {
  if (value === 'combined' || value === 'igst' || value === 'split') return value;
  return EMPTY_TAX_SETTINGS.taxDisplayMode;
}

export const TAX_SETTINGS_QUERY_KEY = 'tax-settings';

export function parseTaxSettings(raw: unknown): TaxSettings {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_TAX_SETTINGS };
  const value = raw as Record<string, unknown>;
  const cgstRate = typeof value.cgstRate === 'number' ? value.cgstRate : EMPTY_TAX_SETTINGS.cgstRate;
  const sgstRate = typeof value.sgstRate === 'number' ? value.sgstRate : EMPTY_TAX_SETTINGS.sgstRate;
  const defaultRate = typeof value.defaultRate === 'number' ? value.defaultRate : undefined;
  const gstRate =
    typeof value.gstRate === 'number'
      ? value.gstRate
      : defaultRate ?? cgstRate + sgstRate;
  const igstRate =
    typeof value.igstRate === 'number'
      ? value.igstRate
      : typeof defaultRate === 'number'
        ? defaultRate
        : EMPTY_TAX_SETTINGS.igstRate;
  return {
    isEnabled: value.isEnabled !== false,
    cgstRate,
    sgstRate,
    gstRate,
    igstRate,
    taxDisplayMode: normalizeTaxDisplayMode(value.taxDisplayMode),
    includeInPrice: value.includeInPrice === true,
  };
}

export function parseAdminCompanyTax(company: Record<string, unknown> | undefined): TaxSettings {
  if (!company) return { ...EMPTY_TAX_SETTINGS };
  return parseTaxSettings(company.taxSettings);
}

type SettingRow = { key: string; value: unknown; scope?: string };

export function parseSystemTaxSettings(settings: SettingRow[] | undefined): TaxSettings {
  const row = settings?.find(
    (item) => item.key === 'tax_settings' && (!item.scope || item.scope === 'system')
  );
  return parseTaxSettings(row?.value);
}

export type TaxSettingsScope = CompanyBrandingScope;
