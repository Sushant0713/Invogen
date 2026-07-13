import type { InputHTMLAttributes } from 'react';

/** Semantic field kinds used across the app for correct HTML input attributes and formatting. */
export type FieldKind =
  | 'email'
  | 'password'
  | 'password-new'
  | 'password-confirm'
  | 'phone'
  | 'pincode'
  | 'gstin'
  | 'pan'
  | 'ifsc'
  | 'hsn'
  | 'url'
  | 'account-number'
  | 'upi'
  | 'price'
  | 'percentage'
  | 'port'
  | 'date';

export const FIELD_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  /** Indian mobile: 10 digits, optional +91 prefix */
  phone: /^(\+91[\s-]?)?[6-9]\d{9}$/,
  /** Indian PIN code */
  pincode: /^\d{6}$/,
  gstin: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  hsn: /^\d{4,8}$/,
  url: /^https?:\/\/.+/i,
  upi: /^[\w.-]+@[\w.-]+$/,
} as const;

const FIELD_KIND_CONFIG: Record<
  FieldKind,
  Pick<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'inputMode' | 'autoComplete' | 'pattern' | 'maxLength' | 'minLength' | 'min' | 'max' | 'step' | 'placeholder' | 'spellCheck'
  >
> = {
  email: {
    type: 'email',
    inputMode: 'email',
    autoComplete: 'email',
    placeholder: 'name@company.com',
    spellCheck: false,
  },
  password: {
    type: 'password',
    autoComplete: 'current-password',
    minLength: 1,
  },
  'password-new': {
    type: 'password',
    autoComplete: 'new-password',
    minLength: 8,
  },
  'password-confirm': {
    type: 'password',
    autoComplete: 'new-password',
    minLength: 8,
  },
  phone: {
    type: 'tel',
    inputMode: 'tel',
    autoComplete: 'tel',
    maxLength: 15,
    placeholder: '+91 98765 43210',
    pattern: '[+0-9\\s-]{10,15}',
  },
  pincode: {
    type: 'text',
    inputMode: 'numeric',
    autoComplete: 'postal-code',
    maxLength: 6,
    placeholder: '560001',
    pattern: '\\d{6}',
  },
  gstin: {
    type: 'text',
    inputMode: 'text',
    autoComplete: 'off',
    maxLength: 15,
    placeholder: '29AABCU9603R1ZM',
    pattern: '[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]',
    spellCheck: false,
  },
  pan: {
    type: 'text',
    inputMode: 'text',
    autoComplete: 'off',
    maxLength: 10,
    placeholder: 'AABCU9603R',
    pattern: '[A-Z]{5}[0-9]{4}[A-Z]',
    spellCheck: false,
  },
  ifsc: {
    type: 'text',
    inputMode: 'text',
    autoComplete: 'off',
    maxLength: 11,
    placeholder: 'HDFC0001234',
    pattern: '[A-Z]{4}0[A-Z0-9]{6}',
    spellCheck: false,
  },
  hsn: {
    type: 'text',
    inputMode: 'numeric',
    autoComplete: 'off',
    maxLength: 8,
    placeholder: '998314',
    pattern: '\\d{4,8}',
  },
  url: {
    type: 'url',
    inputMode: 'url',
    autoComplete: 'url',
    placeholder: 'https://example.com',
    spellCheck: false,
  },
  'account-number': {
    type: 'text',
    inputMode: 'numeric',
    autoComplete: 'off',
    maxLength: 18,
    pattern: '\\d{9,18}',
  },
  upi: {
    type: 'text',
    inputMode: 'email',
    autoComplete: 'off',
    placeholder: 'name@upi',
    pattern: '[\\w.-]+@[\\w.-]+',
    spellCheck: false,
  },
  price: {
    type: 'number',
    inputMode: 'decimal',
    min: 0,
    step: '0.01',
  },
  percentage: {
    type: 'number',
    inputMode: 'decimal',
    min: 0,
    max: 100,
    step: '0.01',
  },
  port: {
    type: 'number',
    inputMode: 'numeric',
    min: 1,
    max: 65535,
    step: 1,
  },
  date: {
    type: 'date',
    autoComplete: 'off',
  },
};

/** Map common form field names to semantic kinds (used by generic CRUD forms). */
const FIELD_NAME_KIND_MAP: Record<string, FieldKind> = {
  email: 'email',
  companyEmail: 'email',
  company_email: 'email',
  fromEmail: 'email',
  billingSupportEmail: 'email',
  recipientEmail: 'email',
  smtpUser: 'email',
  password: 'password',
  confirmPassword: 'password-confirm',
  phone: 'phone',
  companyPhone: 'phone',
  company_phone: 'phone',
  mobile: 'phone',
  zipCode: 'pincode',
  zip: 'pincode',
  postalCode: 'pincode',
  pincode: 'pincode',
  gst: 'gstin',
  gstin: 'gstin',
  pan: 'pan',
  ifscCode: 'ifsc',
  ifsc: 'ifsc',
  hsn: 'hsn',
  website: 'url',
  price: 'price',
  cgstRate: 'percentage',
  sgstRate: 'percentage',
  igstRate: 'percentage',
  gstRate: 'percentage',
  defaultRate: 'percentage',
  defaultDiscount: 'percentage',
  smtpPort: 'port',
  accountNumber: 'account-number',
  upiId: 'upi',
};

