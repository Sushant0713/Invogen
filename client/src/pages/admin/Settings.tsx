import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FileUpload } from '@/components/ui/FileUpload';
import { Loader } from '@/components/ui/Loader';
import { Switch } from '@/components/ui/Switch';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { invalidateCompanyBranding } from '@/features/builder/use-company-branding-query';
import { invalidateTaxSettings } from '@/features/builder/use-tax-settings-query';
import {
  type TaxSettings,
  EMPTY_TAX_SETTINGS,
  parseTaxSettings,
  type TaxDisplayMode,
} from '@/features/builder/tax-settings';
import { EmployeeSettingsPanel } from '@/features/employees/EmployeeSettingsPanel';

type CompanyForm = {
  name: string;
  gst: string;
  pan: string;
  logo: string;
  signature: string;
};

export default function AdminSettings() {
  const queryClient = useQueryClient();
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
  const [taxForm, setTaxForm] = useState<TaxSettings>(EMPTY_TAX_SETTINGS);
  const [savingCompany, setSavingCompany] = useState(false);
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
    setTaxForm(parseTaxSettings(data.taxSettings));
  }, [data]);

  if (isLoading) return <Loader />;

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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Company Settings</h2>
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
      </Card>

      <Card className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Set up tax</h2>
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
      </Card>

      <EmployeeSettingsPanel />
    </div>
  );
}
