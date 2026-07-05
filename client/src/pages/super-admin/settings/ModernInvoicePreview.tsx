import { Globe, Mail, Phone } from 'lucide-react';
import {
  type InvoiceSettings,
  formatInvoiceNumber,
  formatPreviewDate,
} from './invoice-settings.types';
import { PREVIEW_LINE_ITEMS, computeInvoiceTotals, formatInr } from './invoice-preview-data';
import { resolveMediaUrl } from '@/lib/media';
import type { CompanyBranding } from './company-branding';

function CompanyLogo({ logoUrl, name }: { logoUrl?: string; name: string }) {
  const src = resolveMediaUrl(logoUrl);
  if (src) {
    return <img src={src} alt={name} className="h-16 w-16 object-contain" />;
  }

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-[9px] text-gray-400">
      Logo
    </div>
  );
}

function ContactRow({ icon: Icon, value }: { icon: typeof Phone; value: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-neutral-700">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
        <Icon className="h-3 w-3" />
      </span>
      <span>{value}</span>
    </div>
  );
}

export function ModernInvoicePreview({
  form,
  branding,
}: {
  form: InvoiceSettings;
  branding: CompanyBranding;
}) {
  const { subTotal, discount, taxable, cgst, sgst, taxTotal, grandTotal, roundedTotal } =
    computeInvoiceTotals(form);
  const signatureUrl = resolveMediaUrl(branding.signature);

  return (
    <div className="relative mx-auto w-full max-w-[210mm] overflow-hidden bg-white text-neutral-900 shadow-lg print:shadow-none">
      <div className="relative z-10 px-8 pb-10 pt-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <CompanyLogo logoUrl={branding.logo} name={form.seller.name} />
            <div>
              <p className="text-sm font-extrabold uppercase tracking-wide text-neutral-900">
                {form.seller.name}
              </p>
              <p className="mt-1 text-[10px] text-neutral-500">GSTIN: {form.seller.gstin}</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-4xl font-extrabold uppercase tracking-tight text-neutral-900">
              {form.invoiceTitle}
            </h1>
            <div className="mt-3 space-y-1 text-[11px]">
              <p>
                <span className="font-semibold">Invoice No:</span> {formatInvoiceNumber(form)}
              </p>
              <p>
                <span className="font-semibold">Due Date:</span> {formatPreviewDate(form.defaultDueDays)}
              </p>
              <p>
                <span className="font-semibold">Invoice Date:</span> {formatPreviewDate(0)}
              </p>
            </div>
          </div>
        </div>

        {/* Invoice To + Payment Method */}
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-neutral-900">Invoice To:</p>
            <p className="mt-2 text-sm font-bold uppercase">ABC Client Pvt. Ltd.</p>
            <p className="text-xs font-semibold text-neutral-700">Mr. Rahul Sharma</p>
            <p className="text-xs text-neutral-600">Finance Manager</p>
            <div className="mt-3 space-y-1 text-[11px] text-neutral-600">
              <p>Phone: +91 98765 98765</p>
              <p>Email: accounts@abcclient.com</p>
              <p>
                Address: 402, Sunrise Corporate Park, Pune - 411014, Maharashtra, India
              </p>
              <p>GSTIN: 27ABCDE1234F1Z5</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-neutral-900">Payment Method</p>
            <div className="mt-3 space-y-1 text-[11px] text-neutral-600">
              <p>
                <span className="font-semibold text-neutral-800">Account No:</span> {form.bank.accountNumber}
              </p>
              <p>
                <span className="font-semibold text-neutral-800">Account Name:</span> {form.bank.accountName}
              </p>
              <p>
                <span className="font-semibold text-neutral-800">Bank Name:</span> {form.bank.bankName}
              </p>
              <p>
                <span className="font-semibold text-neutral-800">IFSC Code:</span> {form.bank.ifscCode}
              </p>
              <p>
                <span className="font-semibold text-neutral-800">UPI ID:</span> {form.bank.upiId}
              </p>
            </div>
          </div>
        </div>

        {/* Line items table */}
        <div className="mt-8">
          <div className="grid grid-cols-[1fr_90px_50px_100px] bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white">
            <span>Description</span>
            <span className="text-center">Price</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Subtotal</span>
          </div>
          {PREVIEW_LINE_ITEMS.map((item) => (
            <div
              key={item.description}
              className="grid grid-cols-[1fr_90px_50px_100px] border-b border-primary/40 px-4 py-3 text-[11px]"
            >
              <span className="pr-2 text-neutral-800">{item.description}</span>
              <span className="text-center text-neutral-700">{formatInr(item.unitPrice)}</span>
              <span className="text-center text-neutral-700">{item.qty}</span>
              <span className="text-right font-medium text-neutral-900">{formatInr(item.amount)}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wide text-neutral-900">
                Terms and Conditions
              </p>
              <p className="mt-2 text-[10px] leading-relaxed text-neutral-600">{form.termsAndConditions}</p>
              <p className="mt-2 text-[10px] text-neutral-600">{form.latePaymentNote}</p>
            </div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-neutral-900">{form.thankYouNote}</p>
            <div className="space-y-2">
              <ContactRow icon={Phone} value={form.seller.phone} />
              <ContactRow icon={Mail} value={form.billingSupportEmail} />
              <ContactRow icon={Globe} value={form.seller.website} />
            </div>
            {form.showAmountInWords && (
              <p className="text-[10px] text-neutral-600">
                <span className="font-semibold text-neutral-800">Amount in Words:</span> Rupees Nine Thousand
                Four Hundred Thirty-Nine Only
              </p>
            )}
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between border-b border-neutral-200 py-2">
              <span className="font-semibold uppercase text-neutral-700">Sub-total :</span>
              <span>{formatInr(subTotal)}</span>
            </div>
            {form.showDiscount && (
              <div className="flex justify-between border-b border-neutral-200 py-2">
                <span className="font-semibold uppercase text-neutral-700">Discount :</span>
                <span>{formatInr(discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-b border-neutral-200 py-2">
              <span className="font-semibold uppercase text-neutral-700">
                CGST @ {form.cgstRate}% :
              </span>
              <span>{formatInr(cgst)}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-200 py-2">
              <span className="font-semibold uppercase text-neutral-700">
                SGST @ {form.sgstRate}% :
              </span>
              <span>{formatInr(sgst)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between bg-primary px-4 py-3 text-sm font-bold text-white">
              <span>Total :</span>
              <span>{formatInr(form.enableRounding ? roundedTotal : grandTotal)}</span>
            </div>
            <div className="pt-8 text-center">
              {signatureUrl ? (
                <img
                  src={signatureUrl}
                  alt="Signature"
                  className="mx-auto mb-3 h-16 max-w-[180px] object-contain"
                />
              ) : (
                <div className="mx-auto mb-2 w-40 border-b border-neutral-400" />
              )}
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-900">{form.signatoryName}</p>
              <p className="text-[10px] font-semibold uppercase text-neutral-600">{form.signatoryTitle}</p>
              {!signatureUrl && (
                <p className="mt-2 text-[10px] text-neutral-500">{form.digitalSignatureNote}</p>
              )}
            </div>
          </div>
        </div>

        {form.showGstSummary && (
          <div className="mt-8 border-t border-neutral-200 pt-6">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-neutral-900">GST Summary</p>
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <div className="grid grid-cols-5 bg-primary px-3 py-2 text-[10px] font-bold uppercase text-white">
                <span>Tax Rate</span>
                <span>Taxable</span>
                <span>CGST</span>
                <span>SGST</span>
                <span className="text-right">Total Tax</span>
              </div>
              <div className="grid grid-cols-5 px-3 py-2 text-[10px] text-neutral-700">
                <span>{form.cgstRate + form.sgstRate}%</span>
                <span>{formatInr(taxable)}</span>
                <span>{formatInr(cgst)}</span>
                <span>{formatInr(sgst)}</span>
                <span className="text-right">{formatInr(taxTotal)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
