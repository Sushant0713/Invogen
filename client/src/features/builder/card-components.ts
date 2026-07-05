import { ComponentType } from '@invogen/shared';

export type CardFieldDef = {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  prefix?: string;
};

export const CARD_COMPONENT_TYPES = [
  ComponentType.COMPANY_CARD,
  ComponentType.CUSTOMER_CARD,
  ComponentType.PAYMENT_DETAILS,
] as const;

export function isCardComponentType(type: string): boolean {
  return (CARD_COMPONENT_TYPES as readonly string[]).includes(type);
}

export const COMPANY_CARD_FIELDS: CardFieldDef[] = [
  { key: 'title', label: 'Section title', placeholder: 'From' },
  { key: 'name', label: 'Name', placeholder: 'Company Name' },
  { key: 'address', label: 'Address', placeholder: '123 Business Street\nCity, State 400001', multiline: true },
  { key: 'gst', label: 'GSTIN', placeholder: '27XXXXXXXXXX1Z1', prefix: 'GST: ' },
  { key: 'pan', label: 'PAN', placeholder: 'XXXXX9999X', prefix: 'PAN: ' },
  { key: 'email', label: 'Email', placeholder: 'billing@company.com' },
  { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210' },
];

export const CUSTOMER_CARD_FIELDS: CardFieldDef[] = [
  { key: 'title', label: 'Section title', placeholder: 'Bill To' },
  { key: 'name', label: 'Name', placeholder: 'Customer Name' },
  { key: 'address', label: 'Address', placeholder: 'Billing Address\nCity, State', multiline: true },
  { key: 'email', label: 'Email', placeholder: 'customer@email.com' },
  { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210' },
];

export const PAYMENT_DETAILS_FIELDS: CardFieldDef[] = [
  { key: 'title', label: 'Section title', placeholder: 'Payment Details' },
  { key: 'bankName', label: 'Bank name', placeholder: 'HDFC Bank' },
  { key: 'accountName', label: 'Account name', placeholder: 'Company Pvt Ltd' },
  { key: 'accountNumber', label: 'Account number', placeholder: '50200012345678' },
  { key: 'ifsc', label: 'IFSC', placeholder: 'HDFC0001234' },
  { key: 'upi', label: 'UPI ID', placeholder: 'company@hdfcbank' },
];

export function getCardFieldDefs(type: string): CardFieldDef[] {
  switch (type) {
    case ComponentType.COMPANY_CARD:
      return COMPANY_CARD_FIELDS;
    case ComponentType.CUSTOMER_CARD:
      return CUSTOMER_CARD_FIELDS;
    case ComponentType.PAYMENT_DETAILS:
      return PAYMENT_DETAILS_FIELDS;
    default:
      return [];
  }
}

export function getCardFieldValue(
  props: Record<string, unknown>,
  key: string,
  placeholder: string
): string {
  const raw = props[key];
  if (typeof raw === 'string') return raw;
  return placeholder;
}

export function getCardDefaultProps(type: string): Record<string, unknown> {
  const defs = getCardFieldDefs(type);
  const out: Record<string, unknown> = { fontSize: 12, color: '#000000' };
  for (const field of defs) {
    out[field.key] = field.placeholder;
  }
  return out;
}

export type CardDisplayLine = { text: string; bold?: boolean };

export function getCardDisplayLines(
  type: string,
  props: Record<string, unknown>
): CardDisplayLine[] {
  const defs = getCardFieldDefs(type);
  if (!defs.length) return [];

  const lines: CardDisplayLine[] = [];
  const titleDef = defs.find((f) => f.key === 'title');
  if (titleDef) {
    const title = getCardFieldValue(props, titleDef.key, titleDef.placeholder);
    if (title.trim()) lines.push({ text: title, bold: true });
  }

  for (const field of defs) {
    if (field.key === 'title') continue;
    const value = getCardFieldValue(props, field.key, field.placeholder);
    if (!value.trim()) continue;

    if (field.multiline) {
      for (const line of value.split('\n')) {
        if (line.trim()) lines.push({ text: line });
      }
      continue;
    }

    const text = field.prefix ? `${field.prefix}${value}` : value;
    lines.push({ text });
  }

  return lines;
}
