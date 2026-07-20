import { ComponentType } from '@invogen/shared';
import {
  COMPANY_FIELD_DATA_KEYS,
  PAYMENT_FIELD_DATA_KEYS,
} from './card-field-components';
import type { PaletteItem } from './palette-catalog';
import { formatIndianStateWithCode } from '@/lib/location-data';

export type CompanyDefaultsSource = {
  name?: string;
  email?: string;
  phone?: string;
  gst?: string;
  pan?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  bankDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    ifscCode?: string;
    branch?: string;
    upiId?: string;
  };
};

function formatAddress(address: CompanyDefaultsSource['address']): string {
  if (!address) return '';
  return [
    address.street,
    [address.city, formatIndianStateWithCode(address.state ?? '')].filter(Boolean).join(', '),
    [address.country, address.zipCode].filter(Boolean).join(' '),
  ].filter(Boolean).join('\n');
}

function nonEmpty(values: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
  );
}

export function getCompanyCardDefaultValues(
  company: CompanyDefaultsSource | undefined
): Record<string, string> {
  if (!company) return {};
  return nonEmpty({
    name: company.name,
    address: formatAddress(company.address),
    gst: company.gst,
    pan: company.pan,
    email: company.email,
    phone: company.phone,
  });
}

export function getPaymentCardDefaultValues(
  company: CompanyDefaultsSource | undefined
): Record<string, string> {
  if (!company) return {};
  return nonEmpty({
    bankName: company.bankDetails?.bankName,
    accountName: company.bankDetails?.accountName,
    accountNumber: company.bankDetails?.accountNumber,
    ifsc: company.bankDetails?.ifscCode,
    branch: company.bankDetails?.branch,
    upi: company.bankDetails?.upiId,
  });
}

/** Apply tenant defaults after global component defaults, so new assets use admin settings. */
export function applyCompanyDefaultsToPalette(
  items: PaletteItem[],
  company: CompanyDefaultsSource | undefined
): PaletteItem[] {
  if (!company) return items;
  const companyValues = getCompanyCardDefaultValues(company);
  const paymentValues = getPaymentCardDefaultValues(company);
  const companyByDataKey = Object.fromEntries(
    Object.entries(COMPANY_FIELD_DATA_KEYS).map(([propKey, dataKey]) => [dataKey, companyValues[propKey]])
  );
  const paymentByDataKey = Object.fromEntries(
    Object.entries(PAYMENT_FIELD_DATA_KEYS).map(([propKey, dataKey]) => [dataKey, paymentValues[propKey]])
  );

  return items.map((item) => {
    let overlay: Record<string, string> = {};
    if (item.type === ComponentType.COMPANY_CARD) overlay = companyValues;
    if (item.type === ComponentType.PAYMENT_DETAILS) overlay = paymentValues;
    if (item.type === ComponentType.FIELD) {
      const dataKey = String(item.defaultProps?.dataKey ?? '');
      const value = companyByDataKey[dataKey] ?? paymentByDataKey[dataKey];
      if (value) overlay = { value };
    }
    if (!Object.keys(overlay).length) return item;
    return { ...item, defaultProps: { ...item.defaultProps, ...overlay } };
  });
}
