import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';
import api from '@/api/client';
import {
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  Clock,
  Crown,
  Gift,
  Lock,
  Sparkles,
  Store,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { formatStatusLabel, subscriptionStatusBadge } from '@/lib/subscription-admin';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';

export type BillingCycle = 'monthly' | 'yearly';
export type CardCycle = 'monthly' | 'yearly';
export type BillingView = BillingCycle;

export interface PlanFeature {
  _id: string;
  name: string;
}

export interface PlanTypeRef {
  _id: string;
  name: string;
  description?: string;
}

export interface CatalogPlan {
  _id: string;
  name: string;
  price: number;
  /** List price — shown struck through when higher than selling price. */
  mrp?: number;
  currency?: string;
  billingCycle: BillingCycle;
  tier?: string;
  description?: string;
  features?: string[];
  featureIds?: PlanFeature[];
  planTypeId?: PlanTypeRef | string;
  maxUsers?: number | null;
  maxInvoices?: number | null;
  maxProducts?: number | null;
  templateIds?: string[];
  canAddTemplate?: boolean | null;
  templateAccessConfigured?: boolean | null;
}

export interface PlanBannerDiscount {
  _id: string;
  name: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  value: number;
  planTypeId?: string;
  planId?: string;
  billingCycle?: string;
  endDate?: string;
  statusSnapshot?: {
    lifecycle: string;
    label: string;
    description: string;
  };
}

interface PlanGroup {
  key: string;
  title: string;
  description: string;
  monthly?: CatalogPlan;
  yearly?: CatalogPlan;
}

const PLAN_ICONS = [Building2, Crown, Users] as const;

function planTypeIdOf(plan: CatalogPlan): string | undefined {
  const type = plan.planTypeId;
  if (!type) return undefined;
  return typeof type === 'object' ? type._id : type;
}

function formatLimit(value?: number | null): string {
  if (value === undefined || value === null) return 'Unlimited';
  return String(value);
}

function planCanAddTemplate(plan: CatalogPlan): boolean {
  const configured =
    plan.templateAccessConfigured === true || typeof plan.canAddTemplate === 'boolean';
  return configured ? plan.canAddTemplate === true : true;
}

function defaultTemplateCount(plan: CatalogPlan): number {
  return Array.isArray(plan.templateIds) ? plan.templateIds.length : 0;
}

type PlanLimitRow = { key: string; label: string; value: string };

function planLimitRows(plan: CatalogPlan): PlanLimitRow[] {
  return [
    { key: 'invoices', label: 'Invoices', value: formatLimit(plan.maxInvoices) },
    { key: 'products', label: 'Products', value: formatLimit(plan.maxProducts) },
    { key: 'users', label: 'Users', value: formatLimit(plan.maxUsers) },
    {
      key: 'templates',
      label: 'Default templates',
      value: String(defaultTemplateCount(plan)),
    },
    {
      key: 'addTemplate',
      label: 'Add template',
      value: planCanAddTemplate(plan) ? 'Yes' : 'No',
    },
  ];
}

function planFeatures(plan: CatalogPlan): string[] {
  if (plan.featureIds?.length) return plan.featureIds.map((f) => f.name).filter(Boolean);
  return plan.features || [];
}

function groupPlans(plans: CatalogPlan[]): PlanGroup[] {
  const groups = new Map<string, PlanGroup>();

  for (const plan of plans) {
    const type = plan.planTypeId;
    const typeId =
      typeof type === 'object' && type?._id ? type._id : typeof type === 'string' ? type : plan.tier || plan._id;
    const typeName = typeof type === 'object' && type?.name ? type.name : undefined;
    const typeDesc = typeof type === 'object' && type?.description ? type.description : undefined;

    if (!groups.has(typeId)) {
      groups.set(typeId, {
        key: typeId,
        title: typeName || plan.name,
        description: typeDesc || 'Built for growing teams that need reliable GST billing.',
      });
    }

    const group = groups.get(typeId)!;
    if (plan.billingCycle === 'monthly') group.monthly = plan;
    if (plan.billingCycle === 'yearly') group.yearly = plan;
    if (plan.description) group.description = plan.description;
  }

  return Array.from(groups.values());
}

function getPlanForGroup(group: PlanGroup, billingView: BillingView): CatalogPlan | undefined {
  if (billingView === 'monthly') return group.monthly;
  return group.yearly;
}

function bannerAppliesToPlans(banner: PlanBannerDiscount, plans: CatalogPlan[]): boolean {
  if (!banner.planId && !banner.planTypeId && (!banner.billingCycle || banner.billingCycle === 'all')) {
    return true;
  }
  return plans.some((plan) => {
    if (banner.planId && banner.planId !== plan._id) return false;
    const typeId = planTypeIdOf(plan);
    if (banner.planTypeId && banner.planTypeId !== typeId) return false;
    if (banner.billingCycle && banner.billingCycle !== 'all' && banner.billingCycle !== plan.billingCycle) {
      return false;
    }
    return true;
  });
}

function formatBannerValue(banner: PlanBannerDiscount) {
  return banner.discountType === 'percentage'
    ? `${banner.value}% OFF`
    : `${formatCurrency(banner.value)} OFF`;
}

function priceSuffix(cycle: BillingView) {
  if (cycle === 'monthly') return '/mo';
  return '/yr';
}

/** Yearly savings vs paying monthly for 12 months: (monthly×12 − yearly) / (monthly×12). */
function calcYearlySavings(group: PlanGroup) {
  if (!group.monthly || !group.yearly) return 0;
  return Math.max(0, group.monthly.price * 12 - group.yearly.price);
}

function calcYearlySavingsPercent(group: PlanGroup) {
  if (!group.monthly || !group.yearly) return 0;
  const billedMonthlyForYear = group.monthly.price * 12;
  if (billedMonthlyForYear <= 0) return 0;
  const savings = billedMonthlyForYear - group.yearly.price;
  if (savings <= 0) return 0;
  return Math.round((savings / billedMonthlyForYear) * 100);
}

function useCountdown(targetIso?: string) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!targetIso) {
      setRemaining('');
      return;
    }

    const tick = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('00:00:00');
        return;
      }
      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1000);
      setRemaining(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [targetIso]);

  return remaining;
}

