import { useState, useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Crown,
  Lock,
  Sparkles,
} from 'lucide-react';
import { formatStatusLabel, subscriptionStatusBadge } from '@/lib/subscription-admin';
import { Badge } from '@/components/ui/Badge';

export type BillingCycle = 'monthly' | 'yearly' | 'lifetime';
export type ServiceMode = 'subscription' | 'lifetime';
export type CardCycle = 'monthly' | 'yearly';

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
  currency?: string;
  billingCycle: BillingCycle;
  tier?: string;
  description?: string;
  features?: string[];
  featureIds?: PlanFeature[];
  planTypeId?: PlanTypeRef | string;
}

interface PlanGroup {
  key: string;
  title: string;
  description: string;
  monthly?: CatalogPlan;
  yearly?: CatalogPlan;
  lifetime?: CatalogPlan;
}

function planFeatures(plan: CatalogPlan): string[] {
  if (plan.featureIds?.length) return plan.featureIds.map((f) => f.name);
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
        description: typeDesc || plan.description || 'Crafted for ambitious teams who demand excellence',
      });
    }

    const group = groups.get(typeId)!;
    if (plan.billingCycle === 'monthly') group.monthly = plan;
    if (plan.billingCycle === 'yearly') group.yearly = plan;
    if (plan.billingCycle === 'lifetime') group.lifetime = plan;
    if (plan.description && group.description === 'Crafted for ambitious teams who demand excellence') {
      group.description = plan.description;
    }
  }

  return Array.from(groups.values());
}

function priceSuffix(cycle: BillingCycle | CardCycle) {
  if (cycle === 'monthly') return '/mo';
  if (cycle === 'yearly') return '/yr';
  return '';
}

