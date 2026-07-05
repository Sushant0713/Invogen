import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

const PLAN_TYPE_OPTIONS = [
  { value: 'business', label: 'Business Plan', name: 'Business Plan' },
  { value: 'company', label: 'Company Plan', name: 'Company Plan' },
  { value: 'custom', label: 'Add New', name: '' },
] as const;

type PlanTypeKey = (typeof PLAN_TYPE_OPTIONS)[number]['value'];
type PricingModel = 'subscription' | 'lifetime' | 'both';

const pricingModelFromFlags = (hasSubscription: boolean, hasLifetime: boolean): PricingModel | null => {
  if (hasSubscription && hasLifetime) return 'both';
  if (hasSubscription) return 'subscription';
  if (hasLifetime) return 'lifetime';
  return null;
};

const flagsFromPricingModel = (model?: PricingModel) => ({
  hasSubscription: model === 'subscription' || model === 'both',
  hasLifetime: model === 'lifetime' || model === 'both',
});

interface PlanType {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  pricingModel: PricingModel;
  monthlyPrice: number;
  yearlyPrice: number;
  lifetimePrice: number;
  maintenanceCharge?: number;
  currency: string;
  featureIds: { _id: string; name: string }[];
  isActive: boolean;
}

interface Feature {
  _id: string;
  name: string;
  key: string;
}

const emptyForm = () => ({
  typeKey: 'business' as PlanTypeKey,
  customName: '',
  description: '',
  hasSubscription: true,
  hasLifetime: false,
  monthlyPrice: '',
  yearlyPrice: '',
  lifetimePrice: '',
  maintenanceCharge: '',
  featureIds: [] as string[],
});

