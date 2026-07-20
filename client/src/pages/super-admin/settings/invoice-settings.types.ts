export interface InvoiceSellerDetails {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  website: string;
}

export interface InvoiceBankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
}

export interface InvoiceSettings {
  /** Super Admin template used for platform subscription invoices. */
  platformTemplateId: string;
  invoiceTitle: string;
  prefix: string;
  numberFormat: string;
  nextNumber: number;
  currency: string;
  timezone: string;
  dateFormat: string;
  defaultDueDays: number;
  seller: InvoiceSellerDetails;
  bank: InvoiceBankDetails;
  paymentDueText: string;
  latePaymentNote: string;
  subscriptionNote: string;
  termsAndConditions: string;
  thankYouNote: string;
  billingSupportEmail: string;
  signatoryLabel: string;
  signatoryFor: string;
  signatoryName: string;
  signatoryTitle: string;
  digitalSignatureNote: string;
  showGstSummary: boolean;
  showAmountInWords: boolean;
  enableRounding: boolean;
  showDiscount: boolean;
  defaultDiscount: number;
  cgstRate: number;
  sgstRate: number;
}

export const defaultInvoiceSettings = (): InvoiceSettings => ({
  platformTemplateId: '',
  invoiceTitle: 'INVOICE',
  prefix: 'INV',
  numberFormat: '{PREFIX}-{YYYY}-{NNNNN}',
  nextNumber: 187,
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  dateFormat: 'DD MMMM YYYY',
  defaultDueDays: 7,
  seller: {
    name: 'Invogen Technologies Pvt. Ltd.',
    addressLine1: '501, Business Hub Tower',
    addressLine2: 'Andheri East',
    city: 'Mumbai',
    state: 'Maharashtra',
    zipCode: '400069',
    country: 'India',
    gstin: '27AABCI5678K1Z2',
    pan: 'AABCI5678K',
    email: 'billing@invogen.com',
    phone: '+91 98765 43210',
    website: 'https://www.invogen.com',
  },
  bank: {
    bankName: 'HDFC Bank',
    accountName: 'Invogen Technologies Pvt. Ltd.',
    accountNumber: '50200012345678',
    ifscCode: 'HDFC0001234',
    upiId: 'invogen@hdfcbank',
  },
  paymentDueText: 'Within 7 Days',
  latePaymentNote: 'Late payment charges may apply after the due date.',
  subscriptionNote: 'Subscription services will continue as per the selected billing cycle.',
  termsAndConditions:
    'Payment is due within the specified due date. Late payments may incur additional charges. All subscription services continue per the selected billing cycle unless cancelled in writing.',
  thankYouNote: 'THANK YOU FOR YOUR BUSINESS',
  billingSupportEmail: 'billing@invogen.com',
  signatoryLabel: 'Authorized Signatory',
  signatoryFor: 'For Invogen Technologies Pvt. Ltd.',
  signatoryName: 'Authorized Signatory',
  signatoryTitle: 'Invogen Technologies Pvt. Ltd.',
  digitalSignatureNote: '(Digital Signature)',
  showGstSummary: true,
  showAmountInWords: true,
  enableRounding: true,
  showDiscount: true,
  defaultDiscount: 0,
  cgstRate: 9,
  sgstRate: 9,
});

export function formatInvoiceNumber(settings: InvoiceSettings): string {
  const year = new Date().getFullYear();
  const padded = String(settings.nextNumber).padStart(5, '0');
  return settings.numberFormat
    .replace(/\{PREFIX\}/g, settings.prefix)
    .replace(/\{YYYY\}/g, String(year))
    .replace(/\{NNNNN\}/g, padded)
    .replace(/\{NNNN\}/g, padded.slice(-4))
    .replace(/\{NNN\}/g, String(settings.nextNumber).padStart(3, '0'));
}

export function hydrateInvoiceSettings(raw: Partial<InvoiceSettings> | undefined): InvoiceSettings {
  const defaults = defaultInvoiceSettings();
  if (!raw || typeof raw !== 'object') return defaults;

  const legacy = raw as Partial<InvoiceSettings> & { templateStyle?: string };
  const { templateStyle: _legacyStyle, ...rest } = legacy;

  return {
    ...defaults,
    ...rest,
    platformTemplateId:
      typeof rest.platformTemplateId === 'string' ? rest.platformTemplateId : defaults.platformTemplateId,
    seller: { ...defaults.seller, ...rest.seller },
    bank: { ...defaults.bank, ...rest.bank },
  };
}

export function formatPreviewDate(daysOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
