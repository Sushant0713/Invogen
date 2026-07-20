import type { TemplatePage, CanvasElement } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import {
  applyPlaceholdersToPages,
  type PlaceholderContext,
} from '@/features/template-gallery/placeholder-utils';
import { parseAddressFromProps, buildAddressProps } from '@/features/builder/address-content';
import { buildTermsProps, DEFAULT_TERMS_TITLE } from '@/features/builder/terms-content';
import {
  clampDueDateToInvoiceDate,
  formatIsoDate,
  getDatePickerValue,
  isDateFieldComponentType,
  normalizeInvoiceFormDates,
  toIsoDateValue,
} from '@/lib/date-format';
import { formatIndianStateWithCode, getIndianStateCode } from '@/lib/location-data';

const DATA_FIELD_KEYS: Partial<Record<ComponentType, keyof PlaceholderContext | string>> = {
  [ComponentType.INVOICE_NUMBER]: 'InvoiceNumber',
  [ComponentType.DATE]: 'Date',
  [ComponentType.DUE_DATE]: 'DueDate',
  [ComponentType.GST_NUMBER]: 'GST',
  [ComponentType.PAN_NUMBER]: 'PAN',
};

function patchPropsField(
  props: Record<string, unknown>,
  field: string,
  value: string | undefined,
  samplePlaceholder?: string
): Record<string, unknown> {
  const trimmed = value?.trim() ?? '';
  if (trimmed) return { ...props, [field]: trimmed };
  const current = props[field];
  if (typeof current === 'string' && /^\{\{\w+\}\}$/.test(current.trim())) {
    return { ...props, [field]: samplePlaceholder ?? '' };
  }
  return props;
}

function patchCardElement(
  element: CanvasElement,
  context: PlaceholderContext,
  mapping: Record<string, string>,
  fieldDefs: { key: string; placeholder: string }[]
): CanvasElement {
  const base = { ...(element.props ?? {}) } as Record<string, unknown>;
  const placeholders = Object.fromEntries(fieldDefs.map((field) => [field.key, field.placeholder]));
  let props = base;

  for (const [propKey, contextKey] of Object.entries(mapping)) {
    props = patchPropsField(
      props,
      propKey,
      context[contextKey],
      placeholders[propKey]
    );
  }

  return props === base ? element : { ...element, props };
}

function patchStructuredElements(pages: TemplatePage[], context: PlaceholderContext): TemplatePage[] {
  return pages.map((page) => ({
    ...page,
    elements: page.elements.map((element) => patchStructuredElement(element, context)),
  }));
}

