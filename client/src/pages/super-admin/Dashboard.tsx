import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, CreditCard, DollarSign, FileText } from 'lucide-react';
import api from '@/api/client';
import { StatCard } from '@/components/dashboard/StatCard';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCompactCurrency, formatCurrency, formatDate, cn } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';
import { ActivityListItem } from '@/components/dashboard/ActivityListItem';
import type { ActivityUserRef } from '@/lib/activity';

type DailyRevenueBucket = {
  date: string;
  total: number;
  count: number;
  sentInvoiceCount?: number;
  paidInvoiceCount?: number;
};

type InvoiceCountMode = 'sent' | 'paid';

type RecentPayment = {
  _id: string;
  amount: number;
  createdAt: string;
  companyId?: { name?: string } | string;
};

function parseLocalDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

function formatDayAxisLabel(date: string): string {
  return parseLocalDate(date).toLocaleDateString('en-IN', { weekday: 'short' });
}

function formatDayTooltipLabel(date: string): string {
  return parseLocalDate(date).toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatCurrentWeekSubtitle(dailyRevenue: DailyRevenueBucket[]): string {
  if (dailyRevenue.length === 0) return 'This week';
  const start = parseLocalDate(dailyRevenue[0].date);
  const end = parseLocalDate(dailyRevenue[dailyRevenue.length - 1].date);
  const startLabel = start.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  return `This week · ${startLabel} – ${endLabel}`;
}

function buildWeeklyChartData(
  dailyRevenue: DailyRevenueBucket[],
  invoiceMode: InvoiceCountMode
) {
  return dailyRevenue.map((day) => ({
    name: formatDayAxisLabel(day.date),
    value: day.total,
    label: formatDayTooltipLabel(day.date),
    count:
      invoiceMode === 'sent'
        ? (day.sentInvoiceCount ?? 0)
        : (day.paidInvoiceCount ?? 0),
  }));
}

function getCompanyName(companyId: RecentPayment['companyId']): string {
  if (!companyId) return 'Unknown company';
  if (typeof companyId === 'string') return companyId;
  return companyId.name || 'Unknown company';
}

function InvoiceCountToggle({
  value,
  onChange,
}: {
  value: InvoiceCountMode;
  onChange: (next: InvoiceCountMode) => void;
}) {
  return (
    <div
      className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1"
      role="group"
      aria-label="Invoice count filter"
    >
      {([
        { id: 'sent', label: 'Sent invoices' },
        { id: 'paid', label: 'Paid invoices' },
      ] as const).map((option) => (
        <button
          key={option.id}
          type="button"
          data-active={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
            'text-gray-500 hover:text-gray-800',
            option.id === 'sent' &&
              'data-[active=true]:bg-blue-600 data-[active=true]:text-white',
            option.id === 'paid' &&
              'data-[active=true]:bg-green-600 data-[active=true]:text-white',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function SuperAdminDashboard() {
  const [invoiceCountMode, setInvoiceCountMode] = useState<InvoiceCountMode>('sent');

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-dashboard'],
    queryFn: async () => {
      const res = await api.get('/super-admin/dashboard');
      return res.data.data;
    },
  });

  const weeklyRevenue = (data?.weeklyRevenue || []) as DailyRevenueBucket[];
  const weeklyChartData = useMemo(
    () => buildWeeklyChartData(weeklyRevenue, invoiceCountMode),
    [weeklyRevenue, invoiceCountMode]
  );

  const weekInvoiceTotal = useMemo(() => {
    return weeklyRevenue.reduce(
      (sum, day) =>
        sum
        + (invoiceCountMode === 'sent'
          ? (day.sentInvoiceCount ?? 0)
          : (day.paidInvoiceCount ?? 0)),
      0
    );
  }, [weeklyRevenue, invoiceCountMode]);

  if (isLoading) return <Loader />;

  const stats = data?.stats || {};
  const recentPayments = (data?.recentPayments || []) as RecentPayment[];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Clients" value={stats.clients || 0} icon={Users} />
        <StatCard title="Active Subscriptions" value={stats.activeSubscriptions || 0} icon={CreditCard} />
        <StatCard
          title="Collected revenue"
          value={formatCurrency(stats.actualRevenue || 0)}
          icon={DollarSign}
          trend="Captured payments"
        />
        <StatCard title="Platform invoices" value={stats.totalInvoices || 0} icon={FileText} />
      </div>
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          <ChartCard
            title="This Week's Revenue"
            subtitle={`${formatCurrentWeekSubtitle(weeklyRevenue)} · ${weekInvoiceTotal} ${
              invoiceCountMode === 'sent' ? 'sent' : 'paid'
            } client invoice${weekInvoiceTotal === 1 ? '' : 's'}`}
            data={weeklyChartData.length ? weeklyChartData : [{ name: 'No data', value: 0, count: 0 }]}
            valueFormatter={formatCurrency}
            axisValueFormatter={formatCompactCurrency}
            countNoun={invoiceCountMode === 'sent' ? 'sent invoice' : 'paid invoice'}
            headerActions={
              <InvoiceCountToggle value={invoiceCountMode} onChange={setInvoiceCountMode} />
            }
          />
          <Card>
            <CardHeader>
              <CardTitle>Latest Payments</CardTitle>
            </CardHeader>
            <div className="divide-y divide-border">
              {recentPayments.length > 0 ? (
                recentPayments.map((payment) => (
                  <div
                    key={payment._id}
                    className="flex items-center justify-between gap-4 px-6 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{getCompanyName(payment.companyId)}</p>
                      <p className="text-muted-foreground">{formatDate(payment.createdAt)}</p>
                    </div>
                    <p className="font-semibold shrink-0">{formatCurrency(payment.amount)}</p>
                  </div>
                ))
              ) : (
                <p className="px-6 py-4 text-sm text-muted-foreground">No payments yet.</p>
              )}
            </div>
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader><CardTitle>Recent Activities</CardTitle></CardHeader>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {(data?.recentActivities || []).length > 0 ? (
              (data?.recentActivities || []).map((a: {
                _id: string;
                description: string;
                createdAt: string;
                userId?: ActivityUserRef;
              }) => (
                <ActivityListItem
                  key={a._id}
                  description={a.description}
                  createdAt={a.createdAt}
                  userId={a.userId}
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
