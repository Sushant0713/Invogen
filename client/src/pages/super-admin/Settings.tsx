import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FileUpload } from '@/components/ui/FileUpload';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Switch } from '@/components/ui/Switch';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { invalidateCompanyBranding } from '@/features/builder/use-company-branding-query';
import { InvoiceSettingPanel } from '@/pages/super-admin/settings/InvoiceSettingPanel';
import {
  defaultInvoiceSettings,
  hydrateInvoiceSettings,
  type InvoiceSettings,
} from '@/pages/super-admin/settings/invoice-settings.types';

type SettingsSection =
  | 'company'
  | 'tax'
  | 'agreement'
  | 'invoice'
  | 'payment'
  | 'email'
  | 'security'
  | 'notification';

interface SettingRow {
  _id: string;
  key: string;
  value: unknown;
  description?: string;
}

interface CompanyProfile {
  name: string;
  email: string;
  phone: string;
  gst: string;
  pan: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  maintenanceMode: boolean;
  logo?: string;
  logoFilename?: string;
  signature?: string;
  signatureFilename?: string;
}

interface AgreementFieldValues {
  company_name: string;
  company_email: string;
  company_phone: string;
  company_address: string;
  effective_date: string;
  jurisdiction: string;
}

type AgreementInputMode = 'manual' | 'template' | 'upload';

interface AgreementSettings {
  title: string;
  version: string;
  inputMode: AgreementInputMode;
  content: string;
  templateContent: string;
  fieldValues: AgreementFieldValues;
  file?: string;
  filename?: string;
}

interface TaxSettings {
  isEnabled: boolean;
  taxLabel: string;
  defaultRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  includeInPrice: boolean;
}

interface PaymentSettings {
  provider: 'cashfree';
  keyId: string;
  testMode: boolean;
  autoCapture: boolean;
  defaultCurrency: string;
}

interface EmailSettings {
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpSecure: boolean;
}

interface SecuritySettings {
  jwtAccessExpires: string;
  jwtRefreshExpires: string;
  requireEmailVerification: boolean;
  maxLoginAttempts: number;
  sessionTimeoutMinutes: number;
  maintenanceMessage: string;
}

interface NotificationSettings {
  welcomeEmail: boolean;
  invoiceCreated: boolean;
  paymentReceived: boolean;
  subscriptionRenewal: boolean;
  subscriptionExpired: boolean;
  supportTicketUpdates: boolean;
}

const defaultCompanyProfile = (): CompanyProfile => ({
  name: '',
  email: '',
  phone: '',
  gst: '',
  pan: '',
  street: '',
  city: '',
  state: '',
  country: 'India',
  zipCode: '',
  maintenanceMode: false,
});

const defaultTaxSettings = (): TaxSettings => ({
  isEnabled: true,
  taxLabel: 'GST',
  defaultRate: 18,
  cgstRate: 9,
  sgstRate: 9,
  igstRate: 18,
  includeInPrice: false,
});

const defaultPaymentSettings = (): PaymentSettings => ({
  provider: 'cashfree',
  keyId: '',
  testMode: true,
  autoCapture: true,
  defaultCurrency: 'INR',
});

const defaultEmailSettings = (): EmailSettings => ({
  enabled: false,
  fromName: 'Invogen',
  fromEmail: 'noreply@invogen.app',
  smtpHost: 'localhost',
  smtpPort: 1025,
  smtpUser: '',
  smtpSecure: false,
});

const defaultSecuritySettings = (): SecuritySettings => ({
  jwtAccessExpires: '15m',
  jwtRefreshExpires: '7d',
  requireEmailVerification: true,
  maxLoginAttempts: 5,
  sessionTimeoutMinutes: 30,
  maintenanceMessage: 'We are currently performing scheduled maintenance. Please check back soon.',
});