function PremiumToggle<T extends string>({
  options,
  value,
  onChange,
  compact,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'inline-flex shrink-0 rounded-full bg-gray-100 p-0.5',
        compact ? 'text-[11px]' : 'text-sm'
      )}
      role="tablist"
    >
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
              'rounded-full font-medium transition-all duration-200',
              compact ? 'px-3 py-1' : 'px-8 py-2.5 min-w-[128px]',
              active
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function PlanCard({
  group,
  serviceMode,
  cardCycle,
  onCycleChange,
  currentPlanId,
  featured,
  index,
  onChoosePlan,
  hasActivePlan,
}: {
  group: PlanGroup;
  serviceMode: ServiceMode;
  cardCycle: CardCycle;
  onCycleChange: (cycle: CardCycle) => void;
  currentPlanId?: string;
  featured?: boolean;
  index: number;
  onChoosePlan: (planId: string) => void;
  hasActivePlan?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const plan =
    serviceMode === 'lifetime'
      ? group.lifetime
      : cardCycle === 'monthly'
        ? group.monthly || group.yearly
        : group.yearly || group.monthly;

  if (!plan) return null;

  const features = planFeatures(plan);
  const visibleFeatures = expanded ? features : features.slice(0, 6);
  const isCurrent = currentPlanId === plan._id;
  const showCycleToggle = serviceMode === 'subscription' && group.monthly && group.yearly;
  const displayCycle = plan.billingCycle === 'lifetime' ? 'lifetime' : cardCycle;

  const yearlySavings =
    group.monthly && group.yearly && cardCycle === 'yearly'
      ? Math.max(0, group.monthly.price * 12 - group.yearly.price)
      : 0;

  const cardInner = (
    <div
      className={cn(
        'relative flex h-full flex-col rounded-2xl bg-white px-7 py-7 sm:px-8 sm:py-8',
        'border border-gray-200/90 shadow-[0_2px_16px_rgba(0,0,0,0.04)]',
        featured && 'border-primary/40 shadow-[0_4px_24px_rgba(255,119,0,0.08)]',
        isCurrent && 'border-emerald-300'
      )}
    >
      {(featured || showCycleToggle) && (
        <div className="flex min-h-[28px] items-center justify-between gap-3">
          {featured ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              <Crown className="h-3 w-3" />
              Most chosen
            </span>
          ) : (
            <span />
          )}
          {showCycleToggle && (
            <PremiumToggle
              compact
              value={cardCycle}
              onChange={onCycleChange}
              options={[
                { value: 'monthly', label: 'Month' },
                { value: 'yearly', label: 'Year' },
              ]}
            />
          )}
        </div>
      )}

      <div className={cn((featured || showCycleToggle) && 'mt-4')}>
        <h3 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">{group.title}</h3>
        {group.description && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-gray-500">{group.description}</p>
        )}
      </div>

      <div className="mt-6 border-t border-gray-100 pt-6">
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-semibold tracking-tight text-gray-900 tabular-nums">
            {formatCurrency(plan.price, plan.currency).replace(/\.00$/, '')}
          </span>
          {displayCycle !== 'lifetime' && (
            <span className="text-sm font-medium text-gray-500">{priceSuffix(displayCycle)}</span>
          )}
        </div>
        {plan.billingCycle === 'lifetime' && (
          <p className="mt-1.5 text-xs text-gray-400">One-time payment</p>
        )}
        {yearlySavings > 0 && (
          <p className="mt-2 text-sm font-medium text-emerald-600">
            Save {formatCurrency(yearlySavings, plan.currency)} annually
          </p>
        )}
      </div>

      <ul className="mt-5 space-y-2.5">
        {visibleFeatures.map((feature) => (
          <li key={feature} className="flex items-center gap-2.5 text-sm text-gray-700">
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-3 w-3 text-primary" strokeWidth={2.5} />
            </span>
            <span className="leading-snug">{feature}</span>
          </li>
        ))}
        {features.length === 0 && (
          <li className="text-sm text-gray-400">Full platform access included</li>
        )}
      </ul>

      {features.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-left text-xs font-medium text-primary hover:underline"
        >
          {expanded ? 'Show less' : `+${features.length - 6} more features`}
        </button>
      )}

      <button
        type="button"
        disabled={isCurrent}
        onClick={() => onChoosePlan(plan._id)}
        className={cn(
          'group mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-50',
          featured
            ? 'bg-primary text-white hover:bg-primary-600'
            : 'bg-gray-900 text-white hover:bg-gray-800'
        )}
      >
        {isCurrent ? (
          'Your active plan'
        ) : (
          <>
            {hasActivePlan ? 'Switch to this plan' : 'Choose plan'}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
    </div>
  );

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="relative h-full"
    >
      {featured ? (
        <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-primary/15 to-transparent" />
      ) : null}
      <div className="relative h-full">{cardInner}</div>
    </motion.article>
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
  /** Show “sandbox / instant activation” note (admin checkout only). */
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
  const [serviceMode, setServiceMode] = useState<ServiceMode>('subscription');
  const [cardCycles, setCardCycles] = useState<Record<string, CardCycle>>({});

  const needsPlan = !hasActivePlan;
  const planGroups = useMemo(() => groupPlans(plans), [plans]);

  const visibleGroups = useMemo(() => {
    if (serviceMode === 'lifetime') return planGroups.filter((g) => g.lifetime);
    return planGroups.filter((g) => g.monthly || g.yearly);
  }, [planGroups, serviceMode]);

  const featuredGroupKey = useMemo(() => {
    const withYearly = visibleGroups.find((g) => g.yearly);
    return withYearly?.key || visibleGroups[1]?.key || visibleGroups[0]?.key;
  }, [visibleGroups]);

  const getCardCycle = (key: string): CardCycle => cardCycles[key] || 'yearly';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader />
      </div>
    );
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-white text-gray-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[480px] w-[640px] -translate-x-1/2 rounded-full bg-primary/8 blur-[100px]" />
        <div className="absolute top-1/2 -right-24 h-72 w-72 rounded-full bg-amber-100/60 blur-[80px]" />
        <div className="absolute bottom-0 left-0 h-56 w-80 rounded-full bg-primary-50 blur-[60px]" />
      </div>

      <div className="relative z-10 px-5 pb-16 pt-10 sm:px-6 sm:pt-12">
        {topBar}
        <div className="mx-auto max-w-4xl">
          <motion.header
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            {!needsPlan && currentPlanName && currentPlanStatus && (
              <div className="mb-8 inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm text-gray-500">Current plan</span>
                <span className="text-sm font-semibold text-gray-900">{currentPlanName}</span>
                <span className="h-1 w-1 rounded-full bg-gray-300" />
                <Badge variant={subscriptionStatusBadge(currentPlanStatus)}>
                  {formatStatusLabel(currentPlanStatus)}
                </Badge>
                {currentPeriodEnd && currentBillingCycle !== 'lifetime' && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-gray-300" />
                    <span className="text-xs text-gray-500">Renews {formatDate(currentPeriodEnd)}</span>
                  </>
                )}
                <span className="h-1 w-1 rounded-full bg-gray-300" />
                <Link to="/admin/subscription/my-plan" className="text-xs font-medium text-primary hover:underline">
                  View my plan
                </Link>
              </div>
            )}

            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-primary">
              {hasActivePlan ? 'Upgrade' : 'Invogen Plans'}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              {hasActivePlan ? (
                <>
                  Change or upgrade
                  <span className="block text-primary">your plan</span>
                </>
              ) : (
                <>
                  Choose the right plan for
                  <span className="block text-primary">your business</span>
                </>
              )}
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-gray-500">
              {hasActivePlan
                ? 'Compare plans and switch anytime. Your new plan starts after checkout.'
                : 'Professional invoicing, GST compliance, and team tools.'}
            </p>

            <div className="mt-7 flex justify-center">
              <PremiumToggle
                value={serviceMode}
                onChange={setServiceMode}
                options={[
                  { value: 'subscription', label: 'Subscription' },
                  { value: 'lifetime', label: 'Lifetime' },
                ]}
              />
            </div>

            {showSandboxHint && (
              <p className="mt-6 text-[11px] uppercase tracking-widest text-gray-400">
                Sandbox · Instant activation
              </p>
            )}
          </motion.header>

          <div className="mt-12 sm:mt-14">
            {visibleGroups.length === 0 ? (
              <div className="rounded-3xl border border-gray-200 bg-gray-50 py-20 text-center">
                <p className="text-gray-500">No plans in this category yet.</p>
                <button
                  type="button"
                  onClick={() => setServiceMode(serviceMode === 'subscription' ? 'lifetime' : 'subscription')}
                  className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-600"
                >
                  View {serviceMode === 'subscription' ? 'Lifetime' : 'Subscription'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                className={cn(
                  'grid gap-6 lg:gap-8',
                  visibleGroups.length === 1 ? 'mx-auto max-w-[380px]' : 'mx-auto max-w-4xl md:grid-cols-2'
                )}
              >
                {visibleGroups.map((group, index) => (
                  <PlanCard
                    key={group.key}
                    index={index}
                    group={group}
                    serviceMode={serviceMode}
                    cardCycle={getCardCycle(group.key)}
                    featured={group.key === featuredGroupKey && visibleGroups.length > 1}
                    onCycleChange={(cycle) =>
                      setCardCycles((prev) => ({ ...prev, [group.key]: cycle }))
                    }
                    currentPlanId={currentPlanId}
                    hasActivePlan={hasActivePlan}
                    onChoosePlan={onChoosePlan}
                  />
                ))}
              </div>
            )}
          </div>

          <footer className="mt-12 flex flex-col items-center gap-5 border-t border-gray-100 pt-10">
            {razorpayEnabled && (
              <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-gray-400">
                <Lock className="h-3.5 w-3.5" />
                Encrypted · Razorpay Secure
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs text-gray-400">
              <span>GST-ready templates</span>
              <span>·</span>
              <span>Unlimited invoices</span>
              <span>·</span>
              <span>Priority support</span>
            </div>
            {!needsPlan && (
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                {onReturnDashboard && (
                  <button
                    type="button"
                    onClick={onReturnDashboard}
                    className="text-sm text-gray-500 transition-colors hover:text-gray-900"
                  >
                    Return to dashboard
                  </button>
                )}
                <Link
                  to="/admin/subscription/my-plan"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Back to my plan
                </Link>
              </div>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
