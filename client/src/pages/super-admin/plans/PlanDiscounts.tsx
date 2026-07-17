import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { TruncateText } from '@/components/ui/TruncateText';
import { DataTable } from '@/components/ui/DataTable';
import { Loader } from '@/components/ui/Loader';
import {
  resolveDiscountStatus,
  formatDiscountDate,
  PlanDiscountPromoType,
  type DiscountLifecycleStatus,
  type DiscountStatusSnapshot,
} from '@invogen/shared';
import { Tag, CheckCircle, Calendar, Ticket, Clock, Ban, type LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

type DiscountType = 'percentage' | 'fixed';
type PromoType = (typeof PlanDiscountPromoType)[keyof typeof PlanDiscountPromoType];

interface PlanTypeOption {
  _id: string;
  name: string;
}

interface PlanOption {
  _id: string;
  name: string;
  billingCycle: string;
  price: number;
  planTypeId?: string | { _id: string };
}

interface PlanDiscount {
  _id: string;
  name: string;
  code: string;
  description?: string;
  promoType?: PromoType;
  discountType: DiscountType;
  value: number;
  planTypeId?: PlanTypeOption | string;
  planId?: PlanOption | string;
  billingCycle: string;
  minOrderAmount?: number;
  maxUses?: number;
  usedCount: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  statusSnapshot?: DiscountStatusSnapshot;
}

const selectClass =
  'w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const emptyForm = () => ({
  name: '',
  code: '',
  description: '',
  promoType: PlanDiscountPromoType.SIMPLE as PromoType,
  discountType: 'percentage' as DiscountType,
  value: '',
  planTypeId: '',
  planId: '',
  billingCycle: 'all',
  minOrderAmount: '',
  maxUses: '',
  startDate: '',
  endDate: '',
  isActive: true,
});

