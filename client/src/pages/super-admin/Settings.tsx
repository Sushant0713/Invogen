import { useEffect, useMemo, useState, type LucideIcon } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Building2,
  CreditCard,
  Megaphone,
  Percent,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  ScrollText,
} from 'lucide-react';
import api from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FileUpload } from '@/components/ui/FileUpload';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { invalidateCompanyBranding } from '@/features/builder/use-company-branding-query';
import { AgreementSettingPanel } from '@/pages/super-admin/settings/AgreementSettingPanel';
import {
  hydrateAgreementSettingsStore,
} from '@/pages/super-admin/settings/agreement-settings.types';
import { InvoiceSettingPanel } from '@/pages/super-admin/settings/InvoiceSettingPanel';
import {
  defaultInvoiceSettings,
  hydrateInvoiceSettings,
  type InvoiceSettings,
} from '@/pages/super-admin/settings/invoice-settings.types';

type SettingsSection =
  | 'company'
  | 'madeWith'
  | 'tax'
  | 'agreement'
  | 'invoice'
  | 'payment'
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

interface NotificationSettings {
  welcomeEmail: boolean;
  invoiceCreated: boolean;
  paymentReceived: boolean;
  subscriptionRenewal: boolean;
  subscriptionExpired: boolean;
  supportTicketUpdates: boolean;
}

interface MadeWithAdvertisingSettings {
  image?: string;
  imageFilename?: string;
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

const defaultNotificationSettings = (): NotificationSettings => ({
  welcomeEmail: true,
  invoiceCreated: true,
  paymentReceived: true,
  subscriptionRenewal: true,
  subscriptionExpired: true,
  supportTicketUpdates: true,
});

const defaultMadeWithAdvertisingSettings = (): MadeWithAdvertisingSettings => ({
  image: '',
  imageFilename: '',
});

const selectClass =
  'w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const navItems: { id: SettingsSection; label: string; icon: LucideIcon }[] = [
  { id: 'company', label: 'Company setting', icon: Building2 },
  { id: 'madeWith', label: 'Made with ad', icon: Megaphone },
  { id: 'tax', label: 'Set up tax', icon: Percent },
  { id: 'agreement', label: 'Agreement', icon: ScrollText },
  { id: 'invoice', label: 'Invoice setting', icon: Receipt },
  { id: 'payment', label: 'Payment setting', icon: CreditCard },
  { id: 'notification', label: 'Notification', icon: Bell },
];

function getSettingValue<T>(settings: SettingRow[] | undefined, key: string, fallback: T): T {
  const row = settings?.find((s) => s.key === key);
  if (!row?.value || typeof row.value !== 'object') return fallback;
  return { ...fallback, ...(row.value as T) };
}