function BillingToggle({
  value,
  onChange,
  yearlySavePercent,
}: {
  value: BillingView;
  onChange: (v: BillingView) => void;
  yearlySavePercent: number;
}) {
  const options: { value: BillingView; label: string; badge?: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly', badge: yearlySavePercent > 0 ? `Save ${yearlySavePercent}%` : undefined },
  ];

  return (
    <div className="inline-flex rounded-full border border-gray-200 bg-gray-100 p-1 shadow-inner" role="tablist">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative rounded-full px-5 py-2.5 text-sm font-semibold transition-all sm:px-8',
              active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <span>{opt.label}</span>
            {opt.badge ? (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                {opt.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function CouponBanner({ banner }: { banner: PlanBannerDiscount }) {
  const countdown = useCountdown(banner.endDate);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(banner.code);
      toast.success('Coupon code copied');
    } catch {
      toast.error('Could not copy code');
    }
  };

  return (
    <div className="rounded-2xl border-2 border-dashed border-primary/35 bg-gradient-to-r from-primary-50/80 via-white to-orange-50/80 px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Gift className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              {formatBannerValue(banner)} — Limited time
            </p>
            <p className="mt-1 text-base font-semibold text-gray-900">{banner.name}</p>
            <p className="mt-0.5 text-sm text-gray-600">
              {banner.description || 'Use this code at checkout to unlock your discount.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
            <code className="text-sm font-bold tracking-widest text-gray-900">{banner.code}</code>
            <button
              type="button"
              onClick={() => void copyCode()}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-600"
            >
              Copy Code
            </button>
          </div>
          {countdown ? (
            <div className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-white">
              <Clock className="h-4 w-4 text-primary-300" />
              <span className="font-mono text-sm font-semibold tabular-nums">{countdown}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  group,
  plan,
  billingView,
  featured,
  index,
  currentPlanId,
  hasActivePlan,
  onChoosePlan,
}: {
  group: PlanGroup;
  plan: CatalogPlan;
  billingView: BillingView;
  featured?: boolean;
  index: number;
  currentPlanId?: string;
  hasActivePlan?: boolean;
  onChoosePlan: (planId: string) => void;
}) {
  const Icon = PLAN_ICONS[index % PLAN_ICONS.length];
  const limits = planLimitRows(plan);
  const isCurrent = currentPlanId === plan._id;
  const savings = billingView === 'yearly' ? calcYearlySavings(group) : 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08 }}
      className={cn('relative h-full', featured && 'md:-mt-2 md:mb-2')}
    >
      {featured ? (
        <div className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white shadow-lg shadow-primary/25">
            <Crown className="h-3.5 w-3.5" />
            Most Popular
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          'flex h-full flex-col rounded-2xl border bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.06)] sm:p-7',
          featured ? 'border-primary ring-2 ring-primary/15' : 'border-gray-200'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          {savings > 0 ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Save {formatCurrency(savings, plan.currency)}
            </span>
          ) : null}
        </div>

        <h3 className="mt-5 text-xl font-bold text-gray-900">{group.title}</h3>
        <p className="mt-1.5 min-h-[40px] text-sm leading-relaxed text-gray-500">{group.description}</p>

        <div className="mt-6 border-t border-gray-100 pt-6">
          <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1">
            {plan.mrp != null && plan.mrp > plan.price ? (
              <span className="pb-1 text-lg font-medium tabular-nums text-gray-400 line-through decoration-gray-400">
                {formatCurrency(plan.mrp, plan.currency).replace(/\.00$/, '')}
              </span>
            ) : null}
            <span className="text-4xl font-bold tracking-tight text-gray-900 tabular-nums">
              {formatCurrency(plan.price, plan.currency).replace(/\.00$/, '')}
            </span>
            <span className="pb-1 text-sm font-medium text-gray-500">{priceSuffix(billingView)}</span>
          </div>
        </div>

        <ul className="mt-6 flex-1 space-y-3">
          {limits.map((row) => (
            <li key={row.key} className="flex items-start gap-2.5 text-sm text-gray-700">
              <span
                className={cn(
                  'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full',
                  featured ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'
                )}
              >
                <Check className="h-3 w-3" strokeWidth={2.5} />
              </span>
              <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                <span>{row.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-gray-900">{row.value}</span>
              </span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          disabled={isCurrent}
          onClick={() => onChoosePlan(plan._id)}
          className={cn(
            'group mt-7 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-50',
            featured
              ? 'bg-primary text-white hover:bg-primary-600'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          )}
        >
          {isCurrent ? 'Your active plan' : hasActivePlan ? 'Switch to this plan' : 'Choose plan'}
          {!isCurrent ? (
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          ) : null}
        </button>
      </div>
    </motion.article>
  );
}

function FeatureComparisonTable({
  groups,
  billingView,
}: {
  groups: PlanGroup[];
  billingView: BillingView;
}) {
  const columns = useMemo(
    () =>
      groups
        .map((group) => ({
          key: group.key,
          title: group.title,
          plan: getPlanForGroup(group, billingView),
        }))
        .filter((col) => col.plan),
    [groups, billingView]
  );

  const limitRows = useMemo(() => {
    const sample = columns.find((col) => col.plan)?.plan;
    return sample ? planLimitRows(sample).map((row) => ({ key: row.key, label: row.label })) : [];
  }, [columns]);

  const featureRows = useMemo(() => {
    const set = new Set<string>();
    for (const col of columns) {
      if (col.plan) planFeatures(col.plan).forEach((f) => set.add(f));
    }
    return Array.from(set);
  }, [columns]);

  if (columns.length < 2) return null;

  return (
    <section className="mt-16">
      <h2 className="text-center text-2xl font-bold text-gray-900">Compare plans</h2>
      <p className="mx-auto mt-2 max-w-xl text-center text-sm text-gray-500">
        Limits, templates, and features for each plan at a glance.
      </p>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80">
              <th className="px-5 py-4 font-semibold text-gray-500">Feature</th>
              {columns.map((col, index) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-5 py-4 text-center font-semibold text-gray-900',
                    index === 1 && 'bg-primary/5 text-primary'
                  )}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {limitRows.map((row) => (
              <tr key={row.key}>
                <td className="px-5 py-3.5 font-medium text-gray-700">{row.label}</td>
                {columns.map((col, index) => {
                  const value = col.plan
                    ? planLimitRows(col.plan).find((r) => r.key === row.key)?.value ?? '—'
                    : '—';
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        'px-5 py-3.5 text-center font-semibold tabular-nums text-gray-900',
                        index === 1 && 'bg-primary/[0.03]'
                      )}
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
            {featureRows.map((feature) => (
              <tr key={feature}>
                <td className="px-5 py-3.5 font-medium text-gray-700">{feature}</td>
                {columns.map((col, index) => {
                  const included = col.plan ? planFeatures(col.plan).includes(feature) : false;
                  return (
                    <td
                      key={col.key}
                      className={cn('px-5 py-3.5 text-center', index === 1 && 'bg-primary/[0.03]')}
                    >
                      {included ? (
                        <Check className="mx-auto h-4 w-4 text-emerald-600" />
                      ) : (
                        <X className="mx-auto h-4 w-4 text-red-500" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TrustedByBar() {
  const items = [
    { icon: Users, label: 'CA Firms' },
    { icon: Wrench, label: 'Manufacturers' },
    { icon: Store, label: 'Retail Stores' },
    { icon: Building2, label: 'Service Providers' },
    { icon: Sparkles, label: 'Freelancers' },
  ];

  return (
    <section className="mt-16 border-y border-gray-100 py-10">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-gray-400">
        Trusted by businesses across India
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <item.icon className="h-4 w-4 text-primary/70" />
            {item.label}
          </div>
        ))}
      </div>
    </section>
  );
}

export interface PlanCatalogProps {
  plans: CatalogPlan[];
  loading?: boolean;
  currentPlanId?: string;
  hasActivePlan?: boolean;
  currentPlanName?: string;
  currentPlanStatus?: string;
  currentPeriodEnd?: string;
  currentBillingCycle?: BillingCycle;
  razorpayEnabled?: boolean;
  showSandboxHint?: boolean;
  onChoosePlan: (planId: string) => void;
  onReturnDashboard?: () => void;
  topBar?: ReactNode;
}

export function PlanCatalog({
  plans,
  loading,
  currentPlanId,
  hasActivePlan = false,
  currentPlanName,
  currentPlanStatus,
  currentPeriodEnd,
  currentBillingCycle,
  razorpayEnabled = false,
  showSandboxHint = false,
  onChoosePlan,
  onReturnDashboard,
  topBar,
}: PlanCatalogProps) {
  const [billingView, setBillingView] = useState<BillingView>('yearly');

  const { data: bannerDiscounts = [] } = useQuery({
    queryKey: ['public-plan-banners'],
    queryFn: async () =>
      (await api.get('/public/plan-banners')).data.data as PlanBannerDiscount[],
    staleTime: 60_000,
  });

  const planGroups = useMemo(() => groupPlans(plans), [plans]);

  const featuredGroupKey = useMemo(() => {
    const withBoth = planGroups.filter((g) => g.monthly && g.yearly);
    if (withBoth.length === 1) return withBoth[0]?.key;
    return withBoth[1]?.key || withBoth[0]?.key || planGroups[0]?.key;
  }, [planGroups]);

  /** Auto save % on Yearly tab: monthly price × 12 vs yearly price. */
  const yearlySavePercent = useMemo(() => {
    const withBoth = planGroups.filter((g) => g.monthly && g.yearly);
    if (!withBoth.length) return 0;

    const featured = withBoth.find((g) => g.key === featuredGroupKey);
    if (featured) {
      const pct = calcYearlySavingsPercent(featured);
      if (pct > 0) return pct;
    }

    const percents = withBoth.map(calcYearlySavingsPercent).filter((n) => n > 0);
    return percents.length ? Math.max(...percents) : 0;
  }, [planGroups, featuredGroupKey]);

  const visibleGroups = useMemo(
    () => planGroups.filter((group) => getPlanForGroup(group, billingView)),
    [planGroups, billingView]
  );

  const visiblePlans = useMemo(
    () =>
      visibleGroups
        .map((group) => getPlanForGroup(group, billingView))
        .filter((plan): plan is CatalogPlan => Boolean(plan)),
    [visibleGroups, billingView]
  );

  const visibleBanners = useMemo(
    () => bannerDiscounts.filter((banner) => bannerAppliesToPlans(banner, visiblePlans)),
    [bannerDiscounts, visiblePlans]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-[#fafafa] text-gray-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/8 blur-[100px]" />
      </div>

      <div className="relative z-10 px-5 pb-16 pt-8 sm:px-6 sm:pt-10">
        {topBar}

        <div className="mx-auto max-w-6xl">
          <motion.header
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            {hasActivePlan && currentPlanName && currentPlanStatus ? (
              <div className="mb-8 inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm text-gray-500">Current plan</span>
                <span className="text-sm font-semibold text-gray-900">{currentPlanName}</span>
                <Badge variant={subscriptionStatusBadge(currentPlanStatus)}>
                  {formatStatusLabel(currentPlanStatus)}
                </Badge>
                {currentPeriodEnd ? (
                  <span className="text-xs text-gray-500">Renews {formatDate(currentPeriodEnd)}</span>
                ) : null}
                <Link to="/admin/subscription/my-plan" className="text-xs font-medium text-primary hover:underline">
                  View my plan
                </Link>
              </div>
            ) : null}

            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl sm:leading-tight">
              {hasActivePlan ? (
                <>
                  Change or upgrade
                  <span className="block text-primary">your plan</span>
                </>
              ) : (
                <>
                  Professional GST Billing for
                  <span className="block text-primary">Modern Businesses</span>
                </>
              )}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-gray-500 sm:text-base">
              {hasActivePlan
                ? 'Compare plans and switch anytime. Your new plan starts after checkout.'
                : 'Simple plans for small businesses, growing companies, and enterprises. GST-compliant invoicing with no hidden fees.'}
            </p>

            <div className="mt-8 flex justify-center">
              <BillingToggle
                value={billingView}
                onChange={setBillingView}
                yearlySavePercent={yearlySavePercent}
              />
            </div>

            <p className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-400 sm:text-sm">
              <span>GST-ready templates</span>
              <span className="hidden sm:inline">·</span>
              <span>Unlimited invoices</span>
              <span className="hidden sm:inline">·</span>
              <span>Multi-user access</span>
              <span className="hidden sm:inline">·</span>
              <span>Secure &amp; reliable</span>
            </p>

            {showSandboxHint ? (
              <p className="mt-4 text-[11px] uppercase tracking-widest text-gray-400">
                Sandbox · Instant activation
              </p>
            ) : null}
          </motion.header>

          {visibleBanners.length > 0 ? (
            <div className="mx-auto mt-10 max-w-4xl space-y-3">
              {visibleBanners.map((banner) => (
                <CouponBanner key={banner._id} banner={banner} />
              ))}
            </div>
          ) : null}

          <div className="mt-12">
            {visibleGroups.length === 0 ? (
              <div className="rounded-3xl border border-gray-200 bg-white py-20 text-center">
                <p className="text-gray-500">No plans available for this billing cycle yet.</p>
                <button
                  type="button"
                  onClick={() => setBillingView(billingView === 'monthly' ? 'yearly' : 'monthly')}
                  className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-600"
                >
                  View other billing options
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                className={cn(
                  'grid gap-6',
                  visibleGroups.length === 1
                    ? 'mx-auto max-w-md'
                    : visibleGroups.length === 2
                      ? 'mx-auto max-w-4xl md:grid-cols-2'
                      : 'md:grid-cols-3'
                )}
              >
                {visibleGroups.map((group, index) => {
                  const plan = getPlanForGroup(group, billingView);
                  if (!plan) return null;
                  return (
                    <PlanCard
                      key={group.key}
                      group={group}
                      plan={plan}
                      billingView={billingView}
                      index={index}
                      featured={group.key === featuredGroupKey && visibleGroups.length > 1}
                      currentPlanId={currentPlanId}
                      hasActivePlan={hasActivePlan}
                      onChoosePlan={onChoosePlan}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <FeatureComparisonTable groups={planGroups} billingView={billingView} />
          <TrustedByBar />

          <footer className="mt-12 flex flex-col items-center gap-4 text-center">
            {razorpayEnabled ? (
              <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-400">
                <Lock className="h-3.5 w-3.5" />
                Encrypted · Razorpay Secure
              </p>
            ) : null}
            <p className="text-xs text-gray-400">
              Your data is safe. We never share your information with third parties.
            </p>
            <div className="flex flex-wrap justify-center gap-3 text-[11px] font-medium uppercase tracking-wide text-gray-400">
              <span>UPI</span>
              <span>·</span>
              <span>Visa</span>
              <span>·</span>
              <span>Mastercard</span>
              <span>·</span>
              <span>Net Banking</span>
              <span>·</span>
              <span className="text-primary">Secured by Razorpay</span>
            </div>
            {hasActivePlan ? (
              <div className="mt-4 flex flex-wrap justify-center gap-4">
                {onReturnDashboard ? (
                  <button
                    type="button"
                    onClick={onReturnDashboard}
                    className="text-sm text-gray-500 transition-colors hover:text-gray-900"
                  >
                    Return to dashboard
                  </button>
                ) : null}
                <Link to="/admin/subscription/my-plan" className="text-sm font-medium text-primary hover:underline">
                  Back to my plan
                </Link>
              </div>
            ) : null}
          </footer>
        </div>
      </div>
    </div>
  );
}
