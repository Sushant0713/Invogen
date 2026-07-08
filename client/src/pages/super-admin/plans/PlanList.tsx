import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { DataTable } from '@/components/ui/DataTable';
import { Loader } from '@/components/ui/Loader';
import { formatCurrency } from '@/lib/utils';
import {
  Layers,
  CheckCircle,
  Ban,
  Calendar,
  Clock,
  Infinity,
  LayoutTemplate,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

type BillingCycle = 'monthly' | 'yearly' | 'lifetime';
type PricingModel = 'subscription' | 'lifetime' | 'both';

interface PlanTypeOption {
  _id: string;
  name: string;
  description?: string;
  pricingModel?: PricingModel;
  monthlyPrice: number;
  yearlyPrice: number;
  lifetimePrice: number;
  maintenanceCharge?: number;
  currency: string;
  featureIds: { _id: string; name: string }[];
}

interface FeatureOption {
  _id: string;
  name: string;
  key: string;
  isActive: boolean;
}

interface PlanDiscountRef {
  code: string;
  name: string;
}

interface PlanTemplateRef {
  _id: string;
  name: string;
  category: string;
}

interface SystemTemplateOption {
  _id: string;
  name: string;
  category: string;
  description?: string;
}

interface PlanRow {
  _id: string;
  name: string;
  tier: string;
  billingCycle: BillingCycle;
  price: number;
  currency: string;
  maintenanceCharge?: number;
  features: string[];
  featureIds?: { _id: string; name: string }[];
  templateIds?: PlanTemplateRef[] | string[];
  canAddTemplate?: boolean;
  templateAccessConfigured?: boolean;
  /** Show "Made with Invogen" ad badge on templates/invoices for this plan. */
  showMadeWithInvogen?: boolean;
  planTypeId?: PlanTypeOption | string;
  isActive: boolean;
  visibleOnWebsite: boolean;
  visibleOnSuperAdmin: boolean;
  description?: string;
  razorpayPlanId?: string;
  discountCount?: number;
  discounts?: PlanDiscountRef[];
  userCount?: number;
}

const selectClass =
  'rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const emptyForm = () => ({
  planTypeId: '',
  billingCycle: 'monthly' as BillingCycle,
  name: '',
  description: '',
  featureIds: [] as string[],
  templateIds: [] as string[],
  /** False for legacy plans that never configured templates (all system templates allowed). */
  templatesConfigured: false,
  canAddTemplate: false,
  showMadeWithInvogen: false,
  price: '',
  maintenanceCharge: '',
  isActive: true,
  visibleOnWebsite: true,
  visibleOnSuperAdmin: true,
});

const planTemplateIds = (plan: PlanRow): string[] => {
  if (!Array.isArray(plan.templateIds) || plan.templateIds.length === 0) return [];
  return plan.templateIds
    .map((t) => {
      if (t == null) return '';
      if (typeof t === 'string') return t;
      if (typeof t === 'object' && '_id' in t && t._id != null) return String(t._id);
      return '';
    })
    .filter(Boolean);
};

const flagsFromPricingModel = (model?: PricingModel) => ({
  hasSubscription: model === 'subscription' || model === 'both',
  hasLifetime: model === 'lifetime' || model === 'both',
});

const priceForCycle = (planType: PlanTypeOption, cycle: BillingCycle) => {
  if (cycle === 'monthly') return planType.monthlyPrice;
  if (cycle === 'yearly') return planType.yearlyPrice;
  return planType.lifetimePrice;
};

type PlanStatKey = 'total' | 'active' | 'inactive' | 'monthly' | 'yearly' | 'lifetime';
type PlanStats = Record<PlanStatKey, number>;

const PLAN_STAT_ITEMS: { key: PlanStatKey; label: string; icon: LucideIcon }[] = [
  { key: 'total', label: 'Total', icon: Layers },
  { key: 'active', label: 'Active', icon: CheckCircle },
  { key: 'inactive', label: 'Inactive', icon: Ban },
  { key: 'monthly', label: 'Monthly', icon: Clock },
  { key: 'yearly', label: 'Yearly', icon: Calendar },
  { key: 'lifetime', label: 'Lifetime', icon: Infinity },
];

