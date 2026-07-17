import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Eye, Settings2 } from 'lucide-react';
import type { TemplateSummary } from '@invogen/shared';
import api from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/lib/utils';
import { PlatformInvoiceLiveWorkspace } from './PlatformInvoiceLiveWorkspace';
import type { InvoiceSettings } from './invoice-settings.types';
import type { CompanyBranding } from './company-branding';

const selectClass =
  'w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

type InvoiceSettingsTab = 'preview' | 'defaults';

function SectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-4', className)}>
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
  companyBranding: _companyBranding,
}: {
  form: InvoiceSettings;
  onChange: (form: InvoiceSettings) => void;
  onSave: () => void;
  saving: boolean;
  companyBranding: CompanyBranding;
}) {
  const [tab, setTab] = useState<InvoiceSettingsTab>('preview');

  const updateSeller = (field: keyof InvoiceSettings['seller'], value: string) =>
    onChange({ ...form, seller: { ...form.seller, [field]: value } });

  const updateBank = (field: keyof InvoiceSettings['bank'], value: string) =>
    onChange({ ...form, bank: { ...form.bank, [field]: value } });

  const update = (field: keyof InvoiceSettings, value: string | number | boolean) =>
    onChange({ ...form, [field]: value });

  const { data: superAdminTemplates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['super-admin-invoice-template-options'],
    queryFn: async () => {
      const res = await api.get('/super-admin/templates', {
        params: { scope: 'super_admin', limit: 200 },
      });
      return (res.data.data ?? []) as TemplateSummary[];
    },
  });

  const selectedTemplate = superAdminTemplates.find((template) => template._id === form.platformTemplateId);

  useEffect(() => {
    if (form.platformTemplateId || superAdminTemplates.length === 0) return;
    
    // Prefer Super Admin Invoice, otherwise fallback to the oldest template (usually a seed template, not a newly created blank one)
    const superAdminTemplate = superAdminTemplates.find(t => t.name === 'Super Admin Invoice');
    if (superAdminTemplate) {
      onChange({ ...form, platformTemplateId: superAdminTemplate._id });
    } else {
      const oldestTemplate = [...superAdminTemplates].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
      onChange({ ...form, platformTemplateId: oldestTemplate._id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.platformTemplateId, superAdminTemplates]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          'flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-3 py-2',
          tab === 'defaults' && 'shadow-sm'
        )}
      >
        <select
          id="platform-template"
          value={form.platformTemplateId}
          onChange={(e) => update('platformTemplateId', e.target.value)}
          disabled={templatesLoading || superAdminTemplates.length === 0}
          className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:min-w-[12rem] sm:max-w-xs"
          aria-label="Super Admin template"
        >
          {templatesLoading ? (
            <option value="">Loading…</option>
          ) : superAdminTemplates.length === 0 ? (
            <option value="">No templates</option>
          ) : (
            superAdminTemplates.map((template) => (
              <option key={template._id} value={template._id}>
                {template.name}
              </option>
            ))
          )}
        </select>

        <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
              tab === 'preview'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Live preview</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('defaults')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
              tab === 'defaults'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Billing defaults</span>
          </button>
        </div>

        <Link
          to="/super-admin/templates/super-admin"
          title="Manage Super Admin templates"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-primary/40 hover:text-primary"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>

        <p className="hidden w-full text-xs text-gray-500 lg:block lg:w-auto lg:flex-1">
          Selected template + saved billing defaults are emailed to clients after plan payment.
        </p>

        <Button onClick={onSave} disabled={saving} loading={saving} size="sm" className="ml-auto shrink-0">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {tab === 'preview' ? (
        <div className="min-h-0 flex-1 bg-gray-100">
          <PlatformInvoiceLiveWorkspace
            form={form}
            templateId={form.platformTemplateId}
            templateName={selectedTemplate?.name ?? 'Template'}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Billing defaults</h2>
            <p className="mt-1 text-sm text-gray-500">
              Seller, bank, numbering, and tax options for platform subscription invoices. Changes apply to the live preview when you switch back to that tab — click Save to persist.
            </p>
          </div>
        <div className="grid gap-4 pb-4 md:grid-cols-2">
          <SectionCard
            title="Invoice header"
            description="Title and numbering on every platform invoice."
            className="md:col-span-2"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

          <SectionCard title="Seller details" description="Printed on the invoice as your company.">
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

          <SectionCard title="Payment details" description="Bank account on the invoice.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Bank name" value={form.bank.bankName} onChange={(e) => updateBank('bankName', e.target.value)} />
              <Input label="Account name" value={form.bank.accountName} onChange={(e) => updateBank('accountName', e.target.value)} />
              <Input label="Account number" fieldKind="account-number" value={form.bank.accountNumber} onChange={(e) => updateBank('accountNumber', e.target.value)} />
              <Input label="IFSC code" fieldKind="ifsc" value={form.bank.ifscCode} onChange={(e) => updateBank('ifscCode', e.target.value)} />
              <Input label="UPI ID" fieldKind="upi" value={form.bank.upiId} onChange={(e) => updateBank('upiId', e.target.value)} className="sm:col-span-2" />
            </div>
          </SectionCard>

          <SectionCard title="Payment terms & notes" className="md:col-span-2">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Payment due text" value={form.paymentDueText} onChange={(e) => update('paymentDueText', e.target.value)} />
              <Input label="Thank you note" value={form.thankYouNote} onChange={(e) => update('thankYouNote', e.target.value)} />
              <Input label="Billing support email" fieldKind="email" value={form.billingSupportEmail} onChange={(e) => update('billingSupportEmail', e.target.value)} className="md:col-span-2" />
              <div className="space-y-1.5 md:col-span-2">
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
            </div>
          </SectionCard>

          <SectionCard title="Signatory & tax display" className="md:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
        </div>
        </div>
      )}
    </div>
  );
}
