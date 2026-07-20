import { useEffect, useState, type LucideIcon } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Landmark,
  CreditCard,
  ReceiptText,
  Percent,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import api from '@/api/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FileUpload } from '@/components/ui/FileUpload';
import { Loader } from '@/components/ui/Loader';
import { Switch } from '@/components/ui/Switch';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  CUSTOM_INVOICE_NUMBER_FORMAT,
  INVOICE_NUMBER_FORMAT_PRESETS,
  invoiceNumberFormatSelectValue,
} from '@/lib/invoice-number-formats';
import { invalidateCompanyBranding } from '@/features/builder/use-company-branding-query';
import { invalidateTaxSettings } from '@/features/builder/use-tax-settings-query';
import {
  type TaxSettings,
  EMPTY_TAX_SETTINGS,
  parseTaxSettings,
  type TaxDisplayMode,
} from '@/features/builder/tax-settings';
import { EmployeeSettingsPanel } from '@/features/employees/EmployeeSettingsPanel';

type SettingsSection =
  | 'company'
  | 'companyFields'
  | 'paymentFields'
  | 'invoiceNumbering'
  | 'tax'
  | 'employees';

type CompanyForm = {
  name: string;
  gst: string;
  pan: string;
  logo: string;
  signature: string;
};

type CompanyFieldsForm = {
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
};

type PaymentFieldsForm = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  upiId: string;
};

type InvoiceNumberingForm = {
  prefix: string;
  numberFormat: string;
  nextNumber: number;
};

function invoiceNumberPreview(
  form: InvoiceNumberingForm,
  invoiceCode = 'CO'
): string {
  const padded = String(Math.max(1, form.nextNumber || 1)).padStart(5, '0');
  return form.numberFormat
    .replace(/\{CODE\}/g, invoiceCode || 'CO')
    .replace(/\{PREFIX\}/g, form.prefix || 'INV')
    .replace(/\{YYYY\}/g, String(new Date().getFullYear()))
    .replace(/\{NNNNN\}/g, padded)
    .replace(/\{NNNN\}/g, padded.slice(-4))
    .replace(/\{NNN\}/g, String(Math.max(1, form.nextNumber || 1)).padStart(3, '0'));
}

