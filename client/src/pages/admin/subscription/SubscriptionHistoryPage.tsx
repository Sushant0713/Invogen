import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Loader } from '@/components/ui/Loader';
import {
  SubscriptionErrorState,
  SubscriptionPageHeader,
} from '@/components/subscription/SubscriptionPageShell';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  billingCycleLabel,
  formatStatusLabel,
  subscriptionStatusBadge,
} from '@/lib/subscription-admin';
import type { AdminSubscriptionRecord } from '@/hooks/useAdminSubscription';

export default function SubscriptionHistoryPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-subscription-history'],
    queryFn: async () => (await api.get('/admin/subscription/history')).data.data as AdminSubscriptionRecord[],
    staleTime: 0,
  });

  if (isLoading) return <Loader />;

  const activeCount = (data || []).filter((r) => r.status === 'active' || r.status === 'trial').length;

  return (
    <div className="space-y-6">
      <SubscriptionPageHeader
        title="Subscription History"
        description="Complete record of every subscription for your company."
      />

      {isError ? (
        <SubscriptionErrorState message="Could not load subscription history." onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Total records</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{data?.length ?? 0}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Active / trial</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{activeCount}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Cancelled</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {(data || []).filter((r) => r.status === 'cancelled').length}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Past due</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {(data || []).filter((r) => r.status === 'past_due').length}
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All subscriptions</CardTitle>
            </CardHeader>
            <DataTable
              columns={[
                {
                  key: 'plan',
                  label: 'Plan',
                  render: (r) => (r as AdminSubscriptionRecord).planId?.name || '—',
                },
                {
                  key: 'cycle',
                  label: 'Cycle',
                  render: (r) => billingCycleLabel((r as AdminSubscriptionRecord).planId?.billingCycle),
                },
                {
                  key: 'price',
                  label: 'Price',
                  render: (r) => {
                    const row = r as AdminSubscriptionRecord;
                    const plan = row.planId;
                    return plan?.price != null ? formatCurrency(plan.price, plan.currency) : '—';
                  },
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => {
                    const row = r as AdminSubscriptionRecord;
                    return (
                      <Badge variant={subscriptionStatusBadge(row.status)}>
                        {formatStatusLabel(row.status)}
                      </Badge>
                    );
                  },
                },
                {
                  key: 'period',
                  label: 'Period',
                  render: (r) => {
                    const row = r as AdminSubscriptionRecord;
                    if (!row.currentPeriodStart) return '—';
                    const end = row.currentPeriodEnd ? formatDate(row.currentPeriodEnd) : 'Ongoing';
                    return `${formatDate(row.currentPeriodStart)} → ${end}`;
                  },
                },
                {
                  key: 'cancelledAt',
                  label: 'Ended',
                  render: (r) => {
                    const row = r as AdminSubscriptionRecord;
                    return row.cancelledAt ? formatDate(row.cancelledAt) : '—';
                  },
                },
                {
                  key: 'createdAt',
                  label: 'Created',
                  render: (r) =>
                    (r as AdminSubscriptionRecord).createdAt
                      ? formatDate((r as AdminSubscriptionRecord).createdAt!)
                      : '—',
                },
              ]}
              data={(data || []) as unknown as Record<string, unknown>[]}
              keyField="_id"
            />
          </Card>
        </>
      )}
    </div>
  );
}