const generateCode = () => `INV${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const getStatusSnapshot = (discount: PlanDiscount): DiscountStatusSnapshot =>
  discount.statusSnapshot ||
  resolveDiscountStatus({
    isActive: discount.isActive,
    startDate: discount.startDate,
    endDate: discount.endDate,
    maxUses: discount.maxUses,
    usedCount: discount.usedCount,
  });

const lifecycleBadgeVariant = (lifecycle: DiscountLifecycleStatus): 'success' | 'warning' | 'default' => {
  if (lifecycle === 'active') return 'success';
  if (lifecycle === 'scheduled') return 'default';
  return 'warning';
};

const LifecycleStatusBadge = ({ discount }: { discount: PlanDiscount }) => {
  const status = getStatusSnapshot(discount);
  return (
    <div className="space-y-1">
      <Badge variant={lifecycleBadgeVariant(status.lifecycle)}>{status.label}</Badge>
      <p className="text-xs text-gray-500 max-w-[180px]">{status.description}</p>
    </div>
  );
};

const promoTypeLabel = (promoType?: PromoType) =>
  promoType === PlanDiscountPromoType.BANNER ? 'Banner discount' : 'Simple discount';

const formatValue = (discount: PlanDiscount) =>
  discount.discountType === 'percentage' ? `${discount.value}%` : formatCurrency(discount.value);

type DiscountStatKey = 'total' | 'active' | 'scheduled' | 'ended' | 'inactive' | 'redemptions';

type DiscountStats = Record<DiscountStatKey, number>;

function buildDiscountStats(discounts: PlanDiscount[]): DiscountStats {
  const lifecycles = discounts.map((d) => getStatusSnapshot(d).lifecycle);
  return {
    total: discounts.length,
    active: lifecycles.filter((s) => s === 'active').length,
    scheduled: lifecycles.filter((s) => s === 'scheduled').length,
    ended: lifecycles.filter((s) => s === 'expired' || s === 'exhausted').length,
    inactive: lifecycles.filter((s) => s === 'inactive').length,
    redemptions: discounts.reduce((sum, d) => sum + (d.usedCount || 0), 0),
  };
}

const DISCOUNT_STAT_ITEMS: { key: DiscountStatKey; label: string; icon: LucideIcon }[] = [
  { key: 'total', label: 'Total', icon: Tag },
  { key: 'active', label: 'Active', icon: CheckCircle },
  { key: 'scheduled', label: 'Scheduled', icon: Clock },
  { key: 'ended', label: 'Ended', icon: Calendar },
  { key: 'inactive', label: 'Disabled', icon: Ban },
  { key: 'redemptions', label: 'Redeemed', icon: Ticket },
];

function DiscountStatsBar({ stats }: { stats: DiscountStats }) {
  return (
    <div className="flex rounded-lg border border-gray-200 bg-white overflow-x-auto">
      {DISCOUNT_STAT_ITEMS.map(({ key, label, icon: Icon }, index) => (
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

const resolveRefName = (ref?: { name?: string } | string) =>
  typeof ref === 'string' ? ref : ref?.name;

export default function PlanDiscountsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | PromoType>('all');

  const { data: discounts, isLoading } = useQuery({
    queryKey: ['plan-discounts'],
    queryFn: async () => (await api.get('/super-admin/plan-discounts')).data.data as PlanDiscount[],
  });

  const { data: planTypes } = useQuery({
    queryKey: ['plan-types'],
    queryFn: async () => (await api.get('/super-admin/plan-types')).data.data as PlanTypeOption[],
  });

  const { data: plans } = useQuery({
    queryKey: ['super-admin-plans'],
    queryFn: async () => (await api.get('/super-admin/plans')).data.data as PlanOption[],
  });

  const billingCycleOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All billing cycles' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'yearly', label: 'Yearly' },
    ];
  }, []);

  const filteredPlans = useMemo(() => {
    if (!plans) return [];
    if (!form.planTypeId) return plans;
    return plans.filter((plan) => {
      const typeId = typeof plan.planTypeId === 'string' ? plan.planTypeId : plan.planTypeId?._id;
      return typeId === form.planTypeId;
    });
  }, [plans, form.planTypeId]);

  const formStatusPreview = useMemo(
    () =>
      resolveDiscountStatus({
        isActive: form.isActive,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        maxUses: form.maxUses ? Number(form.maxUses) : undefined,
        usedCount: editingId
          ? discounts?.find((d) => d._id === editingId)?.usedCount || 0
          : 0,
      }),
    [form, editingId, discounts]
  );

  const stats = useMemo(() => buildDiscountStats(discounts || []), [discounts]);

  const filteredDiscounts = useMemo(() => {
    return (discounts || []).filter((discount) => {
      const lifecycle = getStatusSnapshot(discount).lifecycle;
      if (statusFilter !== 'all' && lifecycle !== statusFilter) return false;

      const promoType = discount.promoType || PlanDiscountPromoType.SIMPLE;
      if (typeFilter !== 'all' && promoType !== typeFilter) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        discount.name.toLowerCase().includes(q) ||
        discount.code.toLowerCase().includes(q) ||
        discount.description?.toLowerCase().includes(q)
      );
    });
  }, [discounts, search, statusFilter, typeFilter]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editingId
        ? api.patch(`/super-admin/plan-discounts/${editingId}`, body)
        : api.post('/super-admin/plan-discounts', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-discounts'] });
      toast.success(editingId ? 'Discount updated' : 'Discount created');
      resetForm();
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Failed to save discount');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/super-admin/plan-discounts/${id}`, { isActive }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plan-discounts'] });
      toast.success(variables.isActive ? 'Discount enabled' : 'Discount disabled');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/super-admin/plan-discounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-discounts'] });
      toast.success('Discount deleted');
    },
  });

  const handleEdit = (discount: PlanDiscount) => {
    setEditingId(discount._id);
    setForm({
      name: discount.name,
      code: discount.code,
      description: discount.description || '',
      promoType: discount.promoType || PlanDiscountPromoType.SIMPLE,
      discountType: discount.discountType,
      value: String(discount.value),
      planTypeId: typeof discount.planTypeId === 'string' ? discount.planTypeId : discount.planTypeId?._id || '',
      planId: typeof discount.planId === 'string' ? discount.planId : discount.planId?._id || '',
      billingCycle: discount.billingCycle || 'all',
      minOrderAmount: discount.minOrderAmount ? String(discount.minOrderAmount) : '',
      maxUses: discount.maxUses ? String(discount.maxUses) : '',
      startDate: discount.startDate ? discount.startDate.slice(0, 10) : '',
      endDate: discount.endDate ? discount.endDate.slice(0, 10) : '',
      isActive: discount.isActive,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      name: form.name.trim(),
      code: form.code.trim() || generateCode(),
      description: form.description.trim() || undefined,
      promoType: form.promoType,
      discountType: form.discountType,
      value: Number(form.value),
      planTypeId: form.planTypeId || undefined,
      planId: form.planId || undefined,
      billingCycle: form.billingCycle,
      minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : undefined,
      maxUses: form.maxUses ? Number(form.maxUses) : undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      isActive: form.isActive,
    });
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success('Promo code copied');
  };

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-4">
      <DiscountStatsBar stats={stats} />

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <Input
            placeholder="Search by name, code, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <select className={selectClass + ' sm:max-w-[180px]'} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="scheduled">Scheduled</option>
            <option value="expired">Expired</option>
            <option value="exhausted">Exhausted</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            className={selectClass + ' sm:max-w-[180px]'}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | PromoType)}
          >
            <option value="all">All types</option>
            <option value={PlanDiscountPromoType.SIMPLE}>Simple discount</option>
            <option value={PlanDiscountPromoType.BANNER}>Banner discount</option>
          </select>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>Add Discount</Button>
      </div>

      {showForm && (
        <Card>
          <h3 className="font-semibold mb-4">{editingId ? 'Edit Discount' : 'New Discount'}</h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Discount Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Promo Code</label>
                <div className="flex gap-2">
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="Auto-generated if empty"
                  />
                  <Button type="button" variant="outline" onClick={() => setForm({ ...form, code: generateCode() })}>
                    Generate
                  </Button>
                </div>
              </div>
              <Input
                label="Description"
                className="md:col-span-2"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                <select
                  className={selectClass}
                  value={form.promoType}
                  onChange={(e) => setForm({ ...form, promoType: e.target.value as PromoType })}
                >
                  <option value={PlanDiscountPromoType.SIMPLE}>Simple discount</option>
                  <option value={PlanDiscountPromoType.BANNER}>Banner discount</option>
                </select>
                <p className="mt-1.5 text-xs text-gray-500">
                  {form.promoType === PlanDiscountPromoType.BANNER
                    ? 'Shown as a promo banner on the public plans page.'
                    : 'Used as a checkout coupon — not shown as a plans-page banner.'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount type</label>
                <select className={selectClass} value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as DiscountType })}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (INR)</option>
                </select>
              </div>
              <Input
                label={form.discountType === 'percentage' ? 'Percentage Value' : 'Fixed Amount (INR)'}
                type="number"
                min="0"
                max={form.discountType === 'percentage' ? '100' : undefined}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Plan Type (optional)</label>
                <select
                  className={selectClass}
                  value={form.planTypeId}
                  onChange={(e) => setForm({ ...form, planTypeId: e.target.value, planId: '', billingCycle: 'all' })}
                >
                  <option value="">All plan types</option>
                  {(planTypes || []).map((pt) => (
                    <option key={pt._id} value={pt._id}>{pt.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Specific Plan (optional)</label>
                <select
                  className={selectClass}
                  value={form.planId}
                  onChange={(e) => setForm({ ...form, planId: e.target.value })}
                >
                  <option value="">Any plan</option>
                  {filteredPlans.map((plan) => (
                    <option key={plan._id} value={plan._id}>
                      {plan.name} ({plan.billingCycle})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Billing Cycle</label>
                <select className={selectClass} value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}>
                  {billingCycleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Minimum Order Amount (INR)"
                type="number"
                min="0"
                value={form.minOrderAmount}
                onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                placeholder="Optional"
              />
              <Input
                label="Max Uses"
                type="number"
                min="1"
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                placeholder="Unlimited if empty"
              />
              <Input label="Start Date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              <Input label="End Date" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>

            <div className="grid md:grid-cols-2 gap-4 rounded-xl border border-dashed border-primary/30 bg-primary-50/40 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Lifecycle preview</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={lifecycleBadgeVariant(formStatusPreview.lifecycle)}>
                    {formStatusPreview.label}
                  </Badge>
                  {formStatusPreview.redeemable && (
                    <span className="text-xs text-green-700 font-medium">Redeemable now</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-600">{formStatusPreview.description}</p>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <span className="font-medium text-gray-800">Starts:</span>{' '}
                  {form.startDate ? formatDiscountDate(form.startDate) : 'Immediately when enabled'}
                </p>
                <p>
                  <span className="font-medium text-gray-800">Ends:</span>{' '}
                  {form.endDate ? formatDiscountDate(form.endDate) : 'No end date'}
                </p>
                {formStatusPreview.lifecycle === 'scheduled' && formStatusPreview.startsAt && (
                  <p className="text-primary font-medium">
                    Goes live on {formatDiscountDate(formStatusPreview.startsAt)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <Switch checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} label="Discount enabled" />
              <div>
                <p className="text-sm font-medium text-gray-800">{form.isActive ? 'Enabled' : 'Disabled'}</p>
                <p className="text-xs text-gray-500">
                  {form.isActive
                    ? 'Admin toggle is on — lifecycle dates still control when it can be redeemed'
                    : 'Disabled codes cannot be redeemed regardless of schedule'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" loading={saveMutation.isPending}>
                {editingId ? 'Update Discount' : 'Save Discount'}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          {
            key: 'code',
            label: 'Code',
            render: (r) => {
              const discount = r as unknown as PlanDiscount;
              return (
                <div className="flex items-center gap-2">
                  <code className="text-sm font-semibold text-primary">{discount.code}</code>
                  <Button size="sm" variant="ghost" onClick={() => copyCode(discount.code)}>Copy</Button>
                </div>
              );
            },
          },
          {
            key: 'description',
            label: 'Description',
            render: (r) => <TruncateText text={(r as unknown as PlanDiscount).description} maxLength={30} />,
          },
          {
            key: 'promoType',
            label: 'Type',
            render: (r) => {
              const discount = r as unknown as PlanDiscount;
              return (
                <Badge variant={discount.promoType === PlanDiscountPromoType.BANNER ? 'info' : 'default'}>
                  {promoTypeLabel(discount.promoType)}
                </Badge>
              );
            },
          },
          {
            key: 'discountType',
            label: 'Offer',
            render: (r) => {
              const discount = r as unknown as PlanDiscount;
              return (
                <div>
                  <Badge>{discount.discountType}</Badge>
                  <p className="text-sm font-medium mt-1">{formatValue(discount)}</p>
                </div>
              );
            },
          },
          {
            key: 'scope',
            label: 'Applies To',
            render: (r) => {
              const discount = r as unknown as PlanDiscount;
              return (
                <div className="text-sm text-gray-700 space-y-0.5">
                  <p>{resolveRefName(discount.planTypeId as PlanTypeOption) || 'All plan types'}</p>
                  <p className="text-gray-500">{resolveRefName(discount.planId as PlanOption) || 'Any plan'}</p>
                  <p className="capitalize text-gray-500">{discount.billingCycle}</p>
                </div>
              );
            },
          },
          {
            key: 'validity',
            label: 'Schedule',
            render: (r) => {
              const discount = r as unknown as PlanDiscount;
              const status = getStatusSnapshot(discount);
              return (
                <div className="text-sm text-gray-700 space-y-1">
                  <p>
                    <span className="text-gray-500">From</span>{' '}
                    {discount.startDate ? formatDiscountDate(discount.startDate) : 'Now'}
                  </p>
                  <p>
                    <span className="text-gray-500">Until</span>{' '}
                    {discount.endDate ? formatDiscountDate(discount.endDate) : 'No end'}
                  </p>
                  {status.lifecycle === 'scheduled' && status.startsAt && (
                    <p className="text-xs font-medium text-primary">
                      Live on {formatDiscountDate(status.startsAt)}
                      {status.daysUntilStart != null ? ` (${status.daysUntilStart}d)` : ''}
                    </p>
                  )}
                  {status.lifecycle === 'active' && status.daysUntilEnd != null && status.daysUntilEnd <= 7 && (
                    <p className="text-xs font-medium text-amber-700">{status.description}</p>
                  )}
                </div>
              );
            },
          },
          {
            key: 'usage',
            label: 'Usage',
            render: (r) => {
              const discount = r as unknown as PlanDiscount;
              return (
                <span className="text-sm font-medium tabular-nums">
                  {discount.usedCount}{discount.maxUses != null ? ` / ${discount.maxUses}` : ' / ∞'}
                </span>
              );
            },
          },
          {
            key: 'enabled',
            label: 'Enabled',
            render: (r) => {
              const discount = r as unknown as PlanDiscount;
              return (
                <Switch
                  checked={discount.isActive}
                  disabled={toggleMutation.isPending}
                  onChange={(isActive) => toggleMutation.mutate({ id: discount._id, isActive })}
                  label={`Enable ${discount.name}`}
                />
              );
            },
          },
          {
            key: 'lifecycle',
            label: 'Lifecycle',
            render: (r) => <LifecycleStatusBadge discount={r as unknown as PlanDiscount} />,
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (r) => {
              const discount = r as unknown as PlanDiscount;
              return (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(discount)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => deleteMutation.mutate(discount._id)}>Delete</Button>
                </div>
              );
            },
          },
        ]}
        data={filteredDiscounts as unknown as Record<string, unknown>[]}
        keyField="_id"
      />
    </div>
  );
}