export default function SuperAdminSettings() {
  const [section, setSection] = useState<SettingsSection>('company');
  const [settingsNavOpen, setSettingsNavOpen] = useState(true);
  const queryClient = useQueryClient();

  const { data: settings, isPending } = useQuery({
    queryKey: ['super-admin-settings'],
    queryFn: async () => (await api.get('/super-admin/settings')).data.data as SettingRow[],
  });

  const [companyForm, setCompanyForm] = useState<CompanyProfile>(defaultCompanyProfile);
  const [taxForm, setTaxForm] = useState<TaxSettings>(defaultTaxSettings);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceSettings>(defaultInvoiceSettings);
  const [paymentForm, setPaymentForm] = useState<PaymentSettings>(defaultPaymentSettings);
  const [notificationForm, setNotificationForm] = useState<NotificationSettings>(defaultNotificationSettings);
  const [madeWithForm, setMadeWithForm] = useState<MadeWithAdvertisingSettings>(
    defaultMadeWithAdvertisingSettings
  );

  const companyFromApi = useMemo(
    () => getSettingValue(settings, 'company_profile', defaultCompanyProfile()),
    [settings]
  );
  const taxFromApi = useMemo(
    () => getSettingValue(settings, 'tax_settings', defaultTaxSettings()),
    [settings]
  );
  const agreementFromApi = useMemo(() => {
    const row = settings?.find((s) => s.key === 'agreement_settings');
    return hydrateAgreementSettingsStore(row?.value, companyFromApi);
  }, [settings, companyFromApi]);
  const invoiceFromApi = useMemo(() => {
    const row = settings?.find((s) => s.key === 'invoice_settings');
    return hydrateInvoiceSettings(row?.value as Partial<InvoiceSettings> | undefined);
  }, [settings]);
  const paymentFromApi = useMemo(
    () => getSettingValue(settings, 'payment_settings', defaultPaymentSettings()),
    [settings]
  );
  const notificationFromApi = useMemo(
    () => getSettingValue(settings, 'notification_settings', defaultNotificationSettings()),
    [settings]
  );
  const madeWithFromApi = useMemo(
    () => getSettingValue(settings, 'made_with_advertising', defaultMadeWithAdvertisingSettings()),
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
    setNotificationForm(notificationFromApi);
  }, [notificationFromApi]);

  useEffect(() => {
    setMadeWithForm(madeWithFromApi);
  }, [madeWithFromApi]);

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) =>
      api.patch(`/super-admin/settings/${key}`, { value }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['maintenance-status'] });
      if (variables.key === 'company_profile') {
        invalidateCompanyBranding(queryClient, 'super-admin');
      }
      if (variables.key === 'made_with_advertising') {
        void queryClient.invalidateQueries({ queryKey: ['auth-branding'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-subscription-status'] });
        void queryClient.invalidateQueries({ queryKey: ['made-with-invogen-plan'] });
      }
      toast.success('Settings saved');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  if (isPending && !settings) return <Loader fullScreen />;

  const activeNav = navItems.find((item) => item.id === section);

  return (
    <div className="relative -m-6 flex h-[calc(100vh-3rem)] min-h-0 bg-gray-50 lg:h-[calc(100vh)]">
      {settingsNavOpen ? (
        <nav
          className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white"
          aria-label="Settings sections"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">Settings</p>
            <button
              type="button"
              onClick={() => setSettingsNavOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
              title="Hide settings menu"
              aria-label="Hide settings menu"
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={section === item.id ? 'page' : undefined}
                  onClick={() => setSection(item.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all',
                    section === item.id
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-gray-600 hover:bg-primary-50 hover:text-primary'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      ) : (
        <div className="flex w-12 shrink-0 flex-col items-center border-r border-gray-200 bg-white py-3">
          <button
            type="button"
            onClick={() => setSettingsNavOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition hover:border-primary/40 hover:bg-primary-50 hover:text-primary"
            title="Show settings menu"
            aria-label="Show settings menu"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        </div>
      )}

      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col',
          section === 'invoice' || section === 'agreement'
            ? 'overflow-hidden p-6'
            : 'overflow-auto p-6'
        )}
      >
        {section !== 'invoice' && activeNav ? (
          <header className="mb-6 shrink-0">
            <h1 className="text-xl font-semibold text-gray-900">{activeNav.label}</h1>
          </header>
        ) : null}

        <div
          className={cn(
            section === 'invoice'
              ? 'h-full min-h-0 flex-1'
              : section === 'agreement'
                ? 'flex h-full min-h-0 flex-1 flex-col'
                : 'max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm'
          )}
        >
        {section === 'company' ? (
          <CompanySettingPanel
            form={companyForm}
            onChange={setCompanyForm}
            onSave={() => saveMutation.mutate({ key: 'company_profile', value: companyForm })}
            onMaintenanceModeChange={(next) =>
              saveMutation.mutate({ key: 'company_profile', value: next })
            }
            saving={saveMutation.isPending}
          />
        ) : section === 'tax' ? (
          <TaxSetupPanel
            form={taxForm}
            onChange={setTaxForm}
            onSave={() => saveMutation.mutate({ key: 'tax_settings', value: taxForm })}
            saving={saveMutation.isPending}
          />
        ) : section === 'madeWith' ? (
          <MadeWithAdvertisingPanel
            form={madeWithForm}
            onChange={setMadeWithForm}
            onSave={() =>
              saveMutation.mutate({ key: 'made_with_advertising', value: madeWithForm })
            }
            saving={saveMutation.isPending}
          />
        ) : section === 'agreement' ? (
          <AgreementSettingPanel
            key="agreement-settings"
            initialStore={agreementFromApi}
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
    </div>
  );
}

function MadeWithAdvertisingPanel({
  form,
  onChange,
  onSave,
  saving,
}: {
  form: MadeWithAdvertisingSettings;
  onChange: (form: MadeWithAdvertisingSettings) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Made with advertising</h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload the brand image shown on templates and invoices for plans with &quot;Made with
          Invogen advertising&quot; enabled. The badge reads &quot;Made with&quot; followed by your
          image — not the Invogen logo or name.
        </p>
      </div>

      <FileUpload
        label="Advertising image"
        hint="PNG, JPG, SVG or WebP (max 5MB). Use a horizontal logo or wordmark."
        value={form.image}
        filename={form.imageFilename}
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
        previewType="image"
        onChange={(url, meta) =>
          onChange({ ...form, image: url, imageFilename: meta?.filename })
        }
        onClear={() => onChange({ ...form, image: '', imageFilename: '' })}
      />

      <p className="text-xs text-gray-500">
        Plans must have the advertising toggle on, and this image must be uploaded, for the badge
        to appear on client templates.
      </p>

      <Button onClick={onSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save advertising image'}
      </Button>
    </div>
  );
}

function CompanySettingPanel({
  form,
  onChange,
  onSave,
  onMaintenanceModeChange,
  saving,
}: {
  form: CompanyProfile;
  onChange: (form: CompanyProfile) => void;
  onSave: () => void;
  onMaintenanceModeChange: (form: CompanyProfile) => void;
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
        <Input label="Email" fieldKind="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
        <Input label="Phone" fieldKind="phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        <Input label="GST Number" fieldKind="gstin" value={form.gst} onChange={(e) => update('gst', e.target.value)} />
        <Input label="PAN Number" fieldKind="pan" value={form.pan} onChange={(e) => update('pan', e.target.value)} />
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
          <Input label="ZIP Code" fieldKind="pincode" value={form.zipCode} onChange={(e) => update('zipCode', e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Maintenance mode</p>
          <p className="text-xs text-gray-500">
            Immediately blocks admin and employee access across the platform
          </p>
        </div>
        <Switch
          checked={form.maintenanceMode}
          onChange={(v) => {
            const next = { ...form, maintenanceMode: v };
            onChange(next);
            onMaintenanceModeChange(next);
          }}
          disabled={saving}
          label="Maintenance mode"
        />
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
          fieldKind="percentage"
          value={form.defaultRate}
          onChange={(e) => update('defaultRate', Number(e.target.value))}
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">Tax breakdown</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="CGST (%)"
            fieldKind="percentage"
            value={form.cgstRate}
            onChange={(e) => update('cgstRate', Number(e.target.value))}
          />
          <Input
            label="SGST (%)"
            fieldKind="percentage"
            value={form.sgstRate}
            onChange={(e) => update('sgstRate', Number(e.target.value))}
          />
          <Input
            label="IGST (%)"
            fieldKind="percentage"
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
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');

  const broadcastMutation = useMutation({
    mutationFn: async () =>
      api.post('/super-admin/notifications/broadcast', {
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        type: 'info',
      }),
    onSuccess: () => {
      toast.success('Notification sent to all company admins');
      setBroadcastTitle('');
      setBroadcastMessage('');
    },
    onError: () => toast.error('Failed to send notification'),
  });

  const update = (field: keyof NotificationSettings, value: boolean) =>
    onChange({ ...form, [field]: value });

  const items: { key: keyof NotificationSettings; title: string; description: string }[] = [
    {
      key: 'welcomeEmail',
      title: 'Welcome email',
      description: 'Send welcome email when a new client registers',
    },
    {
      key: 'invoiceCreated',
      title: 'Invoice created',
      description: 'In-app alert when a new invoice is generated',
    },
    {
      key: 'paymentReceived',
      title: 'Payment received',
      description: 'In-app alert when an invoice is marked as paid',
    },
    {
      key: 'subscriptionRenewal',
      title: 'Subscription renewal',
      description: 'In-app alert when a subscription payment succeeds',
    },
    {
      key: 'subscriptionExpired',
      title: 'Subscription expired',
      description: 'In-app alert when a subscription lapses',
    },
    {
      key: 'supportTicketUpdates',
      title: 'Support ticket updates',
      description: 'In-app alert to clients when ticket status changes',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Notification</h2>
        <p className="mt-1 text-sm text-gray-500">
          Control automated emails and in-app alerts sent to clients and admins.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-gray-50/60 p-5">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Broadcast to all admins</h3>
          <p className="mt-1 text-sm text-gray-500">
            Send an in-app notification to every active company admin on the platform.
          </p>
        </div>
        <div className="mt-4 space-y-3">
          <Input
            placeholder="Notification title"
            value={broadcastTitle}
            onChange={(event) => setBroadcastTitle(event.target.value)}
          />
          <textarea
            className="min-h-[100px] w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Notification message"
            value={broadcastMessage}
            onChange={(event) => setBroadcastMessage(event.target.value)}
          />
        </div>
        <Button
          type="button"
          className="mt-4"
          disabled={
            broadcastMutation.isPending || !broadcastTitle.trim() || !broadcastMessage.trim()
          }
          onClick={() => broadcastMutation.mutate()}
        >
          {broadcastMutation.isPending ? 'Sending…' : 'Send broadcast'}
        </Button>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50/80 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">Automated alerts</h3>
          <p className="mt-1 text-sm text-gray-500">
            Choose which events trigger in-app notifications or emails.
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>
              </div>
              <Switch
                checked={form[item.key]}
                onChange={(value) => update(item.key, value)}
                label={item.title}
              />
            </div>
          ))}
        </div>
      </section>

      <Button onClick={onSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save notification settings'}
      </Button>
    </div>
  );
}