const defaultNotificationSettings = (): NotificationSettings => ({
  welcomeEmail: true,
  invoiceCreated: true,
  paymentReceived: true,
  subscriptionRenewal: true,
  subscriptionExpired: true,
  supportTicketUpdates: true,
});

const selectClass =
  'w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const defaultAgreementFieldValues = (): AgreementFieldValues => ({
  company_name: '',
  company_email: '',
  company_phone: '',
  company_address: '',
  effective_date: new Date().toISOString().split('T')[0],
  jurisdiction: 'India',
});

const AGREEMENT_TEMPLATE = `{{title}} — Version {{version}}

This Agreement is entered into between {{company_name}} ("Provider") and the subscribing client ("Client").

1. Services
The Provider agrees to deliver invoicing, billing, and business management software services through the Invogen platform.

2. Client obligations
The Client agrees to provide accurate information, maintain account security, and use the platform in compliance with applicable laws.

3. Payment
Subscription fees are billed as per the selected plan. Taxes may apply based on the Client's location.

4. Contact
For support or legal queries, contact {{company_email}} or call {{company_phone}}.

5. Registered address
{{company_address}}

6. Governing law
This Agreement is governed by the laws of {{jurisdiction}}.

Effective date: {{effective_date}}`;

const AGREEMENT_PLACEHOLDERS: { key: keyof AgreementFieldValues | 'title' | 'version'; label: string }[] = [
  { key: 'company_name', label: 'Company name' },
  { key: 'company_email', label: 'Company email' },
  { key: 'company_phone', label: 'Company phone' },
  { key: 'company_address', label: 'Company address' },
  { key: 'effective_date', label: 'Effective date' },
  { key: 'jurisdiction', label: 'Jurisdiction' },
];

function resolveAgreementTemplate(
  template: string,
  fields: AgreementFieldValues,
  meta: { title: string; version: string }
): string {
  const replacements: Record<string, string> = {
    ...fields,
    title: meta.title,
    version: meta.version,
    company_address: fields.company_address.replace(/\n/g, ', '),
  };
  return Object.entries(replacements).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value || `{{${key}}}`),
    template
  );
}

function hydrateAgreement(form: AgreementSettings, company: CompanyProfile): AgreementSettings {
  const base = {
    ...defaultAgreementSettings(),
    ...form,
    fieldValues: { ...defaultAgreementFieldValues(), ...form.fieldValues },
    templateContent: form.templateContent || AGREEMENT_TEMPLATE,
  };

  const fieldValues: AgreementFieldValues = {
    ...base.fieldValues,
    company_name: base.fieldValues.company_name || company.name,
    company_email: base.fieldValues.company_email || company.email,
    company_phone: base.fieldValues.company_phone || company.phone,
    company_address:
      base.fieldValues.company_address ||
      [company.street, company.city, company.state, company.country, company.zipCode]
        .filter(Boolean)
        .join(', '),
    jurisdiction: base.fieldValues.jurisdiction || company.state || company.country || 'India',
  };

  const content =
    base.content ||
    (base.inputMode === 'template'
      ? resolveAgreementTemplate(base.templateContent, fieldValues, {
          title: base.title,
          version: base.version,
        })
      : '');

  return { ...base, fieldValues, content };
}

const defaultAgreementSettings = (): AgreementSettings => ({
  title: 'Terms & Conditions',
  version: '1.0',
  inputMode: 'template',
  content: '',
  templateContent: AGREEMENT_TEMPLATE,
  fieldValues: defaultAgreementFieldValues(),
});

const navItems: { id: SettingsSection; label: string }[] = [
  { id: 'company', label: 'Company setting' },
  { id: 'tax', label: 'Set up tax' },
  { id: 'agreement', label: 'Agreement' },
  { id: 'invoice', label: 'Invoice setting' },
  { id: 'payment', label: 'Payment setting' },
  { id: 'email', label: 'Email setting' },
  { id: 'security', label: 'Security' },
  { id: 'notification', label: 'Notification' },
];

