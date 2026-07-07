import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { ModernInvoicePreview } from './ModernInvoicePreview';
import type { InvoiceSettings } from './invoice-settings.types';
import type { CompanyBranding } from './company-branding';

const selectClass =
  'w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function InvoiceSettingPanel({
  form,
  onChange,
  onSave,
  saving,
  companyBranding,
}: {
  form: InvoiceSettings;
  onChange: (form: InvoiceSettings) => void;
  onSave: () => void;
  saving: boolean;
  companyBranding: CompanyBranding;
}) {
  const updateSeller = (field: keyof InvoiceSettings['seller'], value: string) =>
    onChange({ ...form, seller: { ...form.seller, [field]: value } });

  const updateBank = (field: keyof InvoiceSettings['bank'], value: string) =>
    onChange({ ...form, bank: { ...form.bank, [field]: value } });

  const update = (field: keyof InvoiceSettings, value: string | number | boolean) =>
    onChange({ ...form, [field]: value });

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { downloadInvoicePdf } = await import('./download-invoice-pdf');
      await downloadInvoicePdf(form, companyBranding);
      toast.success('Invoice downloaded (A4 PDF)');
    } catch {
      toast.error('Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Invoice setting</h2>
        <p className="mt-1 text-sm text-gray-500">
          Modern geometric invoice layout. Logo and signature are loaded from Company setting.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <SectionCard title="Template" description="Active invoice design for platform billing.">
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <p className="text-sm font-semibold text-primary">Template 7 — Modern Geometric</p>
              <p className="mt-1 text-xs text-gray-600">
                Orange header table, payment method block, and signature footer.
              </p>
            </div>
          </SectionCard>

          <SectionCard title="Invoice header" description="Title and numbering shown at the top of every invoice.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Invoice title" value={form.invoiceTitle} onChange={(e) => update('invoiceTitle', e.target.value)} />
              <Input label="Invoice prefix" value={form.prefix} onChange={(e) => update('prefix', e.target.value)} />
              <Input label="Number format" value={form.numberFormat} onChange={(e) => update('numberFormat', e.target.value)} />
              <Input
                label="Next invoice number"
                type="number"
                min={1}
                value={form.nextNumber}
                onChange={(e) => update('nextNumber', Number(e.target.value))}
              />
              <Input label="Currency" value={form.currency} onChange={(e) => update('currency', e.target.value)} />
              <Input label="Date format" value={form.dateFormat} onChange={(e) => update('dateFormat', e.target.value)} />
              <Input
                label="Default due days"
                type="number"
                min={0}
                value={form.defaultDueDays}
                onChange={(e) => update('defaultDueDays', Number(e.target.value))}
              />
              <Input label="Timezone" value={form.timezone} onChange={(e) => update('timezone', e.target.value)} />
            </div>
            <p className="text-xs text-gray-500">
              Tokens: {'{PREFIX}'}, {'{YYYY}'}, {'{NNNNN}'}, {'{NNNN}'}
            </p>
          </SectionCard>

          <SectionCard title="Seller details" description="Your company information printed on the invoice.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Company name" value={form.seller.name} onChange={(e) => updateSeller('name', e.target.value)} className="sm:col-span-2" />
              <Input label="Address line 1" value={form.seller.addressLine1} onChange={(e) => updateSeller('addressLine1', e.target.value)} className="sm:col-span-2" />
              <Input label="Address line 2" value={form.seller.addressLine2} onChange={(e) => updateSeller('addressLine2', e.target.value)} className="sm:col-span-2" />
              <Input label="City" value={form.seller.city} onChange={(e) => updateSeller('city', e.target.value)} />
              <Input label="State" value={form.seller.state} onChange={(e) => updateSeller('state', e.target.value)} />
              <Input label="ZIP code" fieldKind="pincode" value={form.seller.zipCode} onChange={(e) => updateSeller('zipCode', e.target.value)} />
              <Input label="Country" value={form.seller.country} onChange={(e) => updateSeller('country', e.target.value)} />
              <Input label="GSTIN" fieldKind="gstin" value={form.seller.gstin} onChange={(e) => updateSeller('gstin', e.target.value)} />
              <Input label="PAN" fieldKind="pan" value={form.seller.pan} onChange={(e) => updateSeller('pan', e.target.value)} />
              <Input label="Email" fieldKind="email" value={form.seller.email} onChange={(e) => updateSeller('email', e.target.value)} />
              <Input label="Phone" fieldKind="phone" value={form.seller.phone} onChange={(e) => updateSeller('phone', e.target.value)} />
              <Input label="Website" fieldKind="url" value={form.seller.website} onChange={(e) => updateSeller('website', e.target.value)} className="sm:col-span-2" />
            </div>
          </SectionCard>

          <SectionCard title="Payment details" description="Bank account information for invoice payments.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Bank name" value={form.bank.bankName} onChange={(e) => updateBank('bankName', e.target.value)} />
              <Input label="Account name" value={form.bank.accountName} onChange={(e) => updateBank('accountName', e.target.value)} />
              <Input label="Account number" fieldKind="account-number" value={form.bank.accountNumber} onChange={(e) => updateBank('accountNumber', e.target.value)} />
              <Input label="IFSC code" fieldKind="ifsc" value={form.bank.ifscCode} onChange={(e) => updateBank('ifscCode', e.target.value)} />
              <Input label="UPI ID" fieldKind="upi" value={form.bank.upiId} onChange={(e) => updateBank('upiId', e.target.value)} className="sm:col-span-2" />
            </div>
          </SectionCard>

          <SectionCard title="Payment terms & notes">
            <div className="space-y-4">
              <Input label="Payment due text" value={form.paymentDueText} onChange={(e) => update('paymentDueText', e.target.value)} />
              <div className="space-y-1.5">
                <label htmlFor="terms-conditions" className="block text-sm font-medium text-gray-700">
                  Terms and conditions
                </label>
                <textarea
                  id="terms-conditions"
                  rows={3}
                  value={form.termsAndConditions}
                  onChange={(e) => update('termsAndConditions', e.target.value)}
                  className={selectClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="late-payment" className="block text-sm font-medium text-gray-700">Late payment note</label>
                <textarea
                  id="late-payment"
                  rows={2}
                  value={form.latePaymentNote}
                  onChange={(e) => update('latePaymentNote', e.target.value)}
                  className={selectClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="subscription-note" className="block text-sm font-medium text-gray-700">Subscription note</label>
                <textarea
                  id="subscription-note"
                  rows={2}
                  value={form.subscriptionNote}
                  onChange={(e) => update('subscriptionNote', e.target.value)}
                  className={selectClass}
                />
              </div>
              <Input label="Thank you note" value={form.thankYouNote} onChange={(e) => update('thankYouNote', e.target.value)} />
              <Input label="Billing support email" fieldKind="email" value={form.billingSupportEmail} onChange={(e) => update('billingSupportEmail', e.target.value)} />
            </div>
          </SectionCard>

          <SectionCard title="Signatory & tax display">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Signatory name" value={form.signatoryName} onChange={(e) => update('signatoryName', e.target.value)} />
              <Input label="Signatory title" value={form.signatoryTitle} onChange={(e) => update('signatoryTitle', e.target.value)} />
              <Input label="Signatory label" value={form.signatoryLabel} onChange={(e) => update('signatoryLabel', e.target.value)} />
              <Input label="Signatory for" value={form.signatoryFor} onChange={(e) => update('signatoryFor', e.target.value)} />
              <Input label="Digital signature note" value={form.digitalSignatureNote} onChange={(e) => update('digitalSignatureNote', e.target.value)} className="sm:col-span-2" />
              <Input
                label="Default discount (%)"
                fieldKind="percentage"
                value={form.defaultDiscount}
                onChange={(e) => update('defaultDiscount', Number(e.target.value))}
              />
              <Input
                label="CGST rate (%)"
                fieldKind="percentage"
                value={form.cgstRate}
                onChange={(e) => update('cgstRate', Number(e.target.value))}
              />
              <Input
                label="SGST rate (%)"
                fieldKind="percentage"
                value={form.sgstRate}
                onChange={(e) => update('sgstRate', Number(e.target.value))}
              />
            </div>
            <div className="space-y-3">
              {[
                { key: 'showDiscount' as const, title: 'Show discount row', desc: 'Display discount line in totals' },
                { key: 'showGstSummary' as const, title: 'Show GST summary table', desc: 'Display tax breakdown at the bottom' },
                { key: 'showAmountInWords' as const, title: 'Show amount in words', desc: 'Print total amount in words' },
                { key: 'enableRounding' as const, title: 'Enable rounding', desc: 'Round grand total to nearest rupee' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                  <Switch
                    checked={form[item.key]}
                    onChange={(v) => update(item.key, v)}
                    label={item.title}
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          <Button onClick={onSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? 'Saving...' : 'Save invoice settings'}
          </Button>
        </div>

        <div className="space-y-3 xl:sticky xl:top-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-800">Live preview — Template 7</p>
              <p className="text-xs text-gray-500">A4 format (210 × 297 mm). Bill-to and line items are sample data.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              loading={downloading}
              disabled={downloading}
            >
              <Download className="h-4 w-4" />
              Download A4 PDF
            </Button>
          </div>
          <ModernInvoicePreview form={form} branding={companyBranding} />
        </div>
      </div>
    </div>
  );
}