export function inferFieldKind(name: string): FieldKind | undefined {
  return FIELD_NAME_KIND_MAP[name];
}

const PLACEHOLDER_KEY_KIND_MAP: Record<string, FieldKind> = {
  Email: 'email',
  CompanyEmail: 'email',
  Phone: 'phone',
  CompanyPhone: 'phone',
  GST: 'gstin',
  CompanyGST: 'gstin',
  PAN: 'pan',
  Date: 'date',
  DueDate: 'date',
};

const CARD_PROP_KEY_KIND_MAP: Record<string, FieldKind> = {
  email: 'email',
  phone: 'phone',
  gst: 'gstin',
  pan: 'pan',
  ifsc: 'ifsc',
  upi: 'upi',
  accountNumber: 'account-number',
};

export function placeholderKeyToFieldKind(key: string): FieldKind | undefined {
  return PLACEHOLDER_KEY_KIND_MAP[key] ?? inferFieldKind(key);
}

export function cardPropKeyToFieldKind(key: string): FieldKind | undefined {
  return CARD_PROP_KEY_KIND_MAP[key];
}

export function inferFieldKindFromLabel(label: string): FieldKind | undefined {
  const normalized = label.toLowerCase().trim();
  if (/\b(due\s*date|invoice\s*date|date)\b/.test(normalized)) return 'date';
  if (/\b(e-?mail)\b/.test(normalized)) return 'email';
  if (/\b(phone|mobile|tel)\b/.test(normalized)) return 'phone';
  if (/\b(pin\s*code|pincode|zip|postal)\b/.test(normalized)) return 'pincode';
  if (/\b(gst|gstin)\b/.test(normalized)) return 'gstin';
  if (/\bpan\b/.test(normalized)) return 'pan';
  if (/\bifsc\b/.test(normalized)) return 'ifsc';
  if (/\bupi\b/.test(normalized)) return 'upi';
  if (/\b(website|url)\b/.test(normalized)) return 'url';
  if (/\b(account\s*number|account\s*no)\b/.test(normalized)) return 'account-number';
  if (/\bhsn\b/.test(normalized)) return 'hsn';
  return inferFieldKind(label.replace(/\s+/g, ''));
}

export function resolveFieldKind(options: {
  propKey?: string;
  placeholderKey?: string;
  label?: string;
}): FieldKind | undefined {
  return (
    (options.propKey ? cardPropKeyToFieldKind(options.propKey) : undefined)
    ?? (options.placeholderKey ? placeholderKeyToFieldKind(options.placeholderKey) : undefined)
    ?? (options.label ? inferFieldKindFromLabel(options.label) : undefined)
  );
}

export function getFieldInputProps(kind: FieldKind): InputHTMLAttributes<HTMLInputElement> {
  return { ...FIELD_KIND_CONFIG[kind] };
}

export function getFieldKindPlaceholder(kind: FieldKind): string | undefined {
  return FIELD_KIND_CONFIG[kind].placeholder;
}

export function normalizeFieldInput(kind: FieldKind, value: string): string {
  switch (kind) {
    case 'gstin':
    case 'pan':
    case 'ifsc':
      return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    case 'pincode':
    case 'hsn':
    case 'account-number':
      return value.replace(/\D/g, '');
    case 'phone':
      return value.replace(/[^\d+\s-]/g, '').slice(0, 15);
    case 'upi':
      return value.toLowerCase().replace(/[^\w.@+-]/g, '');
    case 'email':
      return value.trim().toLowerCase();
    default:
      return value;
  }
}

export function validateFieldValue(
  kind: FieldKind,
  value: string,
  options?: { required?: boolean }
): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return options?.required ? 'This field is required' : undefined;
  }

  switch (kind) {
    case 'email':
      return FIELD_PATTERNS.email.test(trimmed) ? undefined : 'Enter a valid email address';
    case 'password':
    case 'password-new':
      return trimmed.length >= 8 ? undefined : 'At least 8 characters';
    case 'phone':
      return FIELD_PATTERNS.phone.test(trimmed.replace(/\s/g, ''))
        ? undefined
        : 'Enter a valid 10-digit mobile number';
    case 'pincode':
      return FIELD_PATTERNS.pincode.test(trimmed) ? undefined : 'Enter a valid 6-digit PIN code';
    case 'gstin':
      return FIELD_PATTERNS.gstin.test(trimmed) ? undefined : 'Enter a valid 15-character GSTIN';
    case 'pan':
      return FIELD_PATTERNS.pan.test(trimmed) ? undefined : 'Enter a valid 10-character PAN';
    case 'ifsc':
      return FIELD_PATTERNS.ifsc.test(trimmed) ? undefined : 'Enter a valid 11-character IFSC code';
    case 'hsn':
      return FIELD_PATTERNS.hsn.test(trimmed) ? undefined : 'Enter a valid 4–8 digit HSN code';
    case 'url':
      return FIELD_PATTERNS.url.test(trimmed) ? undefined : 'Enter a valid URL (https://...)';
    case 'upi':
      return FIELD_PATTERNS.upi.test(trimmed) ? undefined : 'Enter a valid UPI ID (name@bank)';
    default:
      return undefined;
  }
}
