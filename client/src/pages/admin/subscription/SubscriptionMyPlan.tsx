import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  CreditCard,
  History,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import {
  SubscriptionEmptyState,
  SubscriptionErrorState,
  SubscriptionPageHeader,
} from '@/components/subscription/SubscriptionPageShell';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  billingCycleLabel,
  formatStatusLabel,
  subscriptionStatusBadge,
} from '@/lib/subscription-admin';
import {
  planFeatures,
  useAdminSubscription,
  useBillingSummary,
  useSubscriptionStatus,
} from '@/hooks/useAdminSubscription';

export default function SubscriptionMyPlan() {
  const statusQuery = useSubscriptionStatus();
  const subscriptionQuery = useAdminSubscription();
  const billingQuery = useBillingSummary();

  const isLoading = statusQuery.isLoading || subscriptionQuery.isLoading || billingQuery.isLoading;
  const isError = statusQuery.isError || subscriptionQuery.isError || billingQuery.isError;

  if (isLoading) return <Loader />;

  if (isError) {
    return (
      <div className="space-y-6">
        <SubscriptionPageHeader title="My Plan" description="Your current subscription and billing overview." />
        <SubscriptionErrorState
          message="Could not load your subscription details."
          onRetry={() => {
            statusQuery.refetch();
            subscriptionQuery.refetch();
            billingQuery.refetch();
          }}
        />
      </div>
    );
  }

  const isActive = statusQuery.data?.active ?? false;
  const subscription = subscriptionQuery.data;
  const billing = billingQuery.data;
  const plan = subscription?.planId;
  const features = planFeatures(plan);

  if (!isActive || !subscription || !plan) {
    const lastStatus = subscription?.status;
    return (
      <div className="space-y-6">
        <SubscriptionPageHeader
          title="My Plan"
          description="Your subscription is not currently active."
        />
        {subscription && plan && lastStatus && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900">
                Previous plan: {plan.name} ({formatStatusLabel(lastStatus)})
              </p>
              {subscription.cancelledAt && (
                <p className="mt-1 text-sm text-amber-800">
                  Ended on {formatDate(subscription.cancelledAt)}
                </p>
              )}
              {subscription.currentPeriodEnd && lastStatus === 'past_due' && (
                <p className="mt-1 text-sm text-amber-800">
                  Period ended {formatDate(subscription.currentPeriodEnd)}
                </p>
              )}
            </div>
          </div>
        )}
        <SubscriptionEmptyState
          title="No active subscription"
          description="Choose a plan to access invoicing, GST tools, and your team workspace."
          actionLabel="Browse plans"
          actionTo="/admin/subscription/plans"
        />
      </div>
    );
  }

  const daysUntilRenewal =
    subscription.currentPeriodEnd && plan.billingCycle !== 'lifetime'
      ? Math.max(
          0,
          Math.ceil(
            (new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
        )
      : null;

  return (
    <div className="space-y-6">
      <SubscriptionPageHeader
        title="My Plan"
        description="Your current subscription and billing overview."
        action={
          <Link
            to="/admin/subscription/plans"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Change plan
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                {plan.planTypeId?.name || 'Current plan'}
              </p>
              <h2 className="mt-1 text-xl font-bold text-gray-900">{plan.name}</h2>
              {plan.description && <p className="mt-1.5 text-sm text-gray-500">{plan.description}</p>}
            </div>
            <Badge variant={subscriptionStatusBadge(subscription.status)}>
              {formatStatusLabel(subscription.status)}
            </Badge>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Price</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {formatCurrency(plan.price || 0, plan.currency)}
                {plan.billingCycle === 'monthly' && (
                  <span className="text-sm font-normal text-gray-500"> /mo</span>
                )}
                {plan.billingCycle === 'yearly' && (
                  <span className="text-sm font-normal text-gray-500"> /yr</span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{billingCycleLabel(plan.billingCycle)}</p>
            </div>

            {subscription.currentPeriodStart && (
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-400">
                  <Calendar className="h-3.5 w-3.5" />
                  Started
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {formatDate(subscription.currentPeriodStart)}
                </p>
              </div>
            )}

            {subscription.currentPeriodEnd && plan.billingCycle !== 'lifetime' && (
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-400">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Renewal
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {formatDate(subscription.currentPeriodEnd)}
                </p>
                {daysUntilRenewal != null && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {daysUntilRenewal === 0 ? 'Renews today' : `${daysUntilRenewal} days remaining`}
                  </p>
                )}
              </div>
            )}

            {plan.billingCycle === 'lifetime' && (
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">Access</p>
                <p className="mt-1 text-lg font-semibold text-emerald-900">Lifetime</p>
                <p className="mt-0.5 text-xs text-emerald-700">No recurring renewal</p>
              </div>
            )}
          </div>

          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Included features</p>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {features.length > 0 ? (
                features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-sm text-gray-700">
                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Check className="h-3 w-3 text-primary" strokeWidth={2.5} />
                    </span>
                    {feature}
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-400">Full platform access</li>
              )}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Lifetime spend</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatCurrency(billing?.totalSpent || 0)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {billing?.paymentCount || 0} successful payment{billing?.paymentCount === 1 ? '' : 's'}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Quick links</p>
            <div className="space-y-1">
              {[
                { to: '/admin/subscription/payments', icon: CreditCard, label: 'Payment history' },
                { to: '/admin/subscription/history', icon: History, label: 'Subscription history' },
                { to: '/admin/subscription/billing', icon: Sparkles, label: 'Billing summary' },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-2 rounded-lg px-2 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-primary"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