export default function PlanTypesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: planTypes, isLoading } = useQuery({
    queryKey: ['plan-types'],
    queryFn: async () => (await api.get('/super-admin/plan-types')).data.data as PlanType[],
  });

  const { data: features } = useQuery({
    queryKey: ['plan-features'],
    queryFn: async () => (await api.get('/super-admin/plan-features')).data.data as Feature[],
  });

  const resolveName = () => {
    if (form.typeKey === 'custom') return form.customName.trim();
    return PLAN_TYPE_OPTIONS.find((o) => o.value === form.typeKey)?.name || '';
  };

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editingId
        ? api.patch(`/super-admin/plan-types/${editingId}`, body)
        : api.post('/super-admin/plan-types', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-types'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan-features'] });
      toast.success(editingId ? 'Plan type updated' : 'Plan type created');
      resetForm();
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Failed to save plan type');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/super-admin/plan-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-types'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan-features'] });
      toast.success('Plan type deleted');
    },
  });

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const inferTypeKey = (name: string): PlanTypeKey => {
    const lower = name.toLowerCase();
    if (lower.includes('business')) return 'business';
    if (lower.includes('company')) return 'company';
    return 'custom';
  };

  const handleEdit = (pt: PlanType) => {
    const typeKey = inferTypeKey(pt.name);
    const flags = flagsFromPricingModel(pt.pricingModel);
    setEditingId(pt._id);
    setForm({
      typeKey,
      customName: typeKey === 'custom' ? pt.name : '',
      description: pt.description || '',
      ...flags,
      monthlyPrice: pt.monthlyPrice ? String(pt.monthlyPrice) : '',
      yearlyPrice: pt.yearlyPrice ? String(pt.yearlyPrice) : '',
      lifetimePrice: pt.lifetimePrice ? String(pt.lifetimePrice) : '',
      maintenanceCharge: pt.maintenanceCharge ? String(pt.maintenanceCharge) : '',
      featureIds: pt.featureIds?.map((f) => (typeof f === 'string' ? f : f._id)) || [],
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = resolveName();
    if (!name) {
      toast.error('Please enter a plan type name');
      return;
    }

    const pricingModel = pricingModelFromFlags(form.hasSubscription, form.hasLifetime);
    if (!pricingModel) {
      toast.error('Select at least one pricing model');
      return;
    }

    const body: Record<string, unknown> = {
      name,
      description: form.description,
      pricingModel,
      featureIds: form.featureIds,
    };

    if (form.hasSubscription) {
      body.monthlyPrice = Number(form.monthlyPrice);
      body.yearlyPrice = Number(form.yearlyPrice);
    }
    if (form.hasLifetime) {
      body.lifetimePrice = Number(form.lifetimePrice);
      body.maintenanceCharge = form.maintenanceCharge ? Number(form.maintenanceCharge) : undefined;
    }

    saveMutation.mutate(body);
  };

  const togglePricingModel = (key: 'hasSubscription' | 'hasLifetime') => {
    setForm((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.hasSubscription && !next.hasLifetime) return prev;
      return next;
    });
  };

  const pricingLabel = (model?: PricingModel) => {
    if (model === 'both') return 'Subscription + Lifetime';
    if (model === 'lifetime') return 'Lifetime';
    return 'Subscription';
  };

  const toggleFeature = (id: string) => {
    setForm((prev) => ({
      ...prev,
      featureIds: prev.featureIds.includes(id)
        ? prev.featureIds.filter((f) => f !== id)
        : [...prev.featureIds, id],
    }));
  };

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          Define plan categories and default pricing models. Create sellable plans with features on the Plan List page.
        </p>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>Add Plan Type</Button>
      </div>

      {showForm && (
        <Card>
          <h3 className="font-semibold mb-4">{editingId ? 'Edit Plan Type' : 'New Plan Type'}</h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Type</label>
                <select
                  className="w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={form.typeKey}
                  onChange={(e) => setForm({ ...form, typeKey: e.target.value as PlanTypeKey })}
                >
                  {PLAN_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {form.typeKey === 'custom' ? (
                <Input
                  label="New Plan Type Name"
                  placeholder="e.g. Enterprise Plan"
                  value={form.customName}
                  onChange={(e) => setForm({ ...form, customName: e.target.value })}
                  required
                />
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Plan Name</label>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm text-gray-700">
                    {resolveName()}
                  </div>
                </div>
              )}

              <Input
                label="Description"
                className="md:col-span-2"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pricing Model</label>
              <p className="text-xs text-gray-500 mb-2">Select one or both options</p>
              <div className="flex flex-wrap gap-3">
                {([
                  { key: 'hasSubscription' as const, label: 'Subscription Model', desc: 'Monthly & Yearly' },
                  { key: 'hasLifetime' as const, label: 'Lifetime Model', desc: 'One-time + Maintenance' },
                ]).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => togglePricingModel(opt.key)}
                    className={`flex-1 min-w-[200px] rounded-xl border-2 p-4 text-left transition-all ${
                      form[opt.key]
                        ? 'border-primary bg-primary-50 shadow-md'
                        : 'border-gray-200 hover:border-primary-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900">{opt.label}</p>
                      <span className={`h-5 w-5 rounded border flex items-center justify-center text-xs ${
                        form[opt.key] ? 'bg-primary border-primary text-white' : 'border-gray-300 bg-white'
                      }`}>
                        {form[opt.key] ? '✓' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {form.hasSubscription && (
              <div className="grid md:grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4">
                <p className="md:col-span-2 text-sm font-medium text-gray-700">Subscription pricing</p>
                <Input
                  label="Monthly Price (INR)"
                  type="number"
                  min="0"
                  value={form.monthlyPrice}
                  onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })}
                  required
                />
                <Input
                  label="Yearly Price (INR)"
                  type="number"
                  min="0"
                  value={form.yearlyPrice}
                  onChange={(e) => setForm({ ...form, yearlyPrice: e.target.value })}
                  required
                />
              </div>
            )}

            {form.hasLifetime && (
              <div className="grid md:grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4">
                <p className="md:col-span-2 text-sm font-medium text-gray-700">Lifetime pricing</p>
                <Input
                  label="Lifetime Price (INR)"
                  type="number"
                  min="0"
                  value={form.lifetimePrice}
                  onChange={(e) => setForm({ ...form, lifetimePrice: e.target.value })}
                  required
                />
                <Input
                  label="Yearly Maintenance Price (INR)"
                  type="number"
                  min="0"
                  value={form.maintenanceCharge}
                  onChange={(e) => setForm({ ...form, maintenanceCharge: e.target.value })}
                  required
                />
              </div>
            )}

            {features && features.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-700">Features</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {features.map((f) => (
                    <button
                      key={f._id}
                      type="button"
                      onClick={() => toggleFeature(f._id)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        form.featureIds.includes(f._id)
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-primary'
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" loading={saveMutation.isPending}>Save</Button>
              <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {(planTypes || []).map((pt) => (
          <Card key={pt._id}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{pt.name}</h3>
                <p className="text-sm text-gray-500">{pt.description}</p>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <Badge variant={pt.isActive ? 'success' : 'warning'}>{pt.isActive ? 'Active' : 'Inactive'}</Badge>
                <Badge>{pricingLabel(pt.pricingModel)}</Badge>
              </div>
            </div>

            {flagsFromPricingModel(pt.pricingModel).hasSubscription && (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-primary-50 p-3">
                  <p className="text-gray-500">Monthly</p>
                  <p className="font-bold text-primary">{formatCurrency(pt.monthlyPrice)}</p>
                </div>
                <div className="rounded-xl bg-primary-50 p-3">
                  <p className="text-gray-500">Yearly</p>
                  <p className="font-bold text-primary">{formatCurrency(pt.yearlyPrice)}</p>
                </div>
              </div>
            )}

            {flagsFromPricingModel(pt.pricingModel).hasLifetime && (
              <div className={`grid grid-cols-2 gap-3 text-sm ${flagsFromPricingModel(pt.pricingModel).hasSubscription ? 'mt-3' : 'mt-4'}`}>
                <div className="rounded-xl bg-primary-50 p-3">
                  <p className="text-gray-500">Lifetime</p>
                  <p className="font-bold text-primary">{formatCurrency(pt.lifetimePrice)}</p>
                </div>
                <div className="rounded-xl bg-primary-50 p-3">
                  <p className="text-gray-500">Maintenance/yr</p>
                  <p className="font-bold text-primary">{formatCurrency(pt.maintenanceCharge || 0)}</p>
                </div>
              </div>
            )}

            {pt.featureIds?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {pt.featureIds.map((f) => (
                  <Badge key={typeof f === 'string' ? f : f._id}>{typeof f === 'string' ? f : f.name}</Badge>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleEdit(pt)}>Edit</Button>
              <Button size="sm" variant="danger" onClick={() => deleteMutation.mutate(pt._id)}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
