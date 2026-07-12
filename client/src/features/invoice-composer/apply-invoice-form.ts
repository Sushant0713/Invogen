import type { TemplatePage, CanvasElement } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import {
  applyPlaceholdersToPages,
  type PlaceholderContext,
} from '@/features/template-gallery/placeholder-utils';
import { parseAddressFromProps, buildAddressProps } from '@/features/builder/address-content';
import { buildTermsProps, DEFAULT_TERMS_TITLE } from '@/features/builder/terms-content';

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
      email: 'Email',
      phone: 'Phone',
    }, [
      { key: 'name', placeholder: 'Customer Name' },
      { key: 'address', placeholder: 'Billing Address\nCity, State' },
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
  if (!dataKey) return element;

  let value: string | undefined = context[dataKey];
  if (element.type === ComponentType.GST_NUMBER) {
    value = context.CompanyGST ?? context.GST;
  }
  if (value == null || value === '') return element;

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
  const withPlaceholders = applyPlaceholdersToPages(pages, context);
  return patchStructuredElements(withPlaceholders, context);
}

export interface CompanyDefaults {
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
  invoicePrefix?: string;
  nextInvoiceNumber?: number;
}

export function formatCompanyAddress(
  address?: CompanyDefaults['address']
): string {
  if (!address) return '';
  return [
    address.street,
    [address.city, address.state].filter(Boolean).join(', '),
    [address.country, address.zipCode].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join('\n');
}

export function draftInvoiceNumber(company?: CompanyDefaults): string {
  const prefix = company?.invoicePrefix || 'INV';
  const next = company?.nextInvoiceNumber ?? 1;
  const padded = String(next).padStart(4, '0');
  const year = new Date().getFullYear();
  return `${prefix}-${padded}/${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
}

export function buildInitialFormContext(
  placeholderKeys: string[],
  company?: CompanyDefaults
): PlaceholderContext {
  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const due = new Date();
  due.setDate(due.getDate() + 15);
  const dueDate = due.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const companyAddress = formatCompanyAddress(company?.address);

  const defaults: PlaceholderContext = {
    CompanyName: company?.name ?? '',
    CompanyAddress: companyAddress,
    CompanyEmail: company?.email ?? '',
    CompanyPhone: company?.phone ?? '',
    CompanyGST: company?.gst ?? '',
    ClientName: '',
    InvoiceNumber: draftInvoiceNumber(company),
    Date: today,
    DueDate: dueDate,
    GST: '',
    PAN: company?.pan ?? '',
    Address: '',
    Email: '',
    Phone: '',
    State: '',
    PlaceOfSupply: company?.address?.state ?? '',
    StateCode: '',
    Amount: '',
    Subtotal: '',
    Tax: '',
    Total: '',
  };

  const context: PlaceholderContext = { ...defaults };
  placeholderKeys.forEach((key) => {
    if (context[key] == null) context[key] = '';
  });
  return context;
}

export interface CustomerRecord {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  gst?: string;
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
    [address.city, address.state].filter(Boolean).join(', '),
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
    Address: formatCustomerAddress(customer.billingAddress),
    State: customer.billingAddress?.state ?? '',
  };
}
