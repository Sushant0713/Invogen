import type { TemplatePage, CanvasElement } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import {
  applyPlaceholdersToPages,
  type PlaceholderContext,
} from '@/features/template-gallery/placeholder-utils';

const DATA_FIELD_KEYS: Partial<Record<ComponentType, keyof PlaceholderContext | string>> = {
  [ComponentType.INVOICE_NUMBER]: 'InvoiceNumber',
  [ComponentType.DATE]: 'Date',
  [ComponentType.DUE_DATE]: 'DueDate',
  [ComponentType.GST_NUMBER]: 'GST',
  [ComponentType.PAN_NUMBER]: 'PAN',
};

function patchDataFieldElements(pages: TemplatePage[], context: PlaceholderContext): TemplatePage[] {
  return pages.map((page) => ({
    ...page,
    elements: page.elements.map((element) => patchElement(element, context)),
  }));
}

function patchElement(element: CanvasElement, context: PlaceholderContext): CanvasElement {
  const key = DATA_FIELD_KEYS[element.type as ComponentType];
  if (!key) return element;

  const value = context[key];
  if (value == null || value === '') return element;

  const props = { ...(element.props ?? {}), value };
  return { ...element, props };
}

/** Apply {{Placeholder}} tokens and sync data-field elements from the invoice form. */
export function applyInvoiceFormToPages(
  pages: TemplatePage[],
  context: PlaceholderContext
): TemplatePage[] {
  const withPlaceholders = applyPlaceholdersToPages(pages, context);
  return patchDataFieldElements(withPlaceholders, context);
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

  const defaults: PlaceholderContext = {
    CompanyName: company?.name ?? '',
    ClientName: '',
    InvoiceNumber: draftInvoiceNumber(company),
    Date: today,
    DueDate: dueDate,
    GST: company?.gst ?? '',
    PAN: company?.pan ?? '',
    Address: formatCompanyAddress(company?.address),
    Email: company?.email ?? '',
    Phone: company?.phone ?? '',
    State: company?.address?.state ?? '',
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
