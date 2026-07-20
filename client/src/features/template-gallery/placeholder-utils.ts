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

type RunLike = { text: string } & Record<string, unknown>;

function isRunArray(value: unknown): value is RunLike[] {
  return (
    Array.isArray(value)
    && value.length > 0
    && value.every(
      (run) => run && typeof run === 'object' && typeof (run as RunLike).text === 'string'
    )
  );
}

type ReplacementSpan = { start: number; end: number; replacement: string };

function collectMatches(
  source: string,
  regex: RegExp,
  resolve: (match: RegExpExecArray) => string
): ReplacementSpan[] {
  const out: ReplacementSpan[] = [];
  regex.lastIndex = 0;
  let match = regex.exec(source);
  while (match) {
    const replacement = resolve(match);
    if (replacement !== match[0]) {
      out.push({ start: match.index, end: match.index + match[0].length, replacement });
    }
    match = regex.exec(source);
  }
  return out;
}

/**
 * Apply span replacements to rich-text runs. A token that spans run boundaries
 * gets its replacement in the run where the token starts, so bold/italic runs
 * stay in sync with the substituted plain content (getTextRuns' stale-run guard
 * would otherwise drop ALL formatting in the live preview).
 */
function applyMatchesToRuns(
  runs: RunLike[],
  source: string,
  matches: ReplacementSpan[]
): RunLike[] {
  if (matches.length === 0) return runs;

  // Owner run for each source char index.
  const owner = new Array<number>(source.length);
  let runIdx = 0;
  let runEnd = runs[0]?.text.length ?? 0;
  for (let i = 0; i < source.length; i += 1) {
    while (i >= runEnd && runIdx < runs.length - 1) {
      runIdx += 1;
      runEnd += runs[runIdx].text.length;
    }
    owner[i] = runIdx;
  }

  const texts = runs.map(() => '');
  let pos = 0;
  for (const match of matches) {
    for (let i = pos; i < match.start; i += 1) texts[owner[i]] += source[i];
    const target = owner[Math.min(match.start, source.length - 1)] ?? 0;
    texts[target] += match.replacement;
    pos = match.end;
  }
  for (let i = pos; i < source.length; i += 1) texts[owner[i]] += source[i];

  return runs
    .map((run, index) => ({ ...run, text: texts[index] }))
    .filter((run) => run.text.length > 0);
}

/** Substitute tokens in content + textRuns coherently (joined runs === content stays true). */
function replaceInRunsAndContent(
  content: string,
  runs: RunLike[],
  context: PlaceholderContext
): { content: string; textRuns: RunLike[] } {
  let source = content;
  let currentRuns = runs;
  const passes: Array<[RegExp, (m: RegExpExecArray) => string]> = [
    [MUSTACHE_RE, (m) => resolvedPlaceholderValue(m[1], context, `{{${m[1]}}}`)],
    [
      ANGLE_RE,
      (m) => {
        const key = normalizeAnglePlaceholderLabel(m[1]);
        if (!key) return m[0];
        return resolvedPlaceholderValue(key, context, unresolvedPlaceholderDisplay(key));
      },
    ],
  ];
  for (const [regex, resolve] of passes) {
    const matches = collectMatches(source, regex, resolve);
    if (matches.length === 0) continue;
    currentRuns = applyMatchesToRuns(currentRuns, source, matches);
    source = currentRuns.map((run) => run.text).join('');
  }
  return { content: source, textRuns: currentRuns };
}

function transformValue(value: unknown, context: PlaceholderContext): unknown {
  if (typeof value === 'string') return replacePlaceholdersInString(value, context);
  if (Array.isArray(value)) return value.map((item) => transformValue(item, context));
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    // Rich-text props: substitute content + runs as one string so they cannot
    // desync when a token spans run boundaries (which drops bold in preview).
    const plainKey =
      typeof obj.content === 'string' ? 'content' : typeof obj.text === 'string' ? 'text' : null;
    if (plainKey && isRunArray(obj.textRuns)) {
      const runs = obj.textRuns;
      const joined = runs.map((run) => run.text).join('');
      if (joined === obj[plainKey]) {
        const replaced = replaceInRunsAndContent(joined, runs, context);
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj)) {
          if (k === plainKey || k === 'textRuns') continue;
          out[k] = transformValue(v, context);
        }
        out[plainKey] = replaced.content;
        out.textRuns = replaced.textRuns;
        return out;
      }
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
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
  CompanyTitle: 'Company title',
  CustomerTitle: 'Customer title',
  PaymentTitle: 'Payment title',
  BankName: 'Bank name',
  BankAccountName: 'Account name',
  BankAccountNumber: 'Account number',
  BankIFSC: 'IFSC code',
  BankBranch: 'Bank branch',
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