const navItems: { id: SettingsSection; label: string; icon: LucideIcon }[] = [
  { id: 'company', label: 'Company setting', icon: Building2 },
  { id: 'companyFields', label: 'Company fields', icon: Landmark },
  { id: 'paymentFields', label: 'Payment fields', icon: CreditCard },
  { id: 'invoiceNumbering', label: 'Invoice numbering', icon: ReceiptText },
  { id: 'tax', label: 'Set up tax', icon: Percent },
  { id: 'employees', label: 'Employees', icon: Users },
];

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<SettingsSection>('company');
  const [settingsNavOpen, setSettingsNavOpen] = useState(true);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-company'],
    queryFn: async () => (await api.get('/admin/company')).data.data,
  });
  const [form, setForm] = useState<CompanyForm>({
    name: '',
    gst: '',
    pan: '',
    logo: '',
    signature: '',
  });
  const [companyFieldsForm, setCompanyFieldsForm] = useState<CompanyFieldsForm>({
    name: '',
    email: '',
    phone: '',
    gst: '',
    pan: '',
    street: '',
    city: '',
    state: '',
    country: '',
    zipCode: '',
  });
  const [paymentFieldsForm, setPaymentFieldsForm] = useState<PaymentFieldsForm>({
    bankName: '',
    accountName: '',
    accountNumber: '',
    ifscCode: '',
    branch: '',
    upiId: '',
  });
  const [invoiceNumberingForm, setInvoiceNumberingForm] = useState<InvoiceNumberingForm>({
    prefix: 'INV',
    numberFormat: '{CODE}-{PREFIX}-{YYYY}-{NNNNN}',
    nextNumber: 1,
  });
  const [taxForm, setTaxForm] = useState<TaxSettings>(EMPTY_TAX_SETTINGS);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingCompanyFields, setSavingCompanyFields] = useState(false);
  const [savingPaymentFields, setSavingPaymentFields] = useState(false);
  const [savingInvoiceNumbering, setSavingInvoiceNumbering] = useState(false);
  const [savingTax, setSavingTax] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name ?? '',
      gst: data.gst ?? '',
      pan: data.pan ?? '',
      logo: data.logo ?? '',
      signature: data.signature ?? '',
    });
    setCompanyFieldsForm({
      name: data.name ?? '',
      email: data.email ?? '',
      phone: data.phone ?? '',
      gst: data.gst ?? '',
      pan: data.pan ?? '',
      street: data.address?.street ?? '',
      city: data.address?.city ?? '',
      state: data.address?.state ?? '',
      country: data.address?.country ?? '',
      zipCode: data.address?.zipCode ?? '',
    });
    setPaymentFieldsForm({
      bankName: data.bankDetails?.bankName ?? '',
      accountName: data.bankDetails?.accountName ?? '',
      accountNumber: data.bankDetails?.accountNumber ?? '',
      ifscCode: data.bankDetails?.ifscCode ?? '',
      branch: data.bankDetails?.branch ?? '',
      upiId: data.bankDetails?.upiId ?? '',
    });
    setInvoiceNumberingForm({
      prefix: data.invoiceSettings?.prefix ?? 'INV',
      numberFormat:
        data.invoiceSettings?.numberFormat ?? '{CODE}-{PREFIX}-{YYYY}-{NNNNN}',
      nextNumber: Math.max(1, Number(data.invoiceSettings?.nextNumber) || 1),
    });
    setTaxForm(parseTaxSettings(data.taxSettings));
  }, [data]);

  if (isLoading) return <Loader fullScreen />;

  const handleSaveCompany = async () => {
    setSavingCompany(true);
    try {
      await api.patch('/admin/company', {
        name: form.name || data?.name,
        gst: form.gst || data?.gst,
        pan: form.pan || data?.pan,
        logo: form.logo,
        signature: form.signature,
      });
      toast.success('Company settings saved');
      invalidateCompanyBranding(queryClient, 'admin');
      refetch();
    } catch {
      toast.error('Failed to save company settings');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleSaveCompanyFields = async () => {
    setSavingCompanyFields(true);
    try {
      await api.patch('/admin/company', {
        name: companyFieldsForm.name || data?.name,
        email: companyFieldsForm.email,
        phone: companyFieldsForm.phone,
        gst: companyFieldsForm.gst,
        pan: companyFieldsForm.pan,
        address: {
          street: companyFieldsForm.street,
          city: companyFieldsForm.city,
          state: companyFieldsForm.state,
          country: companyFieldsForm.country,
          zipCode: companyFieldsForm.zipCode,
        },
      });
      toast.success('Company field defaults saved');
      await queryClient.invalidateQueries({ queryKey: ['admin-company'] });
      refetch();
    } catch {
      toast.error('Failed to save company field defaults');
    } finally {
      setSavingCompanyFields(false);
    }
  };

  const handleSavePaymentFields = async () => {
    setSavingPaymentFields(true);
    try {
      await api.patch('/admin/company', { bankDetails: paymentFieldsForm });
      toast.success('Payment field defaults saved');
      await queryClient.invalidateQueries({ queryKey: ['admin-company'] });
      refetch();
    } catch {
      toast.error('Failed to save payment field defaults');
    } finally {
      setSavingPaymentFields(false);
    }
  };

  const handleSaveInvoiceNumbering = async () => {
    const prefix = invoiceNumberingForm.prefix.trim();
    const numberFormat = invoiceNumberingForm.numberFormat.trim();
    const nextNumber = Math.max(1, Math.floor(invoiceNumberingForm.nextNumber || 1));
    if (!prefix || !numberFormat) {
      toast.error('Prefix and number format are required');
      return;
    }

    setSavingInvoiceNumbering(true);
    try {
      await api.patch('/admin/company', {
        invoiceSettings: {
          ...(data?.invoiceSettings ?? {}),
          prefix,
          numberFormat,
          nextNumber,
        },
      });
      setInvoiceNumberingForm({ prefix, numberFormat, nextNumber });
      toast.success('Invoice numbering saved');
      await queryClient.invalidateQueries({ queryKey: ['admin-company'] });
      refetch();
    } catch {
      toast.error('Failed to save invoice numbering');
    } finally {
      setSavingInvoiceNumbering(false);
    }
  };

  const handleSaveTax = async () => {
    setSavingTax(true);
    try {
      await api.patch('/admin/company', { taxSettings: taxForm });
      toast.success('Tax settings saved');
      invalidateTaxSettings(queryClient, 'admin');
      refetch();
    } catch {
      toast.error('Failed to save tax settings');
    } finally {
      setSavingTax(false);
    }
  };

  const updateTax = (field: keyof TaxSettings, value: string | number | boolean) =>
    setTaxForm({ ...taxForm, [field]: value });

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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-6">
        {activeNav ? (
          <header className="mb-6 shrink-0">
            <h1 className="text-xl font-semibold text-gray-900">{activeNav.label}</h1>
          </header>
        ) : null}

        <div
          className={cn(
            'max-w-4xl',
            section === 'employees'
              ? ''
              : 'rounded-2xl border border-gray-200 bg-white p-6 shadow-sm'
          )}
        >
          {section === 'company' ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Company Settings</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Logo and signature are used automatically on invoice templates.
                </p>
              </div>

              <Input
                label="Company Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                label="GST Number"
                fieldKind="gstin"
                value={form.gst}
                onChange={(e) => setForm({ ...form, gst: e.target.value })}
              />
              <Input
                label="PAN Number"
                fieldKind="pan"
                value={form.pan}
                onChange={(e) => setForm({ ...form, pan: e.target.value })}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FileUpload
                  label="Logo"
                  hint="Used on invoice templates and documents"
                  value={form.logo}
                  accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                  previewType="image"
                  onChange={(url) => setForm({ ...form, logo: url })}
                  onClear={() => setForm({ ...form, logo: '' })}
                />
                <FileUpload
                  label="Signature"
                  hint="Shown on invoices when a signature component is placed"
                  value={form.signature}
                  accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                  previewType="image"
                  onChange={(url) => setForm({ ...form, signature: url })}
                  onClear={() => setForm({ ...form, signature: '' })}
                />
              </div>

              <Button onClick={handleSaveCompany} disabled={savingCompany}>
                {savingCompany ? 'Saving...' : 'Save company settings'}
              </Button>
            </div>
          ) : section === 'companyFields' ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Company field defaults</h2>
                <p className="mt-1 text-sm text-gray-500">
                  These values are prefilled when you add Company cards or individual Company fields
                  to a template.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Company name"
                  value={companyFieldsForm.name}
                  onChange={(e) =>
                    setCompanyFieldsForm({ ...companyFieldsForm, name: e.target.value })
                  }
                />
                <Input
                  label="Email"
                  fieldKind="email"
                  value={companyFieldsForm.email}
                  onChange={(e) =>
                    setCompanyFieldsForm({ ...companyFieldsForm, email: e.target.value })
                  }
                />
                <Input
                  label="Phone"
                  fieldKind="phone"
                  value={companyFieldsForm.phone}
                  onChange={(e) =>
                    setCompanyFieldsForm({ ...companyFieldsForm, phone: e.target.value })
                  }
                />
                <Input
                  label="GSTIN"
                  fieldKind="gstin"
                  value={companyFieldsForm.gst}
                  onChange={(e) =>
                    setCompanyFieldsForm({ ...companyFieldsForm, gst: e.target.value })
                  }
                />
                <Input
                  label="PAN"
                  fieldKind="pan"
                  value={companyFieldsForm.pan}
                  onChange={(e) =>
                    setCompanyFieldsForm({ ...companyFieldsForm, pan: e.target.value })
                  }
                />
                <Input
                  label="Street"
                  value={companyFieldsForm.street}
                  onChange={(e) =>
                    setCompanyFieldsForm({ ...companyFieldsForm, street: e.target.value })
                  }
                />
                <Input
                  label="City"
                  value={companyFieldsForm.city}
                  onChange={(e) =>
                    setCompanyFieldsForm({ ...companyFieldsForm, city: e.target.value })
                  }
                />
                <Input
                  label="State"
                  value={companyFieldsForm.state}
                  onChange={(e) =>
                    setCompanyFieldsForm({ ...companyFieldsForm, state: e.target.value })
                  }
                />
                <Input
                  label="Country"
                  value={companyFieldsForm.country}
                  onChange={(e) =>
                    setCompanyFieldsForm({ ...companyFieldsForm, country: e.target.value })
                  }
                />
                <Input
                  label="PIN / ZIP code"
                  value={companyFieldsForm.zipCode}
                  onChange={(e) =>
                    setCompanyFieldsForm({ ...companyFieldsForm, zipCode: e.target.value })
                  }
                />
              </div>

              <Button onClick={handleSaveCompanyFields} disabled={savingCompanyFields}>
                {savingCompanyFields ? 'Saving...' : 'Save company field defaults'}
              </Button>
            </div>
          ) : section === 'paymentFields' ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Payment field defaults</h2>
                <p className="mt-1 text-sm text-gray-500">
                  These values are prefilled when you add Payment cards or individual Payment fields
                  to a template.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Bank name"
                  value={paymentFieldsForm.bankName}
                  onChange={(e) =>
                    setPaymentFieldsForm({ ...paymentFieldsForm, bankName: e.target.value })
                  }
                />
                <Input
                  label="Account name"
                  value={paymentFieldsForm.accountName}
                  onChange={(e) =>
                    setPaymentFieldsForm({ ...paymentFieldsForm, accountName: e.target.value })
                  }
                />
                <Input
                  label="Account number"
                  fieldKind="account-number"
                  value={paymentFieldsForm.accountNumber}
                  onChange={(e) =>
                    setPaymentFieldsForm({ ...paymentFieldsForm, accountNumber: e.target.value })
                  }
                />
                <Input
                  label="IFSC code"
                  fieldKind="ifsc"
                  value={paymentFieldsForm.ifscCode}
                  onChange={(e) =>
                    setPaymentFieldsForm({ ...paymentFieldsForm, ifscCode: e.target.value })
                  }
                />
                <Input
                  label="Branch"
                  value={paymentFieldsForm.branch}
                  onChange={(e) =>
                    setPaymentFieldsForm({ ...paymentFieldsForm, branch: e.target.value })
                  }
                />
                <Input
                  label="UPI ID"
                  fieldKind="upi"
                  value={paymentFieldsForm.upiId}
                  onChange={(e) =>
                    setPaymentFieldsForm({ ...paymentFieldsForm, upiId: e.target.value })
                  }
                />
              </div>

              <Button onClick={handleSavePaymentFields} disabled={savingPaymentFields}>
                {savingPaymentFields ? 'Saving...' : 'Save payment field defaults'}
              </Button>
            </div>
          ) : section === 'invoiceNumbering' ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Invoice numbering</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Set the format used for newly generated invoice numbers.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Invoice prefix"
                  value={invoiceNumberingForm.prefix}
                  onChange={(e) =>
                    setInvoiceNumberingForm({
                      ...invoiceNumberingForm,
                      prefix: e.target.value,
                    })
                  }
                />
                <Input
                  label="Next invoice number"
                  type="number"
                  min={1}
                  value={invoiceNumberingForm.nextNumber}
                  onChange={(e) =>
                    setInvoiceNumberingForm({
                      ...invoiceNumberingForm,
                      nextNumber: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                />
                <div className="space-y-1.5 sm:col-span-2">
                  <label
                    htmlFor="admin-invoice-number-format"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Invoice number format
                  </label>
                  <select
                    id="admin-invoice-number-format"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    value={invoiceNumberFormatSelectValue(invoiceNumberingForm.numberFormat)}
                    onChange={(e) =>
                      setInvoiceNumberingForm({
                        ...invoiceNumberingForm,
                        numberFormat:
                          e.target.value === CUSTOM_INVOICE_NUMBER_FORMAT
                            ? ''
                            : e.target.value,
                      })
                    }
                  >
                    {INVOICE_NUMBER_FORMAT_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                    <option value={CUSTOM_INVOICE_NUMBER_FORMAT}>Customize format…</option>
                  </select>
                  {invoiceNumberFormatSelectValue(invoiceNumberingForm.numberFormat)
                    === CUSTOM_INVOICE_NUMBER_FORMAT ? (
                    <Input
                      label="Custom format"
                      value={invoiceNumberingForm.numberFormat}
                      placeholder="{PREFIX}{NNN}/{YYYY}"
                      onChange={(e) =>
                        setInvoiceNumberingForm({
                          ...invoiceNumberingForm,
                          numberFormat: e.target.value,
                        })
                      }
                    />
                  ) : null}
                  <p className="mt-1 text-xs text-gray-500">
                    Tokens: {'{CODE}'}, {'{PREFIX}'}, {'{YYYY}'}, {'{NNN}'}, {'{NNNN}'},{' '}
                    {'{NNNNN}'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Preview</p>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {invoiceNumberPreview(invoiceNumberingForm, data?.invoiceCode)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Example: use {'{PREFIX}{NNN}/{YYYY}'} for INV001/{new Date().getFullYear()}.
                </p>
              </div>

              <Button onClick={handleSaveInvoiceNumbering} disabled={savingInvoiceNumbering}>
                {savingInvoiceNumbering ? 'Saving...' : 'Save invoice numbering'}
              </Button>
            </div>
          ) : section === 'tax' ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Set up tax</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Configure CGST/SGST split or a single combined GST rate for invoice tables.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Enable tax</p>
                  <p className="text-xs text-gray-500">Apply tax on invoice line items</p>
                </div>
                <Switch
                  checked={taxForm.isEnabled}
                  onChange={(value) => updateTax('isEnabled', value)}
                  label="Enable tax"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="tax-display-mode" className="block text-sm font-medium text-gray-700">
                  Tax column style
                </label>
                <select
                  id="tax-display-mode"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={taxForm.taxDisplayMode}
                  onChange={(e) => updateTax('taxDisplayMode', e.target.value as TaxDisplayMode)}
                >
                  <option value="split">CGST + SGST (split)</option>
                  <option value="combined">GST (combined)</option>
                  <option value="igst">IGST</option>
                </select>
              </div>

              {taxForm.taxDisplayMode === 'split' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="CGST (%)"
                    fieldKind="percentage"
                    value={taxForm.cgstRate}
                    onChange={(e) => updateTax('cgstRate', Number(e.target.value))}
                  />
                  <Input
                    label="SGST (%)"
                    fieldKind="percentage"
                    value={taxForm.sgstRate}
                    onChange={(e) => updateTax('sgstRate', Number(e.target.value))}
                  />
                </div>
              ) : taxForm.taxDisplayMode === 'igst' ? (
                <Input
                  label="IGST (%)"
                  fieldKind="percentage"
                  value={taxForm.igstRate}
                  onChange={(e) => updateTax('igstRate', Number(e.target.value))}
                />
              ) : (
                <Input
                  label="GST (%)"
                  fieldKind="percentage"
                  value={taxForm.gstRate}
                  onChange={(e) => updateTax('gstRate', Number(e.target.value))}
                />
              )}

              <Button onClick={handleSaveTax} disabled={savingTax}>
                {savingTax ? 'Saving...' : 'Save tax settings'}
              </Button>
            </div>
          ) : (
            <EmployeeSettingsPanel />
          )}
        </div>
      </div>
    </div>
  );
}
