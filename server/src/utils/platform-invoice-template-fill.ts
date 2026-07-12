import {
  ComponentType,
  buildPlatformInvoiceTableLine,
  fillPlatformInvoiceTables,
  type CanvasElement,
  type PlatformInvoiceTableLine,
  type TemplatePage,
} from '@invogen/shared';
import { applyPlaceholdersToPages, type PlaceholderContext } from './template-placeholders';

export interface PlatformInvoiceSeller {
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  website?: string;
}

export interface PlatformInvoiceBank {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
}

export interface PlatformInvoiceSettingsValue {
  platformTemplateId?: string;
  invoiceTitle?: string;
  prefix?: string;
  numberFormat?: string;
  defaultDueDays?: number;
  paymentDueText?: string;
  latePaymentNote?: string;
  subscriptionNote?: string;
  termsAndConditions?: string;
  thankYouNote?: string;
  billingSupportEmail?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  signatoryFor?: string;
  digitalSignatureNote?: string;
  cgstRate?: number;
  sgstRate?: number;
  seller?: PlatformInvoiceSeller;
  bank?: PlatformInvoiceBank;
}

function formatInr(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
}

function formatLongDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatSellerAddress(seller: PlatformInvoiceSeller): string {
  return [
    seller.addressLine1,
    seller.addressLine2,
    [seller.city, seller.state, seller.zipCode].filter(Boolean).join(', '),
    seller.country,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatBuyerAddress(address?: {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}): string {
  if (!address) return '';
  return [
    address.street,
    [address.city, address.state].filter(Boolean).join(', '),
    [address.country, address.zipCode].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join('\n');
}

function formatBankBlock(bank?: PlatformInvoiceBank): string {
  if (!bank) return '';
  return [
    bank.bankName ? `Bank: ${bank.bankName}` : '',
    bank.accountName ? `Account name: ${bank.accountName}` : '',
    bank.accountNumber ? `Account no: ${bank.accountNumber}` : '',
    bank.ifscCode ? `IFSC: ${bank.ifscCode}` : '',
    bank.upiId ? `UPI: ${bank.upiId}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildSubscriptionInvoicePlaceholderContext(params: {
  settings: PlatformInvoiceSettingsValue;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  buyer: {
    name: string;
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
  };
  planName: string;
  billingCycle: string;
  currency: string;
  subtotal: number;
  discount: number;
  discountCode?: string;
  cgst: number;
  sgst: number;
  tax: number;
  total: number;
}): PlaceholderContext {
  const seller = params.settings.seller ?? { name: 'Invogen' };
  const bank = params.settings.bank;

  return {
    InvoiceTitle: params.settings.invoiceTitle || 'INVOICE',
    CompanyName: seller.name,
    CompanyAddress: formatSellerAddress(seller),
    CompanyEmail: seller.email || '',
    CompanyPhone: seller.phone || '',
    CompanyGST: seller.gstin || '',
    CompanyPAN: seller.pan || '',
    CompanyWebsite: seller.website || '',
    ClientName: params.buyer.name,
    InvoiceNumber: params.invoiceNumber,
    Date: formatLongDate(params.issueDate),
    DueDate: formatLongDate(params.dueDate),
    GST: params.buyer.gst || '',
    PAN: params.buyer.pan || '',
    Address: formatBuyerAddress(params.buyer.address),
    Email: params.buyer.email || '',
    Phone: params.buyer.phone || '',
    State: params.buyer.address?.state || '',
    PlaceOfSupply: seller.state || '',
    Amount: formatInr(params.total, params.currency),
    Subtotal: formatInr(params.subtotal, params.currency),
    Tax: formatInr(params.tax, params.currency),
    Total: formatInr(params.total, params.currency),
    Discount: formatInr(params.discount, params.currency),
    DiscountCode: params.discountCode || '',
    CGST: formatInr(params.cgst, params.currency),
    SGST: formatInr(params.sgst, params.currency),
    PlanName: params.planName,
    BillingCycle: params.billingCycle,
    PaymentDueText: params.settings.paymentDueText || '',
    LatePaymentNote: params.settings.latePaymentNote || '',
    SubscriptionNote: params.settings.subscriptionNote || '',
    TermsAndConditions: params.settings.termsAndConditions || '',
    TermsTitle: 'Terms and Conditions',
    ThankYouNote: params.settings.thankYouNote || '',
    BillingSupportEmail: params.settings.billingSupportEmail || seller.email || '',
    SignatoryName: params.settings.signatoryName || '',
    SignatoryTitle: params.settings.signatoryTitle || '',
    SignatoryFor: params.settings.signatoryFor || '',
    DigitalSignatureNote: params.settings.digitalSignatureNote || '',
    BankName: bank?.bankName || '',
    BankAccountName: bank?.accountName || '',
    BankAccountNumber: bank?.accountNumber || '',
    BankIFSC: bank?.ifscCode || '',
    BankUPI: bank?.upiId || '',
    BankDetails: formatBankBlock(bank),
  };
}

function patchPropsField(
  props: Record<string, unknown>,
  field: string,
  value: string | undefined
): Record<string, unknown> {
  const trimmed = value?.trim() ?? '';
  if (trimmed) return { ...props, [field]: trimmed };
  return props;
}

function patchCardElement(
  element: CanvasElement,
  context: PlaceholderContext,
  mapping: Record<string, string>
): CanvasElement {
  const base = { ...(element.props ?? {}) } as Record<string, unknown>;
  let props = base;
  for (const [propKey, contextKey] of Object.entries(mapping)) {
    props = patchPropsField(props, propKey, context[contextKey]);
  }
  return props === base ? element : { ...element, props };
}

function patchStructuredElement(element: CanvasElement, context: PlaceholderContext): CanvasElement {
  if (element.type === ComponentType.CUSTOMER_CARD) {
    return patchCardElement(element, context, {
      name: 'ClientName',
      address: 'Address',
      email: 'Email',
      phone: 'Phone',
    });
  }

  if (element.type === ComponentType.COMPANY_CARD) {
    return patchCardElement(element, context, {
      name: 'CompanyName',
      address: 'CompanyAddress',
      gst: 'CompanyGST',
      pan: 'CompanyPAN',
      email: 'CompanyEmail',
      phone: 'CompanyPhone',
    });
  }

  if (element.type === ComponentType.PAYMENT_DETAILS) {
    return patchCardElement(element, context, {
      bankName: 'BankName',
      accountName: 'BankAccountName',
      accountNumber: 'BankAccountNumber',
      ifsc: 'BankIFSC',
      upi: 'BankUPI',
    });
  }

  const dataFields: Partial<Record<ComponentType, string>> = {
    [ComponentType.INVOICE_NUMBER]: 'InvoiceNumber',
    [ComponentType.DATE]: 'Date',
    [ComponentType.DUE_DATE]: 'DueDate',
    [ComponentType.GST_NUMBER]: 'CompanyGST',
    [ComponentType.PAN_NUMBER]: 'CompanyPAN',
  };

  const dataKey = dataFields[element.type as ComponentType];
  if (dataKey) {
    let value = context[dataKey];
    if (element.type === ComponentType.GST_NUMBER) {
      value = context.CompanyGST ?? context.GST;
    }
    if (value?.trim()) {
      return { ...element, props: { ...(element.props ?? {}), value } };
    }
  }

  if (element.type === ComponentType.TERMS && context.TermsAndConditions?.trim()) {
    const items = context.TermsAndConditions.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const title = context.TermsTitle?.trim() || 'Terms and Conditions';
    return {
      ...element,
      props: {
        ...(element.props ?? {}),
        termsTitle: title,
        termsItems: items.length > 0 ? items : [context.TermsAndConditions],
        content: items.join('\n'),
      },
    };
  }

  return element;
}

export function applyInvoiceContextToPages(
  pages: TemplatePage[],
  context: PlaceholderContext,
  lineItem?: PlatformInvoiceTableLine
): TemplatePage[] {
  const withPlanTables = lineItem ? fillPlatformInvoiceTables(pages, lineItem) : pages;
  const withTokens = applyPlaceholdersToPages(withPlanTables, context);
  return withTokens.map((page) => ({
    ...page,
    elements: page.elements.map((element) => patchStructuredElement(element, context)),
  }));
}

/** Build the single subscription line used in platform invoice tables. */
export function buildSubscriptionInvoiceTableLine(params: {
  planName: string;
  billingCycle: string;
  subtotal: number;
  discount: number;
  discountCode?: string;
  cgst: number;
  sgst: number;
  tax: number;
  total: number;
}): PlatformInvoiceTableLine {
  return buildPlatformInvoiceTableLine(params);
}

export function cloneTemplatePages(pages: TemplatePage[]): TemplatePage[] {
  return JSON.parse(JSON.stringify(pages)) as TemplatePage[];
}