function PlanStatsBar({ stats }: { stats: PlanStats }) {
  return (
    <div className="flex rounded-lg border border-gray-200 bg-white overflow-x-auto">
      {PLAN_STAT_ITEMS.map(({ key, label, icon: Icon }, index) => (
        <div
          key={key}
          className={`flex flex-1 min-w-[88px] items-center gap-1.5 px-2 py-1.5 ${
            index > 0 ? 'border-l border-gray-100' : ''
          }`}
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
          <div className="min-w-0 leading-none">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 truncate">{label}</p>
            <p className="mt-0.5 text-sm font-bold text-gray-900 tabular-nums">{stats[key]}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const resolvePlanType = (plan: PlanRow): PlanTypeOption | null => {
  if (!plan.planTypeId || typeof plan.planTypeId === 'string') return null;
  return plan.planTypeId;
};

const featureNames = (plan: PlanRow) =>
  plan.featureIds?.length ? plan.featureIds.map((f) => f.name) : plan.features || [];

export default function PlanListPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [cycleFilter, setCycleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [draftTemplateIds, setDraftTemplateIds] = useState<string[]>([]);
  const [draftCanAddTemplate, setDraftCanAddTemplate] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-plans'],
    queryFn: async () => (await api.get('/super-admin/plans')).data.data as PlanRow[],
  });

  const { data: planTypes } = useQuery({
    queryKey: ['plan-types'],
    queryFn: async () => (await api.get('/super-admin/plan-types')).data.data as PlanTypeOption[],
  });

  const { data: features } = useQuery({
    queryKey: ['plan-features'],
    queryFn: async () => (await api.get('/super-admin/plan-features')).data.data as FeatureOption[],
  });

  const { data: systemTemplates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['super-admin-templates-for-plans'],
    queryFn: async () =>
      (await api.get('/super-admin/templates', { params: { limit: 200 } })).data
        .data as SystemTemplateOption[],
  });

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
    refetchOnWindowFocus: true,
  });

  const activeFeatures = useMemo(
    () => (features || []).filter((f) => f.isActive),
    [features]
  );

  const selectedPlanType = planTypes?.find((pt) => pt._id === form.planTypeId);

  const billingOptions = useMemo(() => {
    const flags = flagsFromPricingModel(selectedPlanType?.pricingModel);
    const options: { value: BillingCycle; label: string }[] = [];
    if (flags.hasSubscription) {
      options.push({ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' });
    }
    if (flags.hasLifetime) {
      options.push({ value: 'lifetime', label: 'Lifetime' });
    }
    return options;
  }, [selectedPlanType]);

  const applyPlanTypeDefaults = (planTypeId: string, billingCycle?: BillingCycle) => {
    const planType = planTypes?.find((pt) => pt._id === planTypeId);
    if (!planType) return;

    const flags = flagsFromPricingModel(planType.pricingModel);
    let cycle = billingCycle || form.billingCycle;
    if (cycle === 'monthly' && !flags.hasSubscription) cycle = flags.hasLifetime ? 'lifetime' : 'yearly';
    if (cycle === 'yearly' && !flags.hasSubscription) cycle = 'lifetime';
    if (cycle === 'lifetime' && !flags.hasLifetime) cycle = 'monthly';

    const defaultFeatures = planType.featureIds?.map((f) => f._id) || [];
    const label = cycle.charAt(0).toUpperCase() + cycle.slice(1);

    setForm((prev) => ({
      ...prev,
      planTypeId,
      billingCycle: cycle,
      name: `${planType.name} ${label}`,
      description: planType.description || '',
      featureIds: defaultFeatures,
      price: String(priceForCycle(planType, cycle)),
      maintenanceCharge: cycle === 'lifetime' && planType.maintenanceCharge
        ? String(planType.maintenanceCharge)
        : '',
    }));
  };

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
    setShowTemplateModal(false);
    setDraftTemplateIds([]);
    setDraftCanAddTemplate(false);
    setTemplateSearch('');
  };

  const allSystemTemplateIds = useMemo(
    () => systemTemplates.map((t) => t._id),
    [systemTemplates]
  );

  // New plans default to all pre-built templates selected once the list loads.
  useEffect(() => {
    if (!showForm || editingId || form.templatesConfigured || allSystemTemplateIds.length === 0) {
      return;
    }
    setForm((prev) => {
      if (prev.templatesConfigured || prev.templateIds.length > 0) return prev;
      return {
        ...prev,
        templateIds: allSystemTemplateIds,
        templatesConfigured: true,
        canAddTemplate: prev.canAddTemplate,
      };
    });
  }, [showForm, editingId, form.templatesConfigured, allSystemTemplateIds]);

  const openTemplateModal = () => {
    const selected =
      form.templatesConfigured || form.templateIds.length > 0
        ? form.templateIds.map(String)
        : allSystemTemplateIds.map(String);
    setDraftTemplateIds(selected);
    setDraftCanAddTemplate(form.canAddTemplate);
    setTemplateSearch('');
    setShowTemplateModal(true);
  };

  const applyTemplateSelection = () => {
    setForm((prev) => ({
      ...prev,
      templateIds: draftTemplateIds.map(String),
      canAddTemplate: draftCanAddTemplate,
      templatesConfigured: true,
    }));
    setShowTemplateModal(false);
  };

  const toggleDraftTemplate = (id: string) => {
    const templateId = String(id);
    setDraftTemplateIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((t) => t !== templateId)
        : [...prev, templateId]
    );
  };

  const filteredSystemTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    if (!q) return systemTemplates;
    return systemTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(q)
        || t.category.toLowerCase().includes(q)
        || (t.description || '').toLowerCase().includes(q)
    );
  }, [systemTemplates, templateSearch]);

  const selectedTemplateLabels = useMemo(() => {
    const selected = new Set(form.templateIds.map(String));
    return systemTemplates.filter((t) => selected.has(String(t._id)));
  }, [form.templateIds, systemTemplates]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editingId
        ? api.patch(`/super-admin/plans/${editingId}`, body)
        : api.post('/super-admin/plans', body),
    onSuccess: async (res) => {
      const saved = res.data?.data as PlanRow | undefined;
      if (saved?._id) {
        queryClient.setQueryData<PlanRow[]>(['super-admin-plans'], (prev) => {
          const rows = prev || [];
          const nextRow: PlanRow = {
            ...saved,
            templateIds: saved.templateIds || [],
            templateAccessConfigured: saved.templateAccessConfigured === true,
            canAddTemplate: saved.canAddTemplate === true,
            showMadeWithInvogen: saved.showMadeWithInvogen === true,
          };
          const idx = rows.findIndex((p) => p._id === saved._id);
          if (idx === -1) return [...rows, nextRow];
          const copy = [...rows];
          copy[idx] = { ...rows[idx], ...nextRow };
          return copy;
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['super-admin-plans'] });
      toast.success(
        editingId
          ? `Plan updated · ${planTemplateIds(saved || { templateIds: form.templateIds } as PlanRow).length} templates`
          : 'Plan created'
      );
      resetForm();
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Failed to save plan');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/super-admin/plans/${id}`, { isActive }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-plans'] });
      toast.success(vars.isActive ? 'Plan enabled' : 'Plan disabled');
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: ({
      id,
      field,
      value,
    }: {
      id: string;
      field: 'visibleOnWebsite' | 'visibleOnSuperAdmin';
      value: boolean;
    }) => api.patch(`/super-admin/plans/${id}`, { [field]: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-plans'] });
      toast.success('Visibility updated');
    },
    onError: () => toast.error('Failed to update visibility'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/super-admin/plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-plans'] });
      toast.success('Plan deleted');
    },
  });

  const handleEdit = (plan: PlanRow) => {
    const planType = resolvePlanType(plan);
    const savedTemplateIds = planTemplateIds(plan);
    const templatesConfigured =
      plan.templateAccessConfigured === true
      || (plan.canAddTemplate !== undefined && plan.canAddTemplate !== null)
      || savedTemplateIds.length > 0;
    setEditingId(plan._id);
    setForm({
      planTypeId: planType?._id || '',
      billingCycle: plan.billingCycle,
      name: plan.name,
      description: plan.description || '',
      featureIds: plan.featureIds?.map((f) => String(f._id)) || [],
      templateIds: savedTemplateIds,
      templatesConfigured,
      // Legacy (not configured) plans keep add-template access until explicitly set.
      canAddTemplate: templatesConfigured
        ? plan.canAddTemplate === true
        : true,
      showMadeWithInvogen: plan.showMadeWithInvogen === true,
      price: String(plan.price),
      maintenanceCharge: plan.maintenanceCharge ? String(plan.maintenanceCharge) : '',
      isActive: plan.isActive,
      visibleOnWebsite: plan.visibleOnWebsite ?? true,
      visibleOnSuperAdmin: plan.visibleOnSuperAdmin ?? true,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.planTypeId) {
      toast.error('Select a plan type');
      return;
    }
    if (!form.featureIds.length) {
      toast.error('Select at least one feature');
      return;
    }

    const payload: Record<string, unknown> = {
      planTypeId: form.planTypeId,
      billingCycle: form.billingCycle,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      featureIds: form.featureIds,
      price: Number(form.price),
      maintenanceCharge:
        form.billingCycle === 'lifetime' && form.maintenanceCharge
          ? Number(form.maintenanceCharge)
          : undefined,
      isActive: form.isActive,
      visibleOnWebsite: form.visibleOnWebsite,
      visibleOnSuperAdmin: form.visibleOnSuperAdmin,
    };

    // Always persist template access from the plan form so edit can restore checkboxes.
    payload.templateIds = (form.templatesConfigured
      ? form.templateIds
      : allSystemTemplateIds
    ).map(String);
    payload.canAddTemplate = Boolean(form.canAddTemplate);
    payload.templateAccessConfigured = true;
    payload.showMadeWithInvogen = Boolean(form.showMadeWithInvogen);

    saveMutation.mutate(payload);
  };

  const toggleFeature = (id: string) => {
    setForm((prev) => ({
      ...prev,
      featureIds: prev.featureIds.includes(id)
        ? prev.featureIds.filter((f) => f !== id)
        : [...prev.featureIds, id],
    }));
  };

  const stats = useMemo<PlanStats>(() => {
    const rows = data || [];
    return {
      total: rows.length,
      active: rows.filter((p) => p.isActive).length,
      inactive: rows.filter((p) => !p.isActive).length,
      monthly: rows.filter((p) => p.billingCycle === 'monthly').length,
      yearly: rows.filter((p) => p.billingCycle === 'yearly').length,
      lifetime: rows.filter((p) => p.billingCycle === 'lifetime').length,
    };
  }, [data]);

  const filteredPlans = useMemo(() => {
    return (data || []).filter((plan) => {
      const planType = resolvePlanType(plan);
      if (typeFilter !== 'all' && planType?._id !== typeFilter) return false;
      if (cycleFilter !== 'all' && plan.billingCycle !== cycleFilter) return false;
      if (statusFilter === 'active' && !plan.isActive) return false;
      if (statusFilter === 'inactive' && plan.isActive) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        plan.name.toLowerCase().includes(q) ||
        planType?.name.toLowerCase().includes(q) ||
        featureNames(plan).some((f) => f.toLowerCase().includes(q))
      );
    });
  }, [data, search, typeFilter, cycleFilter, statusFilter]);

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-4">
      <PlanStatsBar stats={stats} />

      {cashfreeStatus && cashfreeStatus.configured && cashfreeStatus.connected && (
        <Card className="border-green-200 bg-green-50/80">
          <p className="text-sm text-green-900">{cashfreeStatus.message}</p>
          <p className="mt-1 text-xs text-green-800">
            App ID: {cashfreeStatus.appIdPrefix}... · environment: {cashfreeStatus.environment}
          </p>
        </Card>
      )}

      {cashfreeStatus && (!cashfreeStatus.configured || !cashfreeStatus.connected) && (
        <Card className="border-red-200 bg-red-50/80">
          <p className="text-sm font-medium text-red-950">Cashfree connection issue</p>
          <p className="mt-1 text-sm text-red-900">{cashfreeStatus.message}</p>
          {cashfreeStatus.configured && (
            <p className="mt-2 text-xs text-red-800">
              Loaded App ID: {cashfreeStatus.appIdPrefix}... · environment: {cashfreeStatus.environment}
            </p>
          )}
          <p className="mt-2 text-xs text-red-800">
            After updating <code>.env</code>, save the file and restart the server.
          </p>
        </Card>
      )}

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <Input
            placeholder="Search plans..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <select className={selectClass} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            {(planTypes || []).map((pt) => (
              <option key={pt._id} value={pt._id}>{pt.name}</option>
            ))}
          </select>
          <select className={selectClass} value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)}>
            <option value="all">All billing</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="lifetime">Lifetime</option>
          </select>
          <select className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { resetForm(); setShowForm(true); }}>Create Plan</Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <h3 className="font-semibold mb-4">{editingId ? 'Edit Plan' : 'New Plan'}</h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Plan Type</label>
                <select
                  className={selectClass + ' w-full'}
                  value={form.planTypeId}
                  onChange={(e) => applyPlanTypeDefaults(e.target.value)}
                  required
                >
                  <option value="">Select plan type</option>
                  {(planTypes || []).map((pt) => (
                    <option key={pt._id} value={pt._id}>{pt.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Billing Cycle</label>
                <select
                  className={selectClass + ' w-full'}
                  value={form.billingCycle}
                  disabled={!form.planTypeId}
                  onChange={(e) => {
                    const cycle = e.target.value as BillingCycle;
                    if (selectedPlanType) {
                      applyPlanTypeDefaults(form.planTypeId, cycle);
                    } else {
                      setForm({ ...form, billingCycle: cycle });
                    }
                  }}
                  required
                >
                  {billingOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Plan Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                label="Price (INR)"
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
              {form.billingCycle === 'lifetime' && (
                <Input
                  label="Yearly Maintenance (INR)"
                  type="number"
                  min="0"
                  value={form.maintenanceCharge}
                  onChange={(e) => setForm({ ...form, maintenanceCharge: e.target.value })}
                />
              )}
              <Input
                label="Description"
                className="md:col-span-2"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {activeFeatures.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-700">Features</label>
                <p className="text-xs text-gray-500 mb-2">From Feature List — defaults load from plan type</p>
                <div className="flex flex-wrap gap-2">
                  {activeFeatures.map((f) => (
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

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <LayoutTemplate className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-gray-800">Client template access</p>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Choose which pre-built templates clients on this plan can see and use.
                    Company-owned templates are always available.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={openTemplateModal}>
                  {form.templatesConfigured ? 'Edit templates' : 'Select templates'}
                </Button>
              </div>
              {form.templatesConfigured ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-600">
                    {form.templateIds.length} of {systemTemplates.length} pre-built template
                    {systemTemplates.length === 1 ? '' : 's'} selected
                  </p>
                  <p className="text-xs text-gray-600">
                    Add template:{' '}
                    <span className="font-medium text-gray-800">
                      {form.canAddTemplate ? 'Allowed' : 'Not allowed'}
                    </span>
                  </p>
                  {selectedTemplateLabels.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTemplateLabels.slice(0, 8).map((t) => (
                        <Badge key={t._id}>{t.name}</Badge>
                      ))}
                      {selectedTemplateLabels.length > 8 && (
                        <Badge>+{selectedTemplateLabels.length - 8} more</Badge>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700">
                      No pre-built templates selected — clients will only see their own templates
                      {form.canAddTemplate ? ' (if they create any).' : '.'}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  Not configured — clients currently have access to all pre-built templates and can add their own.
                </p>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.visibleOnWebsite}
                  onChange={(visibleOnWebsite) => setForm({ ...form, visibleOnWebsite })}
                  label="Visible on website"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">Website</p>
                  <p className="text-xs text-gray-500">Show on public pricing pages</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.visibleOnSuperAdmin}
                  onChange={(visibleOnSuperAdmin) => setForm({ ...form, visibleOnSuperAdmin })}
                  label="Visible in super admin"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">Super Admin</p>
                  <p className="text-xs text-gray-500">Show in admin plan management views</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <Switch
                checked={form.isActive}
                onChange={(isActive) => setForm({ ...form, isActive })}
                label="Plan enabled"
              />
              <p className="text-sm text-gray-600">Active plans appear at checkout</p>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <Switch
                checked={form.showMadeWithInvogen}
                onChange={(showMadeWithInvogen) => setForm({ ...form, showMadeWithInvogen })}
                label="Made with Invogen advertising"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">Made with Invogen</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  When on, every invoice/template for companies on this plan shows a small
                  &quot;Made with Invogen&quot; badge (with Invogen logo) at the bottom-right.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" loading={saveMutation.isPending}>
                {editingId ? 'Update Plan' : 'Create Plan'}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden" glass={false}>
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Client template access</h3>
              <p className="mt-1 text-sm text-gray-500">
                Choose which pre-built templates clients on this plan can use, and whether they
                may create their own templates.
              </p>
            </div>

            <div className="space-y-3 border-b border-gray-100 px-5 py-3">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                  draftCanAddTemplate
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  checked={draftCanAddTemplate}
                  onChange={(e) => setDraftCanAddTemplate(e.target.checked)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900">
                    Allow Add Template
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    Clients on this plan can create custom templates. Leave unchecked to hide the
                    Add Template option.
                  </span>
                </span>
              </label>

              <Input
                placeholder="Search templates..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-gray-500">
                  {draftTemplateIds.length} selected
                  {templateSearch.trim()
                    ? ` · showing ${filteredSystemTemplates.length}`
                    : ` of ${systemTemplates.length}`}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setDraftTemplateIds(allSystemTemplateIds)}
                    disabled={templatesLoading || systemTemplates.length === 0}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setDraftTemplateIds([])}
                    disabled={draftTemplateIds.length === 0}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
              {templatesLoading ? (
                <div className="flex justify-center py-10">
                  <Loader />
                </div>
              ) : filteredSystemTemplates.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-500">
                  {systemTemplates.length === 0
                    ? 'No pre-built templates yet. Create them under Templates.'
                    : 'No templates match your search.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {filteredSystemTemplates.map((template) => {
                    const checked = draftTemplateIds.includes(String(template._id));
                    return (
                      <li key={template._id}>
                        <label
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                            checked
                              ? 'border-primary/40 bg-primary/5'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={checked}
                            onChange={() => toggleDraftTemplate(template._id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{template.name}</span>
                              <Badge>{template.category}</Badge>
                            </span>
                            {template.description && (
                              <span className="mt-0.5 block text-xs text-gray-500 line-clamp-2">
                                {template.description}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowTemplateModal(false);
                  setTemplateSearch('');
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={applyTemplateSelection}>
                Apply selection
              </Button>
            </div>
          </Card>
        </div>
      )}

      <DataTable
        columns={[
          {
            key: 'name',
            label: 'Plan',
            render: (r) => {
              const plan = r as unknown as PlanRow;
              return (
                <div>
                  <p className="font-medium">{plan.name}</p>
                  {plan.description && <p className="text-xs text-gray-500 line-clamp-1">{plan.description}</p>}
                </div>
              );
            },
          },
          {
            key: 'planTypeId',
            label: 'Type',
            render: (r) => resolvePlanType(r as unknown as PlanRow)?.name || '—',
          },
          {
            key: 'billingCycle',
            label: 'Billing',
            render: (r) => (
              <Badge className="capitalize">{(r as unknown as PlanRow).billingCycle}</Badge>
            ),
          },
          {
            key: 'price',
            label: 'Price',
            render: (r) => {
              const plan = r as unknown as PlanRow;
              return (
                <div className="text-sm">
                  <p className="font-semibold text-primary">{formatCurrency(plan.price, plan.currency)}</p>
                  {plan.billingCycle === 'lifetime' && plan.maintenanceCharge ? (
                    <p className="text-xs text-gray-500">+ {formatCurrency(plan.maintenanceCharge)}/yr</p>
                  ) : null}
                </div>
              );
            },
          },
          {
            key: 'features',
            label: 'Features',
            render: (r) => {
              const count = featureNames(r as unknown as PlanRow).length;
              return (
                <span className="text-sm font-medium text-gray-700 tabular-nums">
                  {count}
                </span>
              );
            },
          },
          {
            key: 'templates',
            label: 'Templates',
            render: (r) => {
              const plan = r as unknown as PlanRow;
              const count = planTemplateIds(plan).length;
              const configured =
                plan.templateAccessConfigured === true
                || (plan.canAddTemplate !== undefined && plan.canAddTemplate !== null)
                || count > 0;
              if (!configured) {
                return (
                  <div className="text-xs text-gray-400">
                    <p>All</p>
                    <p>Add: yes</p>
                  </div>
                );
              }
              return (
                <div className="text-xs text-gray-700">
                  <p className="font-medium tabular-nums">{count} pre-built</p>
                  <p className="text-gray-500">
                    Add: {plan.canAddTemplate ? 'yes' : 'no'}
                  </p>
                </div>
              );
            },
          },
          {
            key: 'showMadeWithInvogen',
            label: 'Made with',
            render: (r) => {
              const on = (r as unknown as PlanRow).showMadeWithInvogen === true;
              return (
                <Badge className={on ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'}>
                  {on ? 'On' : 'Off'}
                </Badge>
              );
            },
          },
          {
            key: 'userCount',
            label: 'Users',
            render: (r) => {
              const count = (r as unknown as PlanRow).userCount ?? 0;
              return (
                <span className="text-sm font-medium text-gray-700 tabular-nums">{count}</span>
              );
            },
          },
          {
            key: 'discounts',
            label: 'Discounts',
            render: (r) => {
              const plan = r as unknown as PlanRow;
              if (!plan.discountCount) return <span className="text-gray-400 text-sm">—</span>;
              return (
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{plan.discountCount} linked</p>
                  {plan.discounts?.slice(0, 2).map((d) => (
                    <p key={d.code} className="text-[10px] text-primary font-mono">{d.code}</p>
                  ))}
                </div>
              );
            },
          },
          {
            key: 'visibility',
            label: 'Visibility',
            render: (r) => {
              const plan = r as unknown as PlanRow;
              const website = plan.visibleOnWebsite ?? true;
              const superAdmin = plan.visibleOnSuperAdmin ?? true;
              return (
                <div className="space-y-2 min-w-[140px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-600">Website</span>
                    <Switch
                      checked={website}
                      disabled={visibilityMutation.isPending}
                      onChange={(value) =>
                        visibilityMutation.mutate({ id: plan._id, field: 'visibleOnWebsite', value })
                      }
                      label={`Website visibility ${plan.name}`}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-600">Super Admin</span>
                    <Switch
                      checked={superAdmin}
                      disabled={visibilityMutation.isPending}
                      onChange={(value) =>
                        visibilityMutation.mutate({ id: plan._id, field: 'visibleOnSuperAdmin', value })
                      }
                      label={`Super admin visibility ${plan.name}`}
                    />
                  </div>
                </div>
              );
            },
          },
          {
            key: 'enabled',
            label: 'Enabled',
            render: (r) => {
              const plan = r as unknown as PlanRow;
              return (
                <Switch
                  checked={plan.isActive}
                  disabled={toggleMutation.isPending}
                  onChange={(isActive) => toggleMutation.mutate({ id: plan._id, isActive })}
                  label={`Enable ${plan.name}`}
                />
              );
            },
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (r) => {
              const plan = r as unknown as PlanRow;
              return (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(plan)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => deleteMutation.mutate(plan._id)}>Delete</Button>
                </div>
              );
            },
          },
        ]}
        data={filteredPlans as unknown as Record<string, unknown>[]}
        keyField="_id"
      />
    </div>
  );
}
