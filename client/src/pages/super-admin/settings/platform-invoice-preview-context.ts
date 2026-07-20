import type { PlaceholderContext } from '@/features/template-gallery/placeholder-utils';
import {
  buildPlatformInvoiceTableLine,
  fillPlatformInvoiceTables,
  type PlatformInvoiceTableLine,
  type TemplatePage,
} from '@invogen/shared';
import type { InvoiceSettings } from './invoice-settings.types';
import { formatInvoiceNumber, formatPreviewDate } from './invoice-settings.types';
import { computeInvoiceTotals, formatInr } from './invoice-preview-data';
import type { TaxSettings } from '@/features/builder/tax-settings';
import { DEFAULT_TERMS_TITLE } from '@/features/builder/terms-content';
import { formatIndianStateWithCode } from '@/lib/location-data';

const PREVIEW_PLAN_NAME = 'Invogen Professional Plan';
const PREVIEW_BILLING_CYCLE = 'Monthly';

function formatSellerAddress(seller: InvoiceSettings['seller']): string {
  return [
    seller.addressLine1,
    seller.addressLine2,
    [seller.city, formatIndianStateWithCode(seller.state), seller.zipCode]
      .filter(Boolean)
      .join(', '),
    seller.country,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatBankBlock(bank: InvoiceSettings['bank']): string {
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

/** Sample subscription line for Super Admin platform invoice live preview. */
export function buildPlatformPreviewTableLine(form: InvoiceSettings): PlatformInvoiceTableLine {
  const { roundedTotal, subTotal, taxTotal, discount, cgst, sgst } = computeInvoiceTotals(form);
  return buildPlatformInvoiceTableLine({
    planName: PREVIEW_PLAN_NAME,
    billingCycle: PREVIEW_BILLING_CYCLE,
    subtotal: subTotal,
    discount,
    cgst,
    sgst,
    tax: taxTotal,
    total: roundedTotal,
  });
}

/** Apply selected-plan line item + discount into template tables. */
export function applyPlatformPreviewPlanToPages(
  pages: TemplatePage[],
  form: InvoiceSettings
): TemplatePage[] {
  return fillPlatformInvoiceTables(pages, buildPlatformPreviewTableLine(form));
}

/** Map billing-default settings → template {{Placeholder}} / composer field values. */
export function buildPlatformInvoicePlaceholderContext(form: InvoiceSettings): PlaceholderContext {
  const { roundedTotal, subTotal, taxTotal, discount, cgst, sgst, taxable } =
    computeInvoiceTotals(form);

  return {
    InvoiceTitle: form.invoiceTitle,
    CompanyName: form.seller.name,
    CompanyAddress: formatSellerAddress(form.seller),
    CompanyEmail: form.seller.email,
    CompanyPhone: form.seller.phone,
    CompanyGST: form.seller.gstin,
    CompanyPAN: form.seller.pan,
    CompanyWebsite: form.seller.website,
    ClientName: 'Sample Customer Pvt Ltd',
    InvoiceNumber: formatInvoiceNumber(form),
    Date: formatPreviewDate(0),
    DueDate: formatPreviewDate(form.defaultDueDays),
    GST: '29AABCT1332L1ZV',
    PAN: 'AABCT1332L',
    Address: '42 Business Park\nBengaluru, KA 560001',
    Email: 'billing@samplecustomer.com',
    Phone: '+91 98765 43210',
    State: 'Karnataka',
    PlaceOfSupply: form.seller.state,
    Amount: formatInr(roundedTotal),
    Subtotal: formatInr(subTotal),
    Tax: formatInr(taxTotal),
    Total: formatInr(roundedTotal),
    Discount: formatInr(discount),
    TaxableAmount: formatInr(taxable),
    CGST: formatInr(cgst),
    SGST: formatInr(sgst),
    CGSTRate: String(form.cgstRate),
    SGSTRate: String(form.sgstRate),
    PlanName: PREVIEW_PLAN_NAME,
    BillingCycle: PREVIEW_BILLING_CYCLE,
    PaymentDueText: form.paymentDueText,
    LatePaymentNote: form.latePaymentNote,
    SubscriptionNote: form.subscriptionNote,
    TermsAndConditions: form.termsAndConditions,
    TermsTitle: DEFAULT_TERMS_TITLE,
    ThankYouNote: form.thankYouNote,
    BillingSupportEmail: form.billingSupportEmail,
    SignatoryName: form.signatoryName,
    SignatoryTitle: form.signatoryTitle,
    SignatoryLabel: form.signatoryLabel,
    SignatoryFor: form.signatoryFor,
    DigitalSignatureNote: form.digitalSignatureNote,
    BankName: form.bank.bankName,
    BankAccountName: form.bank.accountName,
    BankAccountNumber: form.bank.accountNumber,
    BankIFSC: form.bank.ifscCode,
    BankUPI: form.bank.upiId,
    BankDetails: formatBankBlock(form.bank),
  };
}

/** Use CGST/SGST/IGST from billing defaults in the platform invoice live preview. */
export function buildPlatformPreviewTaxSettings(form: InvoiceSettings): TaxSettings {
  return {
    isEnabled: true,
    cgstRate: form.cgstRate,
    sgstRate: form.sgstRate,
    gstRate: form.cgstRate + form.sgstRate,
    igstRate: form.cgstRate + form.sgstRate,
    includeInPrice: false,
    taxDisplayMode: 'split',
  };
}