function patchStructuredElement(element: CanvasElement, context: PlaceholderContext): CanvasElement {
  if (element.type === ComponentType.CUSTOMER_CARD) {
    return patchCardElement(element, context, {
      name: 'ClientName',
      address: 'Address',
      gst: 'GST',
      pan: 'PAN',
      email: 'Email',
      phone: 'Phone',
    }, [
      { key: 'name', placeholder: 'Customer Name' },
      { key: 'address', placeholder: 'Billing Address\nCity, State' },
      { key: 'gst', placeholder: '27XXXXXXXXXX1Z1' },
      { key: 'pan', placeholder: 'XXXXX9999X' },
      { key: 'email', placeholder: 'customer@email.com' },
      { key: 'phone', placeholder: '+91 98765 43210' },
    ]);
  }

  if (element.type === ComponentType.COMPANY_CARD) {
    const companyContext = {
      ...context,
      CompanyGST: context.CompanyGST ?? context.GST,
      CompanyPAN: context.CompanyPAN ?? context.PAN,
    };
    return patchCardElement(
      element,
      companyContext,
      {
        name: 'CompanyName',
        address: 'CompanyAddress',
        gst: 'CompanyGST',
        pan: 'CompanyPAN',
        email: 'CompanyEmail',
        phone: 'CompanyPhone',
      },
      [
        { key: 'name', placeholder: 'Company Name' },
        { key: 'address', placeholder: '123 Business Street\nCity, State 400001' },
        { key: 'gst', placeholder: '27XXXXXXXXXX1Z1' },
        { key: 'pan', placeholder: 'XXXXX9999X' },
        { key: 'email', placeholder: 'billing@company.com' },
        { key: 'phone', placeholder: '+91 98765 43210' },
      ]
    );
  }

  if (element.type === ComponentType.PAYMENT_DETAILS) {
    return patchCardElement(
      element,
      context,
      {
        bankName: 'BankName',
        accountName: 'BankAccountName',
        accountNumber: 'BankAccountNumber',
        ifsc: 'BankIFSC',
        branch: 'BankBranch',
        upi: 'BankUPI',
      },
      [
        { key: 'bankName', placeholder: 'HDFC Bank' },
        { key: 'accountName', placeholder: 'Company Pvt Ltd' },
        { key: 'accountNumber', placeholder: '50200012345678' },
        { key: 'ifsc', placeholder: 'HDFC0001234' },
        { key: 'branch', placeholder: 'Mumbai Main Branch' },
        { key: 'upi', placeholder: 'company@hdfcbank' },
      ]
    );
  }

  if (element.type === ComponentType.TERMS) {
    const termsText = context.TermsAndConditions?.trim();
    if (!termsText) return element;
    const items = termsText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const title =
      typeof context.TermsTitle === 'string' && context.TermsTitle.trim()
        ? context.TermsTitle.trim()
        : DEFAULT_TERMS_TITLE;
    return {
      ...element,
      props: buildTermsProps(title, items.length > 0 ? items : [termsText], element.props ?? {}),
    };
  }

  if (element.type === ComponentType.ADDRESS) {
    const raw = (element.props ?? {}) as Record<string, unknown>;
    const parsed = parseAddressFromProps(raw);
    const hint = `${parsed.title} ${String(raw.label ?? '')}`.toLowerCase();
    const isCompany = /from|company|supplier|seller|our business/.test(hint);
    const addressText = isCompany ? context.CompanyAddress : context.Address;
    if (!addressText?.trim()) return element;
    const lines = addressText.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) return element;
    return {
      ...element,
      props: buildAddressProps({ ...parsed, lines }, raw),
    };
  }

  const dataKey = DATA_FIELD_KEYS[element.type as ComponentType];
  if (element.type === ComponentType.FIELD) {
    const props = (element.props ?? {}) as Record<string, unknown>;
    const key = typeof props.dataKey === 'string' ? props.dataKey.trim() : '';
    if (!key) return element;
    let value: string | undefined = context[key];
    if (key === 'CompanyGST' || key === 'GST') {
      value = context.CompanyGST ?? context.GST;
    }
    if (key === 'CompanyPAN' || key === 'PAN') {
      value = context.CompanyPAN ?? context.PAN;
    }
    if (value == null || value === '') return element;
    const nextProps: Record<string, unknown> = { ...props, value };
    if ('textRuns' in nextProps) delete nextProps.textRuns;
    return { ...element, props: nextProps };
  }
  if (!dataKey) return element;

  let value: string | undefined = context[dataKey];
  if (element.type === ComponentType.GST_NUMBER) {
    value = context.CompanyGST ?? context.GST;
  }
  if (element.type === ComponentType.PAN_NUMBER) {
    value = context.CompanyPAN ?? context.PAN;
  }
  if (value == null || value === '') return element;

  if (isDateFieldComponentType(element.type)) {
    let isoValue = toIsoDateValue(String(value)) || String(value);
    if (element.type === ComponentType.DUE_DATE) {
      const invoiceIso = toIsoDateValue(String(context.Date ?? ''));
      isoValue = clampDueDateToInvoiceDate(invoiceIso, isoValue) || isoValue;
    }
    const nextProps: Record<string, unknown> = {
      ...(element.props ?? {}),
      value: isoValue,
      useLiveDate: false,
    };
    if ('textRuns' in nextProps) delete nextProps.textRuns;
    return { ...element, props: nextProps };
  }

  const nextProps: Record<string, unknown> = { ...(element.props ?? {}), value };
  // Drop stale rich-text runs so preview can't stack old + new date strings.
  if ('textRuns' in nextProps) delete nextProps.textRuns;
  return { ...element, props: nextProps };
}

/** Apply {{Placeholder}} tokens and sync data-field elements from the invoice form. */
export function applyInvoiceFormToPages(
  pages: TemplatePage[],
  context: PlaceholderContext
): TemplatePage[] {
  const normalized = normalizeInvoiceFormDates(context);
  const withPlaceholders = applyPlaceholdersToPages(pages, normalized);
  return patchStructuredElements(withPlaceholders, normalized);
}

export interface CompanyDefaults {
  name?: string;
  email?: string;
  phone?: string;
  gst?: string;
  pan?: string;
  bankDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    ifscCode?: string;
    branch?: string;
    upiId?: string;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  invoiceCode?: string;
  invoicePrefix?: string;
  invoiceNumberFormat?: string;
  nextInvoiceNumber?: number;
}

