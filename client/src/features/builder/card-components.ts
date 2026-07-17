import { ComponentType } from '@invogen/shared';
import { resolveCardLineGlyphKey } from './icon-components';

export type CardFieldDef = {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  prefix?: string;
};

export interface CardCustomField {
  id: string;
  label: string;
  value: string;
}

const PLACEHOLDER_TOKEN_RE = /^\{\{\w+\}\}$/;

export function isUnresolvedCardPlaceholder(value: string): boolean {
  const trimmed = value.trim();
  // Empty string is a valid user value (meaning "hide this line by clearing it").
  // Only treat {{Token}} values as unresolved placeholders.
  return PLACEHOLDER_TOKEN_RE.test(trimmed);
}

export function parseCardCustomFields(raw: unknown): CardCustomField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === 'string' ? row.id : '';
      const label = typeof row.label === 'string' ? row.label : '';
      const value = typeof row.value === 'string' ? row.value : '';
      if (!id) return null;
      return { id, label, value };
    })
    .filter((item): item is CardCustomField => item !== null);
}

export function parseHiddenCardFields(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

/** Field keys whose card line should render a leading icon. */
export function parseCardFieldIcons(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

export function setCardFieldIcon(list: unknown, key: string, enabled: boolean): string[] {
  const set = new Set(parseCardFieldIcons(list));
  if (enabled) set.add(key);
  else set.delete(key);
  return [...set];
}

export function isCustomCardFieldHidden(hidden: Set<string>, id: string): boolean {
  return hidden.has(`custom:${id}`);
}

export function setCustomCardFieldHidden(
  hiddenFields: string[],
  id: string,
  hidden: boolean
): string[] {
  const key = `custom:${id}`;
  const set = new Set(parseHiddenCardFields(hiddenFields));
  if (hidden) set.add(key);
  else set.delete(key);
  return [...set];
}

export function createCardCustomField(label = 'New field'): CardCustomField {
  return {
    id: crypto.randomUUID(),
    label,
    value: '',
  };
}

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

export function getCardFieldDef(type: string, key: string): CardFieldDef | undefined {
  return getCardFieldDefs(type).find((field) => field.key === key);
}

export function getCardVisibleFieldDefs(type: string, props: Record<string, unknown>): CardFieldDef[] {
  const hidden = new Set(parseHiddenCardFields(props.hiddenFields));
  return getCardFieldDefs(type).filter((field) => !hidden.has(field.key));
}

export function getCardFieldValue(
  props: Record<string, unknown>,
  key: string,
  placeholder: string
): string {
  const raw = props[key];
  if (typeof raw === 'string') {
    if (isUnresolvedCardPlaceholder(raw)) return placeholder;
    return raw;
  }
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

export type CardDisplayLine = {
  text: string;
  bold?: boolean;
  isPlaceholder?: boolean;
  iconKey?: string;
  /** When set, icon sits beside the whole block (Address-style), not centered on one line. */
  iconBesideBlock?: boolean;
};

export function getCardDisplayLines(
  type: string,
  props: Record<string, unknown>,
  options?: { customValuePlaceholder?: (label: string) => string }
): CardDisplayLine[] {
  const defs = getCardVisibleFieldDefs(type, props);
  const hidden = new Set(parseHiddenCardFields(props.hiddenFields));
  const iconFields = new Set(parseCardFieldIcons(props.fieldIcons));
  if (!defs.length && !parseCardCustomFields(props.customFields).length) return [];

  const lines: CardDisplayLine[] = [];
  const titleDef = defs.find((f) => f.key === 'title');
  if (titleDef) {
    const raw = props[titleDef.key];
    const title = getCardFieldValue(props, titleDef.key, titleDef.placeholder);
    if (title.trim()) {
      lines.push({
        text: title,
        bold: true,
        isPlaceholder: typeof raw === 'string' && isUnresolvedCardPlaceholder(raw),
      });
    }
  }

  for (const field of defs) {
    if (field.key === 'title') continue;
    const raw = props[field.key];
    const value = getCardFieldValue(props, field.key, field.placeholder);
    if (!value.trim()) continue;

    const isPlaceholder = typeof raw === 'string' && isUnresolvedCardPlaceholder(raw);
    const lineIcon = iconFields.has(field.key)
      ? resolveCardLineGlyphKey(type, field.key)
      : undefined;

    if (field.multiline) {
      const bodyLines = value
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => line.trim());
      if (!bodyLines.length) continue;

      // Address (and other multiline) with logo: one block + icon in front of the text
      // — same behaviour as the Address component.
      if (lineIcon && field.key === 'address') {
        lines.push({
          text: bodyLines.join('\n'),
          isPlaceholder,
          iconKey: lineIcon,
          iconBesideBlock: true,
        });
        continue;
      }

      let first = true;
      for (const line of bodyLines) {
        lines.push({ text: line, isPlaceholder, iconKey: first ? lineIcon : undefined });
        first = false;
      }
      continue;
    }

    const text = field.prefix ? `${field.prefix}${value}` : value;
    lines.push({ text, isPlaceholder, iconKey: lineIcon });
  }

  const customFields = parseCardCustomFields(props.customFields);
  for (const field of customFields) {
    if (isCustomCardFieldHidden(hidden, field.id)) continue;
    const label = field.label.trim() || 'New field';
    const value = field.value.trim();
    const sample = options?.customValuePlaceholder?.(label) ?? 'Enter value';
    const displayValue = value || sample;
    const lineIcon = iconFields.has(`custom:${field.id}`) ? 'verified' : undefined;
    lines.push({
      text: `${label}: ${displayValue}`,
      isPlaceholder: !value,
      iconKey: lineIcon,
    });
  }

  return lines;
}

const CARD_PREVIEW_LINE_HEIGHT = 1.45;
const CARD_PREVIEW_VERTICAL_PADDING_PX = 8;

/** Estimate rendered card height from visible lines (preview + auto-resize). */
export function estimateCardBlockHeight(
  type: string,
  props: Record<string, unknown>,
  width: number,
  minHeight: number
): number {
  void width;
  const lines = getCardDisplayLines(type, props);
  if (lines.length === 0) return minHeight;
  const fontSize =
    typeof props.fontSize === 'number' && props.fontSize > 0 ? props.fontSize : 12;
  const contentHeight = lines.length * fontSize * CARD_PREVIEW_LINE_HEIGHT;
  return Math.max(minHeight, Math.ceil(contentHeight + CARD_PREVIEW_VERTICAL_PADDING_PX));
}
