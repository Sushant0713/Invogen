import type { TemplatePage } from '@invogen/shared';

/** Keys supported in {{Placeholder}} syntax. */
export type PlaceholderKey =
  | 'CompanyName'
  | 'ClientName'
  | 'InvoiceNumber'
  | 'Date'
  | 'DueDate'
  | 'GST'
  | 'PAN'
  | 'Address'
  | 'Logo'
  | 'Email'
  | 'Phone'
  | 'Amount'
  | 'Subtotal'
  | 'Tax'
  | 'Total';

export type PlaceholderContext = Partial<Record<PlaceholderKey | string, string>>;

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

export function replacePlaceholdersInString(
  value: string,
  context: PlaceholderContext
): string {
  return value.replace(PLACEHOLDER_RE, (_, key: string) => context[key] ?? `{{${key}}}`);
}

function transformValue(value: unknown, context: PlaceholderContext): unknown {
  if (typeof value === 'string') return replacePlaceholdersInString(value, context);
  if (Array.isArray(value)) return value.map((item) => transformValue(item, context));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = transformValue(v, context);
    }
    return out;
  }
  return value;
}

/** Deep-clone pages and replace {{Placeholder}} tokens in all string props. */
export function applyPlaceholdersToPages(
  pages: TemplatePage[],
  context: PlaceholderContext
): TemplatePage[] {
  return transformValue(pages, context) as TemplatePage[];
}

const PLACEHOLDER_SCAN_RE = /\{\{(\w+)\}\}/g;

/** Collect unique {{Placeholder}} keys used anywhere in template pages. */
export function extractPlaceholderKeys(pages: TemplatePage[]): string[] {
  const keys = new Set<string>();

  const scan = (value: unknown) => {
    if (typeof value === 'string') {
      PLACEHOLDER_SCAN_RE.lastIndex = 0;
      let match = PLACEHOLDER_SCAN_RE.exec(value);
      while (match) {
        keys.add(match[1]);
        match = PLACEHOLDER_SCAN_RE.exec(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(scan);
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(scan);
    }
  };

  pages.forEach((page) => scan(page));
  return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

export const PLACEHOLDER_FIELD_LABELS: Record<string, string> = {
  CompanyName: 'Company name',
  CompanyAddress: 'Company address',
  CompanyEmail: 'Company email',
  CompanyPhone: 'Company phone',
  CompanyGST: 'Company GSTIN',
  ClientName: 'Customer name',
  InvoiceNumber: 'Invoice number',
  Date: 'Invoice date',
  DueDate: 'Due date',
  GST: 'GSTIN',
  PAN: 'PAN',
  Address: 'Address',
  Email: 'Email',
  Phone: 'Phone',
  Amount: 'Amount',
  Subtotal: 'Subtotal',
  Tax: 'Tax',
  Total: 'Total',
  State: 'State',
  PlaceOfSupply: 'Place of supply',
  StateCode: 'State code',
};

export function placeholderFieldLabel(key: string): string {
  return PLACEHOLDER_FIELD_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function isMultilinePlaceholder(key: string): boolean {
  return key === 'Address' || key.toLowerCase().includes('address');
}

/** Sample data for gallery previews — not stored in the template JSON. */
export const SAMPLE_PREVIEW_CONTEXT: PlaceholderContext = {
  CompanyName: 'Acme Industries Pvt Ltd',
  ClientName: 'John Smith',
  InvoiceNumber: 'INV-2026-0042',
  Date: '26 Jun 2026',
  DueDate: '10 Jul 2026',
  GST: '27AABCU9603R1ZM',
  PAN: 'AABCU9603R',
  Address: '42 Business Park\nMumbai, MH 400001',
  Email: 'billing@acme.com',
  Phone: '+91 98765 43210',
  Amount: '₹45,200.00',
  Subtotal: '₹38,305.08',
  Tax: '₹6,894.92',
  Total: '₹45,200.00',
};