export function formatCompanyAddress(
  address?: CompanyDefaults['address']
): string {
  if (!address) return '';
  return [
    address.street,
    [address.city, formatIndianStateWithCode(address.state ?? '')].filter(Boolean).join(', '),
    [address.country, address.zipCode].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join('\n');
}

export function draftInvoiceNumber(company?: CompanyDefaults): string {
  const code = company?.invoiceCode || 'CO';
  const prefix = company?.invoicePrefix || 'INV';
  const next = company?.nextInvoiceNumber ?? 1;
  const format = company?.invoiceNumberFormat || '{PREFIX}-{NNNN}/{YYYY}';
  const padded = String(next).padStart(5, '0');
  const year = new Date().getFullYear();
  return format
    .replace(/\{CODE\}/g, code)
    .replace(/\{PREFIX\}/g, prefix)
    .replace(/\{YYYY\}/g, String(year))
    .replace(/\{NNNNN\}/g, padded)
    .replace(/\{NNNN\}/g, padded.slice(-4))
    .replace(/\{NNN\}/g, String(next).padStart(3, '0'));
}

/**
 * Read invoice / due dates from template date fields so a new invoice
 * keeps the dates configured on that template (instead of always today).
 * Live-date invoice fields still resolve to today.
 */
export function extractComposerDatesFromTemplate(pages: TemplatePage[]): {
  Date: string;
  DueDate: string;
} {
  const today = formatIsoDate();
  const fallbackDue = new Date();
  fallbackDue.setDate(fallbackDue.getDate() + 15);
  const fallbackDueIso = formatIsoDate(fallbackDue);

  let invoiceIso = '';
  let dueIso = '';

  for (const page of pages) {
    for (const element of page.elements) {
      const props = (element.props ?? {}) as Record<string, unknown>;
      if (element.type === ComponentType.DATE && !invoiceIso) {
        invoiceIso = getDatePickerValue(props, element.type);
      }
      if (element.type === ComponentType.DUE_DATE && !dueIso) {
        dueIso = getDatePickerValue(props, element.type);
      }
    }
  }

  if (!invoiceIso) invoiceIso = today;
  if (!dueIso) dueIso = fallbackDueIso;
  dueIso = clampDueDateToInvoiceDate(invoiceIso, dueIso) || dueIso;

  return { Date: invoiceIso, DueDate: dueIso };
}

export function buildInitialFormContext(
  placeholderKeys: string[],
  company?: CompanyDefaults,
  templatePages?: TemplatePage[]
): PlaceholderContext {
  const today = formatIsoDate();
  const due = new Date();
  due.setDate(due.getDate() + 15);
  const dueDate = formatIsoDate(due);
  const fromTemplate = templatePages?.length
    ? extractComposerDatesFromTemplate(templatePages)
    : null;

  const companyAddress = formatCompanyAddress(company?.address);

  const defaults: PlaceholderContext = {
    CompanyName: company?.name ?? '',
    CompanyAddress: companyAddress,
    CompanyEmail: company?.email ?? '',
    CompanyPhone: company?.phone ?? '',
    CompanyGST: company?.gst ?? '',
    CompanyPAN: company?.pan ?? '',
    BankName: company?.bankDetails?.bankName ?? '',
    BankAccountName: company?.bankDetails?.accountName ?? '',
    BankAccountNumber: company?.bankDetails?.accountNumber ?? '',
    BankIFSC: company?.bankDetails?.ifscCode ?? '',
    BankBranch: company?.bankDetails?.branch ?? '',
    BankUPI: company?.bankDetails?.upiId ?? '',
    ClientName: '',
    InvoiceNumber: draftInvoiceNumber(company),
    Date: fromTemplate?.Date ?? today,
    DueDate: fromTemplate?.DueDate ?? dueDate,
    GST: '',
    PAN: company?.pan ?? '',
    Address: '',
    Email: '',
    Phone: '',
    State: '',
    PlaceOfSupply: formatIndianStateWithCode(company?.address?.state ?? ''),
    StateCode: getIndianStateCode(company?.address?.state ?? ''),
    Amount: '',
    Subtotal: '',
    Tax: '',
    Total: '',
  };

  const context: PlaceholderContext = { ...defaults };
  placeholderKeys.forEach((key) => {
    if (context[key] == null) context[key] = '';
  });
  return normalizeInvoiceFormDates(context);
}

export interface CustomerRecord {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  gst?: string;
  pan?: string;
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
}

export function formatCustomerAddress(
  address?: CustomerRecord['billingAddress']
): string {
  if (!address) return '';
  return [
    address.street,
    [address.city, formatIndianStateWithCode(address.state ?? '')].filter(Boolean).join(', '),
    [address.country, address.zipCode].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join('\n');
}

export function customerToFormPatch(customer: CustomerRecord): PlaceholderContext {
  return {
    ClientName: customer.name ?? '',
    Email: customer.email ?? '',
    Phone: customer.phone ?? '',
    GST: customer.gst ?? '',
    PAN: customer.pan ?? '',
    Address: formatCustomerAddress(customer.billingAddress),
    State: formatIndianStateWithCode(customer.billingAddress?.state ?? ''),
    StateCode: getIndianStateCode(customer.billingAddress?.state ?? ''),
  };
}
