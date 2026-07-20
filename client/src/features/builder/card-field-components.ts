import { ComponentType } from '@invogen/shared';
import {
  COMPANY_CARD_FIELDS,
  CUSTOMER_CARD_FIELDS,
  PAYMENT_DETAILS_FIELDS,
  type CardFieldDef,
} from './card-components';

/** Maps card prop keys → invoice form / placeholder context keys. */
export const COMPANY_FIELD_DATA_KEYS: Record<string, string> = {
  title: 'CompanyTitle',
  name: 'CompanyName',
  address: 'CompanyAddress',
  gst: 'CompanyGST',
  pan: 'CompanyPAN',
  email: 'CompanyEmail',
  phone: 'CompanyPhone',
};

export const CUSTOMER_FIELD_DATA_KEYS: Record<string, string> = {
  title: 'CustomerTitle',
  name: 'ClientName',
  address: 'Address',
  gst: 'GST',
  pan: 'PAN',
  email: 'Email',
  phone: 'Phone',
};

export const PAYMENT_FIELD_DATA_KEYS: Record<string, string> = {
  title: 'PaymentTitle',
  bankName: 'BankName',
  accountName: 'BankAccountName',
  accountNumber: 'BankAccountNumber',
  ifsc: 'BankIFSC',
  branch: 'BankBranch',
  upi: 'BankUPI',
};

/** Distinct Lucide / palette icon keys per card field. */
export const CARD_FIELD_ICON_BY_KEY: Record<string, string> = {
  title: 'field_heading',
  name: 'field_person',
  address: 'field_address',
  gst: 'field_gst',
  pan: 'field_pan',
  email: 'field_email',
  phone: 'field_phone',
  bankName: 'field_bank',
  accountName: 'field_person',
  accountNumber: 'field_account',
  ifsc: 'field_ifsc',
  branch: 'field_bank',
  upi: 'field_upi',
};

/** Dual-tone glyph keys used by LibraryIconTile (canvas + asset library). */
export const CARD_FIELD_GLYPH_BY_KEY: Record<string, string> = {
  title: 'verified',
  name: 'person',
  address: 'address',
  gst: 'gst',
  pan: 'pan',
  email: 'email',
  phone: 'phone',
  bankName: 'bank',
  accountName: 'person',
  accountNumber: 'card',
  ifsc: 'bank',
  branch: 'bank',
  upi: 'upi',
};

export function resolveCardFieldIconKey(
  fieldKey: string,
  prefix?: 'company' | 'customer' | 'payment'
): string {
  if (prefix === 'company' && fieldKey === 'name') return 'field_company';
  if (prefix === 'company' && fieldKey === 'title') return 'field_heading';
  if (prefix === 'payment' && fieldKey === 'accountName') return 'field_person';
  if (prefix === 'payment' && fieldKey === 'ifsc') return 'field_ifsc';
  return CARD_FIELD_ICON_BY_KEY[fieldKey] ?? 'field_generic';
}

export function resolveCardFieldGlyphKey(
  fieldKey: string,
  prefix?: 'company' | 'customer' | 'payment'
): string {
  if (prefix === 'company' && fieldKey === 'name') return 'building';
  if (prefix === 'company' && fieldKey === 'title') return 'building';
  if (prefix === 'customer' && fieldKey === 'title') return 'person';
  if (prefix === 'payment' && fieldKey === 'title') return 'wallet';
  if (prefix === 'payment' && fieldKey === 'ifsc') return 'bank';
  return CARD_FIELD_GLYPH_BY_KEY[fieldKey] ?? 'verified';
}

export type CardFieldPaletteDef = {
  id: string;
  label: string;
  category: string;
  iconKey: string;
  /** Dual-tone glyph for asset library + optional leading icon on canvas. */
  glyphKey: string;
  dataKey: string;
  fieldLabel: string;
  placeholder: string;
  multiline?: boolean;
};

function toPaletteDefs(
  prefix: 'company' | 'customer' | 'payment',
  groupLabel: string,
  category: string,
  fields: CardFieldDef[],
  dataKeys: Record<string, string>
): CardFieldPaletteDef[] {
  return fields
    .map((field) => {
      const dataKey = dataKeys[field.key];
      if (!dataKey) return null;
      const namePart = field.key === 'title' ? 'title' : field.label;
      return {
        id: `field_${prefix}_${field.key}`,
        // e.g. "Company Name", "Customer Email", "Payment IFSC"
        label: `${groupLabel} ${namePart}`,
        category,
        iconKey: resolveCardFieldIconKey(field.key, prefix),
        glyphKey: resolveCardFieldGlyphKey(field.key, prefix),
        dataKey,
        fieldLabel: field.label,
        placeholder: field.placeholder,
        multiline: field.multiline,
      };
    })
    .filter((item): item is CardFieldPaletteDef => item !== null);
}

/** Standalone Fields palette entries for every company/customer/payment card line. */
export const CARD_FIELD_PALETTE_DEFS: CardFieldPaletteDef[] = [
  ...toPaletteDefs(
    'company',
    'Company',
    'fields_company',
    COMPANY_CARD_FIELDS,
    COMPANY_FIELD_DATA_KEYS
  ),
  ...toPaletteDefs(
    'customer',
    'Customer',
    'fields_customer',
    CUSTOMER_CARD_FIELDS,
    CUSTOMER_FIELD_DATA_KEYS
  ),
  ...toPaletteDefs(
    'payment',
    'Payment',
    'fields_payment',
    PAYMENT_DETAILS_FIELDS,
    PAYMENT_FIELD_DATA_KEYS
  ),
];

export function getCardFieldDefaultProps(def: CardFieldPaletteDef): Record<string, unknown> {
  return {
    label: def.fieldLabel,
    value: def.placeholder,
    dataKey: def.dataKey,
    iconKey: def.glyphKey,
    fontSize: 12,
    color: '#000000',
    ...(def.multiline ? { multiline: true } : {}),
  };
}

export function isStandaloneFieldType(type: string): boolean {
  return type === ComponentType.FIELD;
}

export function resolveFieldDataKey(props: Record<string, unknown>): string | null {
  const key = props.dataKey;
  return typeof key === 'string' && key.trim() ? key.trim() : null;
}
