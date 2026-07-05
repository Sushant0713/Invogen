import { Link } from 'react-router-dom';
import { ArrowRight, CreditCard, Receipt, RefreshCw, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/dashboard/StatCard';
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
  paymentStatusBadge,
  subscriptionStatusBadge,
} from '@/lib/subscription-admin';
import { useBillingSummary } from '@/hooks/useAdminSubscription';

export default function SubscriptionBillingPage() {
  const { data, isLoading, isError, refetch } = useBillingSummary();

  if (isLoading) return <Loader />;

  if (isError) {
    return (
      <div className="space-y-6">
        <SubscriptionPageHeader
          title="Billing Summary"
          description="Overview of your subscription spending and billing status."
        />
        <SubscriptionErrorState message="Could not load billing summary." onRetry={() => refetch()} />
      </div>
    );
  }

  const plan = data?.subscription?.planId;
  const isActive = data?.active ?? false;

  return (
    <div className="space-y-6">
      <SubscriptionPageHeader
        title="Billing Summary"
        description="Overview of your subscription spending and billing status."
        action={
          <Link
            to="/admin/subscription/payments"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Full payment history
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total spent" value={formatCurrency(data?.totalSpent || 0)} icon={Wallet} compact />
        <StatCard title="Payments" value={data?.paymentCount || 0} icon={CreditCard} compact />
        <StatCard title="Current plan" value={plan?.name || '—'} icon={Receipt} compact />
        <StatCard
          title="Status"
          value={isActive ? 'Active' : 'Inactive'}
          icon={RefreshCw}
          compact
        />
      </div>

      {isActive && data?.subscription && plan ? (
        <Card>
          <CardHeader>
            <CardTitle>Active subscription</CardTitle>
          </CardHeader>
          <div className="px-6 pb-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-lg font-semibold text-gray-900">{plan.name}</span>
              <Badge variant={subscriptionStatusBadge(data.subscription.status)}>
                {formatStatusLabel(data.subscription.status)}
              </Badge>
              <span className="text-sm text-gray-500">{billingCycleLabel(plan.billingCycle)}</span>
              <span className="text-sm font-medium text-gray-900">
                {formatCurrency(plan.price || 0, plan.currency)}
                {plan.billingCycle === 'monthly' && ' /mo'}
                {plan.billingCycle === 'yearly' && ' /yr'}
              </span>
            </div>
            {data.subscription.currentPeriodEnd && plan.billingCycle !== 'lifetime' && (
              <p className="mt-2 text-sm text-gray-500">
                Next renewal on {formatDate(data.subscription.currentPeriodEnd)}
              </p>
            )}
            <Link
              to="/admin/subscription/my-plan"
              className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
            >
              View plan details
            </Link>
          </div>
        </Card>
      ) : (
        <SubscriptionEmptyState
          title="No active billing"
          description="Subscribe to a plan to start tracking billing and payments here."
          actionLabel="Browse plans"
          actionTo="/admin/subscription/plans"
        />
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent payments</CardTitle>
          <Link
            to="/admin/subscription/payments"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <div className="divide-y divide-gray-100 px-6 pb-4">
          {(data?.recentPayments || []).length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No payments recorded yet.</p>
          ) : (
            data!.recentPayments!.map((payment) => (
              <div key={payment._id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {formatCurrency(payment.amount, payment.currency)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {payment.createdAt ? formatDate(payment.createdAt) : '—'}
                    {payment.metadata?.discountCode && (
                      <span className="ml-2 text-primary">· {payment.metadata.discountCode}</span>
                    )}
                  </p>
                </div>
                <Badge variant={paymentStatusBadge(payment.status)}>
                  {formatStatusLabel(payment.status)}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
