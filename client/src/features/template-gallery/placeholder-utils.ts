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

/** Mustache tokens: {{ClientName}} */
const MUSTACHE_RE = /\{\{(\w+)\}\}/g;
/** Angle-bracket tokens in text: <your name> */
const ANGLE_RE = /<\s*([^<>]+?)\s*>/g;

/** Normalize `<your name >` → `your name` (stable formContext key + label). */
export function normalizeAnglePlaceholderLabel(inner: string): string {
  return inner.trim().replace(/\s+/g, ' ');
}

/** Visible marker when a field has no value yet — keeps the label on the canvas. */
export function unresolvedPlaceholderDisplay(key: string): string {
  return `<${key}>`;
}

function resolvedPlaceholderValue(
  key: string,
  context: PlaceholderContext,
  unresolvedFallback: string
): string {
  const raw = context[key];
  if (typeof raw === 'string' && raw.trim()) return raw;
  return unresolvedFallback;
}

export function replacePlaceholdersInString(
  value: string,
  context: PlaceholderContext
): string {
  let next = value.replace(MUSTACHE_RE, (_, key: string) =>
    resolvedPlaceholderValue(key, context, `{{${key}}}`)
  );
  next = next.replace(ANGLE_RE, (_, inner: string) => {
    const key = normalizeAnglePlaceholderLabel(inner);
    if (!key) return `<${inner}>`;
    return resolvedPlaceholderValue(key, context, unresolvedPlaceholderDisplay(key));
  });
  return next;
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

/** Deep-clone pages and replace {{Placeholder}} / <field> tokens in all string props. */
export function applyPlaceholdersToPages(
  pages: TemplatePage[],
  context: PlaceholderContext
): TemplatePage[] {
  return transformValue(pages, context) as TemplatePage[];
}

function collectKeysFromString(value: string, keys: Set<string>) {
  MUSTACHE_RE.lastIndex = 0;
  let match = MUSTACHE_RE.exec(value);
  while (match) {
    keys.add(match[1]);
    match = MUSTACHE_RE.exec(value);
  }

  ANGLE_RE.lastIndex = 0;
  match = ANGLE_RE.exec(value);
  while (match) {
    const label = normalizeAnglePlaceholderLabel(match[1]);
    if (label) keys.add(label);
    match = ANGLE_RE.exec(value);
  }
}

/** Collect placeholders from a single text string (content / heading body). */
export function extractPlaceholderKeysFromText(value: string): string[] {
  const keys = new Set<string>();
  collectKeysFromString(value, keys);
  return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

/** Collect unique {{Placeholder}} and <field> keys used anywhere in template pages. */
export function extractPlaceholderKeys(pages: TemplatePage[]): string[] {
  const keys = new Set<string>();

  const scan = (value: unknown) => {
    if (typeof value === 'string') {
      collectKeysFromString(value, keys);
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
  InvoiceTitle: 'Invoice title',
  CompanyPAN: 'Company PAN',
  CompanyWebsite: 'Company website',
  BankName: 'Bank name',
  BankAccountName: 'Account name',
  BankAccountNumber: 'Account number',
  BankIFSC: 'IFSC code',
  BankUPI: 'UPI ID',
  BankDetails: 'Bank details',
  PaymentDueText: 'Payment due',
  LatePaymentNote: 'Late payment note',
  SubscriptionNote: 'Subscription note',
  TermsAndConditions: 'Terms and conditions',
  TermsTitle: 'Terms title',
  ThankYouNote: 'Thank you note',
  BillingSupportEmail: 'Billing support email',
  SignatoryName: 'Signatory name',
  SignatoryTitle: 'Signatory title',
  SignatoryLabel: 'Signatory label',
  SignatoryFor: 'Signatory for',
  DigitalSignatureNote: 'Digital signature note',
  Discount: 'Discount',
  TaxableAmount: 'Taxable amount',
  CGST: 'CGST',
  SGST: 'SGST',
  IGST: 'IGST',
  CGSTRate: 'CGST rate',
  SGSTRate: 'SGST rate',
  IGSTRate: 'IGST rate',
};

export function placeholderFieldLabel(key: string): string {
  if (PLACEHOLDER_FIELD_LABELS[key]) return PLACEHOLDER_FIELD_LABELS[key];
  // Angle-bracket keys are already human labels ("your name").
  if (key.includes(' ')) return key;
  return key.replace(/([a-z])([A-Z])/g, '$1 $2');
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