function getSettingValue<T>(settings: SettingRow[] | undefined, key: string, fallback: T): T {
  const row = settings?.find((s) => s.key === key);
  if (!row?.value || typeof row.value !== 'object') return fallback;
  return { ...fallback, ...(row.value as T) };
}

export default function SuperAdminSettings() {
  const [section, setSection] = useState<SettingsSection>('company');
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['super-admin-settings'],
    queryFn: async () => (await api.get('/super-admin/settings')).data.data as SettingRow[],
  });

  const [companyForm, setCompanyForm] = useState<CompanyProfile>(defaultCompanyProfile);
  const [taxForm, setTaxForm] = useState<TaxSettings>(defaultTaxSettings);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceSettings>(defaultInvoiceSettings);
  const [paymentForm, setPaymentForm] = useState<PaymentSettings>(defaultPaymentSettings);
  const [emailForm, setEmailForm] = useState<EmailSettings>(defaultEmailSettings);
  const [securityForm, setSecurityForm] = useState<SecuritySettings>(defaultSecuritySettings);
  const [notificationForm, setNotificationForm] = useState<NotificationSettings>(defaultNotificationSettings);

  const companyFromApi = useMemo(
    () => getSettingValue(settings, 'company_profile', defaultCompanyProfile()),
    [settings]
  );
  const taxFromApi = useMemo(
    () => getSettingValue(settings, 'tax_settings', defaultTaxSettings()),
    [settings]
  );
  const agreementFromApi = useMemo(
    () => getSettingValue(settings, 'agreement_settings', defaultAgreementSettings()),
    [settings]
  );
  const invoiceFromApi = useMemo(() => {
    const row = settings?.find((s) => s.key === 'invoice_settings');
    return hydrateInvoiceSettings(row?.value as Partial<InvoiceSettings> | undefined);
  }, [settings]);
  const paymentFromApi = useMemo(
    () => getSettingValue(settings, 'payment_settings', defaultPaymentSettings()),
    [settings]
  );
  const emailFromApi = useMemo(
    () => getSettingValue(settings, 'email_settings', defaultEmailSettings()),
    [settings]
  );
  const securityFromApi = useMemo(
    () => getSettingValue(settings, 'security_settings', defaultSecuritySettings()),
    [settings]
  );
  const notificationFromApi = useMemo(
    () => getSettingValue(settings, 'notification_settings', defaultNotificationSettings()),
    [settings]
  );

  useEffect(() => {
    setCompanyForm(companyFromApi);
  }, [companyFromApi]);

  useEffect(() => {
    setTaxForm(taxFromApi);
  }, [taxFromApi]);

  useEffect(() => {
    setInvoiceForm(invoiceFromApi);
  }, [invoiceFromApi]);

  useEffect(() => {
    setPaymentForm(paymentFromApi);
  }, [paymentFromApi]);

  useEffect(() => {
    setEmailForm(emailFromApi);
  }, [emailFromApi]);

  useEffect(() => {
    setSecurityForm(securityFromApi);
  }, [securityFromApi]);

  useEffect(() => {
    setNotificationForm(notificationFromApi);
  }, [notificationFromApi]);

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) =>
      api.patch(`/super-admin/settings/${key}`, { value }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-settings'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-status'] });
      if (variables.key === 'company_profile') {
        invalidateCompanyBranding(queryClient, 'super-admin');
      }
      toast.success('Settings saved');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  if (isLoading) return <Loader />;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <nav className="flex shrink-0 flex-row flex-wrap gap-2 lg:w-52 lg:flex-col">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={cn(
              'rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all',
              section === item.id
                ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20'
                : 'border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:bg-primary-50'
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="min-h-[420px] flex-1 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {section === 'company' ? (
          <CompanySettingPanel
            form={companyForm}
            onChange={setCompanyForm}
            onSave={() => saveMutation.mutate({ key: 'company_profile', value: companyForm })}
            saving={saveMutation.isPending}
          />
        ) : section === 'tax' ? (
          <TaxSetupPanel
            form={taxForm}
            onChange={setTaxForm}
            onSave={() => saveMutation.mutate({ key: 'tax_settings', value: taxForm })}
            saving={saveMutation.isPending}
          />
        ) : section === 'agreement' ? (
          <AgreementPanel
            initialForm={agreementFromApi}
            companyProfile={companyFromApi}
          />
        ) : section === 'invoice' ? (
          <InvoiceSettingPanel
            form={invoiceForm}
            onChange={setInvoiceForm}
            onSave={() => saveMutation.mutate({ key: 'invoice_settings', value: invoiceForm })}
            saving={saveMutation.isPending}
            companyBranding={{ logo: companyForm.logo, signature: companyForm.signature }}
          />
        ) : section === 'payment' ? (
          <PaymentSettingPanel
            form={paymentForm}
            onChange={setPaymentForm}
            onSave={() => saveMutation.mutate({ key: 'payment_settings', value: paymentForm })}
            saving={saveMutation.isPending}
          />
        ) : section === 'email' ? (
          <EmailSettingPanel
            form={emailForm}
            onChange={setEmailForm}
            onSave={() => saveMutation.mutate({ key: 'email_settings', value: emailForm })}
            saving={saveMutation.isPending}
          />
        ) : section === 'security' ? (
          <SecuritySettingPanel
            form={securityForm}
            onChange={setSecurityForm}
            onSave={() => saveMutation.mutate({ key: 'security_settings', value: securityForm })}
            saving={saveMutation.isPending}
          />
        ) : (
          <NotificationSettingPanel
            form={notificationForm}
            onChange={setNotificationForm}
            onSave={() => saveMutation.mutate({ key: 'notification_settings', value: notificationForm })}
            saving={saveMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}

function CompanySettingPanel({
  form,
  onChange,
  onSave,
  saving,
}: {
  form: CompanyProfile;
  onChange: (form: CompanyProfile) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const update = (field: keyof CompanyProfile, value: string | boolean) =>
    onChange({ ...form, [field]: value });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Company setting</h2>
        <p className="mt-1 text-sm text-gray-500">
          Platform company details used across invoices, billing, and client communications.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Company Name" value={form.name} onChange={(e) => update('name', e.target.value)} />
        <Input label="Email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
        <Input label="Phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        <Input label="GST Number" value={form.gst} onChange={(e) => update('gst', e.target.value)} />
        <Input label="PAN Number" value={form.pan} onChange={(e) => update('pan', e.target.value)} />
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">Branding</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FileUpload
            label="Logo"
            hint="PNG, JPG, SVG or WebP (max 5MB)"
            value={form.logo}
            filename={form.logoFilename}
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            previewType="image"
            onChange={(url, meta) =>
              onChange({ ...form, logo: url, logoFilename: meta?.filename })
            }
            onClear={() => onChange({ ...form, logo: '', logoFilename: '' })}
          />
          <FileUpload
            label="Signature"
            hint="Used on invoices and official documents"
            value={form.signature}
            filename={form.signatureFilename}
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            previewType="image"
            onChange={(url, meta) =>
              onChange({ ...form, signature: url, signatureFilename: meta?.filename })
            }
            onClear={() => onChange({ ...form, signature: '', signatureFilename: '' })}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">Address</h3>
        <Input label="Street" value={form.street} onChange={(e) => update('street', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="City" value={form.city} onChange={(e) => update('city', e.target.value)} />
          <Input label="State" value={form.state} onChange={(e) => update('state', e.target.value)} />
          <Input label="Country" value={form.country} onChange={(e) => update('country', e.target.value)} />
          <Input label="ZIP Code" value={form.zipCode} onChange={(e) => update('zipCode', e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Maintenance mode</p>
          <p className="text-xs text-gray-500">Temporarily disable access for all clients</p>
        </div>
        <Switch checked={form.maintenanceMode} onChange={(v) => update('maintenanceMode', v)} label="Maintenance mode" />
      </div>

      <Button onClick={onSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save company settings'}
      </Button>
    </div>
  );
}

function TaxSetupPanel({
  form,
  onChange,
  onSave,
  saving,
}: {
  form: TaxSettings;
  onChange: (form: TaxSettings) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const update = (field: keyof TaxSettings, value: string | number | boolean) =>
    onChange({ ...form, [field]: value });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Set up tax</h2>
        <p className="mt-1 text-sm text-gray-500">
          Default tax rules applied to platform billing and subscription invoices.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Enable tax</p>
          <p className="text-xs text-gray-500">Apply tax on platform-generated invoices</p>
        </div>
        <Switch checked={form.isEnabled} onChange={(v) => update('isEnabled', v)} label="Enable tax" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Tax label" value={form.taxLabel} onChange={(e) => update('taxLabel', e.target.value)} />
        <Input
          label="Default tax rate (%)"
          type="number"
          min={0}
          max={100}
          value={form.defaultRate}
          onChange={(e) => update('defaultRate', Number(e.target.value))}
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">Tax breakdown</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="CGST (%)"
            type="number"
            min={0}
            max={100}
            value={form.cgstRate}
            onChange={(e) => update('cgstRate', Number(e.target.value))}
          />
          <Input
            label="SGST (%)"
            type="number"
            min={0}
            max={100}
            value={form.sgstRate}
            onChange={(e) => update('sgstRate', Number(e.target.value))}
          />
          <Input
            label="IGST (%)"
            type="number"
            min={0}
            max={100}
            value={form.igstRate}
            onChange={(e) => update('igstRate', Number(e.target.value))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="tax-pricing" className="block text-sm font-medium text-gray-700">
          Price display
        </label>
        <select
          id="tax-pricing"
          className={selectClass}
          value={form.includeInPrice ? 'inclusive' : 'exclusive'}
          onChange={(e) => update('includeInPrice', e.target.value === 'inclusive')}
        >
          <option value="exclusive">Tax exclusive (added on top)</option>
          <option value="inclusive">Tax inclusive (included in price)</option>
        </select>
      </div>

      <Button onClick={onSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save tax settings'}
      </Button>
    </div>
  );
}

function SettingToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

function PaymentSettingPanel({
  form,
  onChange,
  onSave,
  saving,
}: {
  form: PaymentSettings;
  onChange: (form: PaymentSettings) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const update = (field: keyof PaymentSettings, value: string | boolean) =>
    onChange({ ...form, [field]: value });

  const { data: cashfreeStatus } = useQuery({
    queryKey: ['cashfree-status'],
    queryFn: async () =>
      (await api.get('/super-admin/plans/cashfree-status')).data.data as {
        configured: boolean;
        connected: boolean;
        appIdPrefix: string | null;
        environment: string | null;
        message: string;
      },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Payment setting</h2>
        <p className="mt-1 text-sm text-gray-500">
          Platform payment preferences. Cashfree API credentials are loaded from the server{' '}
          <code className="text-xs">.env</code> file — not from this form.
        </p>
      </div>

      {cashfreeStatus && (
        <Card
          className={
            cashfreeStatus.connected
              ? 'border-green-200 bg-green-50/80'
              : cashfreeStatus.configured
                ? 'border-amber-200 bg-amber-50/80'
                : 'border-red-200 bg-red-50/80'
          }
        >
          <p className="text-sm font-medium text-gray-900">Active Cashfree credentials (.env)</p>
          <p className="mt-1 text-sm text-gray-700">{cashfreeStatus.message}</p>
          {cashfreeStatus.configured && (
            <p className="mt-2 text-xs text-gray-600">
              App ID: {cashfreeStatus.appIdPrefix}... · environment: {cashfreeStatus.environment}
            </p>
          )}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="payment-provider" className="block text-sm font-medium text-gray-700">
            Payment provider
          </label>
          <select id="payment-provider" className={selectClass} value={form.provider} disabled>
            <option value="cashfree">Cashfree</option>
          </select>
        </div>
        <Input label="Default currency" value={form.defaultCurrency} onChange={(e) => update('defaultCurrency', e.target.value)} />
      </div>

      <SettingToggle
        title="Test mode (preference)"
        description="Display label only — actual mode follows CASHFREE_ENV in .env (sandbox vs production)"
        checked={form.testMode}
        onChange={(v) => update('testMode', v)}
      />
      <SettingToggle
        title="Auto capture (preference)"
        description="Saved for future use; checkout currently uses Cashfree defaults"
        checked={form.autoCapture}
        onChange={(v) => update('autoCapture', v)}
      />

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 space-y-2">
        <p className="font-medium text-gray-800">Where to set Cashfree keys</p>
        <p>
          Edit <code>.env</code> in the project root:
        </p>
        <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto">{`CASHFREE_APP_ID=your_app_id
CASHFREE_SECRET_KEY=your_secret_key
CASHFREE_ENV=sandbox
CASHFREE_WEBHOOK_SECRET=...`}</pre>
        <p className="text-xs">
          Get sandbox credentials from{' '}
          <a href="https://merchant.cashfree.com/merchants/pg/developers/api-keys" className="text-primary underline" target="_blank" rel="noreferrer">
            Cashfree Developer Dashboard
          </a>
          . Keys in <code>.env</code> are the only source the server reads.
        </p>
      </div>

      <Button onClick={onSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save payment preferences'}
      </Button>
    </div>
  );
}

function EmailSettingPanel({
  form,
  onChange,
  onSave,
  saving,
}: {
  form: EmailSettings;
  onChange: (form: EmailSettings) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const update = (field: keyof EmailSettings, value: string | number | boolean) =>
    onChange({ ...form, [field]: value });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Email setting</h2>
        <p className="mt-1 text-sm text-gray-500">
          SMTP configuration for transactional emails sent from the platform.
        </p>
      </div>

      <SettingToggle
        title="Enable email delivery"
        description="Send emails through the configured SMTP server"
        checked={form.enabled}
        onChange={(v) => update('enabled', v)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="From name" value={form.fromName} onChange={(e) => update('fromName', e.target.value)} />
        <Input label="From email" type="email" value={form.fromEmail} onChange={(e) => update('fromEmail', e.target.value)} />
        <Input label="SMTP host" value={form.smtpHost} onChange={(e) => update('smtpHost', e.target.value)} />
        <Input
          label="SMTP port"
          type="number"
          value={form.smtpPort}
          onChange={(e) => update('smtpPort', Number(e.target.value))}
        />
        <Input label="SMTP username" value={form.smtpUser} onChange={(e) => update('smtpUser', e.target.value)} />
      </div>

      <SettingToggle
        title="Use TLS/SSL"
        description="Enable secure SMTP connection"
        checked={form.smtpSecure}
        onChange={(v) => update('smtpSecure', v)}
      />

      <p className="text-xs text-gray-500">
        SMTP password is stored in server environment variables. Update SMTP_PASS in your .env file.
      </p>

      <Button onClick={onSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save email settings'}
      </Button>
    </div>
  );
}

function SecuritySettingPanel({
  form,
  onChange,
  onSave,
  saving,
}: {
  form: SecuritySettings;
  onChange: (form: SecuritySettings) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const update = (field: keyof SecuritySettings, value: string | number | boolean) =>
    onChange({ ...form, [field]: value });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Security</h2>
        <p className="mt-1 text-sm text-gray-500">
          Authentication, session, and access control settings for the platform.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Access token expiry"
          value={form.jwtAccessExpires}
          onChange={(e) => update('jwtAccessExpires', e.target.value)}
        />
        <Input
          label="Refresh token expiry"
          value={form.jwtRefreshExpires}
          onChange={(e) => update('jwtRefreshExpires', e.target.value)}
        />
        <Input
          label="Max login attempts"
          type="number"
          min={1}
          value={form.maxLoginAttempts}
          onChange={(e) => update('maxLoginAttempts', Number(e.target.value))}
        />
        <Input
          label="Session timeout (minutes)"
          type="number"
          min={5}
          value={form.sessionTimeoutMinutes}
          onChange={(e) => update('sessionTimeoutMinutes', Number(e.target.value))}
        />
      </div>

      <SettingToggle
        title="Require email verification"
        description="Users must verify email before accessing the platform"
        checked={form.requireEmailVerification}
        onChange={(v) => update('requireEmailVerification', v)}
      />

      <div className="space-y-2">
        <label htmlFor="maintenance-message" className="block text-sm font-medium text-gray-700">
          Maintenance message
        </label>
        <textarea
          id="maintenance-message"
          rows={3}
          value={form.maintenanceMessage}
          onChange={(e) => update('maintenanceMessage', e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <Button onClick={onSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save security settings'}
      </Button>
    </div>
  );
}

function NotificationSettingPanel({
  form,
  onChange,
  onSave,
  saving,
}: {
  form: NotificationSettings;
  onChange: (form: NotificationSettings) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const update = (field: keyof NotificationSettings, value: boolean) =>
    onChange({ ...form, [field]: value });

  const items: { key: keyof NotificationSettings; title: string; description: string }[] = [
    { key: 'welcomeEmail', title: 'Welcome email', description: 'Send when a new client registers' },
    { key: 'invoiceCreated', title: 'Invoice created', description: 'Notify when a new invoice is generated' },
    { key: 'paymentReceived', title: 'Payment received', description: 'Notify on successful payment capture' },
    { key: 'subscriptionRenewal', title: 'Subscription renewal', description: 'Remind before subscription renews' },
    { key: 'subscriptionExpired', title: 'Subscription expired', description: 'Alert when a subscription lapses' },
    { key: 'supportTicketUpdates', title: 'Support ticket updates', description: 'Notify on ticket status changes' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Notification</h2>
        <p className="mt-1 text-sm text-gray-500">
          Control which automated emails and alerts are sent to clients and admins.
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <SettingToggle
            key={item.key}
            title={item.title}
            description={item.description}
            checked={form[item.key]}
            onChange={(v) => update(item.key, v)}
          />
        ))}
      </div>

      <Button onClick={onSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save notification settings'}
      </Button>
    </div>
  );
}

function AgreementPanel({
  initialForm,
  companyProfile,
}: {
  initialForm: AgreementSettings;
  companyProfile: CompanyProfile;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => hydrateAgreement(initialForm, companyProfile));
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const skipAutoSave = useRef(true);

  const saveMutation = useMutation({
    mutationFn: async (value: AgreementSettings) =>
      api.patch('/super-admin/settings/agreement_settings', { value }),
    onMutate: () => setSaveStatus('saving'),
    onSuccess: () => {
      setSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: ['super-admin-settings'] });
    },
    onError: () => {
      setSaveStatus('error');
      toast.error('Failed to save agreement');
    },
  });

  const debouncedSave = useDebouncedCallback((value: AgreementSettings) => {
    saveMutation.mutate(value);
  }, 800);

  useEffect(() => {
    if (skipAutoSave.current) {
      skipAutoSave.current = false;
      return;
    }
    debouncedSave(form);
  }, [form, debouncedSave]);

  const update = (patch: Partial<AgreementSettings>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (next.inputMode === 'template' && (patch.fieldValues || patch.templateContent || patch.title || patch.version)) {
        next.content = resolveAgreementTemplate(next.templateContent, next.fieldValues, {
          title: next.title,
          version: next.version,
        });
      }
      return next;
    });
  };

  const setInputMode = (mode: AgreementInputMode) => {
    setForm((prev) => {
      const next = { ...prev, inputMode: mode };
      if (mode === 'template' && !prev.content) {
        next.content = resolveAgreementTemplate(next.templateContent, next.fieldValues, {
          title: next.title,
          version: next.version,
        });
      }
      return next;
    });
  };

  const modeTabs: { id: AgreementInputMode; label: string }[] = [
    { id: 'manual', label: 'Write manually' },
    { id: 'template', label: 'Pre-filled format' },
    { id: 'upload', label: 'Upload file' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Agreement</h2>
          <p className="mt-1 text-sm text-gray-500">
            Create an agreement manually, use the pre-filled template, or upload a document. Changes save automatically.
          </p>
        </div>
        <p
          className={cn(
            'text-xs font-medium',
            saveStatus === 'saving' && 'text-primary',
            saveStatus === 'saved' && 'text-green-600',
            saveStatus === 'error' && 'text-red-600',
            saveStatus === 'idle' && 'text-gray-400'
          )}
        >
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && 'All changes saved'}
          {saveStatus === 'error' && 'Save failed'}
          {saveStatus === 'idle' && 'Auto-save on'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Agreement title"
          value={form.title}
          onChange={(e) => update({ title: e.target.value })}
        />
        <Input
          label="Version"
          value={form.version}
          onChange={(e) => update({ version: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {modeTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setInputMode(tab.id)}
            className={cn(
              'rounded-xl border px-4 py-2 text-sm font-medium transition-all',
              form.inputMode === tab.id
                ? 'border-primary bg-primary-50 text-primary'
                : 'border-gray-200 bg-white text-gray-600 hover:border-primary/30'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {form.inputMode === 'manual' && (
        <div className="space-y-2">
          <label htmlFor="agreement-manual" className="block text-sm font-medium text-gray-700">
            Agreement content
          </label>
          <textarea
            id="agreement-manual"
            rows={16}
            value={form.content}
            onChange={(e) => update({ content: e.target.value })}
            placeholder="Write your agreement text here..."
            className="w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-3 text-sm leading-relaxed focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}

      {form.inputMode === 'template' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary-50/50 p-4">
            <p className="text-sm font-medium text-gray-800">Fill template fields</p>
            <p className="mt-1 text-xs text-gray-500">
              Values below replace placeholders like {'{{company_name}}'} in the agreement.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {AGREEMENT_PLACEHOLDERS.map((field) => (
                <Input
                  key={field.key}
                  label={field.label}
                  type={field.key === 'effective_date' ? 'date' : 'text'}
                  value={form.fieldValues[field.key as keyof AgreementFieldValues]}
                  onChange={(e) =>
                    update({
                      fieldValues: { ...form.fieldValues, [field.key]: e.target.value },
                    })
                  }
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="agreement-template" className="block text-sm font-medium text-gray-700">
              Pre-filled format (editable template)
            </label>
            <textarea
              id="agreement-template"
              rows={12}
              value={form.templateContent}
              onChange={(e) => update({ templateContent: e.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-3 font-mono text-xs leading-relaxed focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-xs text-gray-500">
              Placeholders: {['{{title}}', '{{version}}', ...AGREEMENT_PLACEHOLDERS.map((f) => `{{${f.key}}}`)].join(', ')}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Live preview</p>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
              {form.content || 'Fill in the fields above to generate the agreement.'}
            </div>
          </div>
        </div>
      )}

      {form.inputMode === 'upload' && (
        <FileUpload
          label="Agreement document"
          hint="PDF or image file (max 5MB)"
          value={form.file}
          filename={form.filename}
          accept="application/pdf,image/jpeg,image/png,image/webp"
          previewType="document"
          onChange={(url, meta) =>
            update({ file: url, filename: meta?.filename })
          }
          onClear={() => update({ file: '', filename: '' })}
        />
      )}
    </div>
  );
}
