import { useMemo } from 'react';
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
import { formatStatusLabel, paymentStatusBadge } from '@/lib/subscription-admin';
import type { PaymentRecord } from '@/hooks/useAdminSubscription';

export default function SubscriptionPaymentsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-subscription-payments'],
    queryFn: async () => (await api.get('/admin/subscription/payments')).data.data as PaymentRecord[],
    staleTime: 0,
  });

  const stats = useMemo(() => {
    const rows = data || [];
    const captured = rows.filter((p) => p.status === 'captured');
    const pending = rows.filter((p) => p.status === 'pending');
    const failed = rows.filter((p) => p.status === 'failed' || p.status === 'refunded');
    return {
      totalCaptured: captured.reduce((sum, p) => sum + p.amount, 0),
      capturedCount: captured.length,
      pendingCount: pending.length,
      failedCount: failed.length,
    };
  }, [data]);

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-6">
      <SubscriptionPageHeader
        title="Payment History"
        description="Every subscription payment, including GST and coupon details."
      />

      {isError ? (
        <SubscriptionErrorState message="Could not load payment history." onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Total paid</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{formatCurrency(stats.totalCaptured)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Successful</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.capturedCount}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Pending</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">{stats.pendingCount}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Failed / refunded</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{stats.failedCount}</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{data?.length ?? 0} transactions</CardTitle>
            </CardHeader>
            <DataTable
              columns={[
                {
                  key: 'createdAt',
                  label: 'Date',
                  render: (r) =>
                    (r as PaymentRecord).createdAt ? formatDate((r as PaymentRecord).createdAt!) : '—',
                },
                {
                  key: 'amount',
                  label: 'Amount',
                  render: (r) => formatCurrency((r as PaymentRecord).amount, (r as PaymentRecord).currency),
                },
                {
                  key: 'gst',
                  label: 'GST',
                  render: (r) => {
                    const gst = (r as PaymentRecord).metadata?.totalGst;
                    return gst != null ? formatCurrency(gst) : '—';
                  },
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => {
                    const row = r as PaymentRecord;
                    return (
                      <Badge variant={paymentStatusBadge(row.status)}>
                        {formatStatusLabel(row.status)}
                      </Badge>
                    );
                  },
                },
                {
                  key: 'orderId',
                  label: 'Order ID',
                  render: (r) => (
                    <span className="font-mono text-xs text-gray-600">
                      {(r as PaymentRecord).razorpayOrderId || '—'}
                    </span>
                  ),
                },
                {
                  key: 'coupon',
                  label: 'Coupon',
                  render: (r) => (r as PaymentRecord).metadata?.discountCode || '—',
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
