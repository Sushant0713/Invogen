import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  Package,
  Plus,
  Receipt,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import api from '@/api/client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { resolveInvoiceTotal } from '@/features/invoice-composer/invoice-totals';
import { useAppSelector } from '@/hooks/useAppDispatch';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

type EmployeeInvoiceStat = {
  userId: string;
  name: string;
  role?: string;
  invoiceCount: number;
};

type RecentInvoice = {
  _id: string;
  invoiceNumber?: string;
  status?: string;
  createdAt?: string;
  customerId?: { name?: string } | string;
  totals?: { total?: number };
  customerSnapshot?: { placeholders?: Record<string, unknown> };
};

function statusBadgeVariant(status?: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'paid':
      return 'success';
    case 'sent':
      return 'info';
    case 'draft':
      return 'warning';
    case 'cancelled':
      return 'danger';
    default:
      return 'default';
  }
}

function customerName(row: RecentInvoice) {
  if (typeof row.customerId === 'object' && row.customerId?.name) return row.customerId.name;
  return '-';
}

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export default function AdminDashboard() {
  const user = useAppSelector((s) => s.auth.user);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => (await api.get('/admin/dashboard')).data.data,
  });

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(new Date()),
    []
  );

  if (isLoading) return <Loader />;

  const stats = data?.stats || {};
  const maxInvoices = data?.subscription?.planId?.maxInvoices as number | undefined;
  const totalUsedInvoices = (data?.totalUsedInvoices as number) || 0;
  const invoicesLeft =
    maxInvoices !== undefined ? Math.max(0, maxInvoices - totalUsedInvoices) : null;
  const usagePercent =
    maxInvoices && maxInvoices > 0
      ? Math.min(100, Math.round((totalUsedInvoices / maxInvoices) * 100))
      : 0;
  const quotaTight = maxInvoices !== undefined && invoicesLeft !== null && invoicesLeft <= 1;

  const employeeStats = (data?.employeeInvoiceStats || []) as EmployeeInvoiceStat[];
  const selectedEmployeeStat = employeeStats.find((s) => s.userId === selectedEmployeeId);
  const employeeInvoiceCount =
    selectedEmployeeId === 'all'
      ? totalUsedInvoices
      : selectedEmployeeStat?.invoiceCount || 0;

  const recentInvoices = (data?.recentInvoices || []) as RecentInvoice[];
  const firstName = user?.firstName?.trim() || 'there';
  const greeting = greetingForHour(new Date().getHours());

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-2xl border border-orange-100/80 bg-gradient-to-br from-white via-primary-50/40 to-orange-50/80 p-6 sm:p-7"
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-amber-200/30 blur-3xl"
          aria-hidden
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary-700/80">{todayLabel}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              {greeting}, {firstName}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-gray-600">
              Here’s how your invoicing workspace is performing right now.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/invoices">
              <Button variant="outline" size="sm">
                All invoices
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/admin/invoices/new">
              <Button size="sm">
                <Plus className="h-4 w-4" />
                New invoice
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Revenue spotlight */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.35, delay: 0.06 }}
        className="grid gap-4 md:grid-cols-2"
      >
        <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-emerald-50" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-500">Actual revenue</p>
              <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-gray-900 sm:text-3xl">
                {formatCurrency(stats.actualRevenue || 0)}
              </p>
              <p className="mt-2 text-xs text-emerald-700">Collected from paid invoices</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-sky-50" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-500">Expected revenue</p>
              <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-gray-900 sm:text-3xl">
                {formatCurrency(stats.expectedRevenue || 0)}
              </p>
              <p className="mt-2 text-xs text-sky-700">Outstanding on sent invoices</p>
            </div>
            <div className="rounded-xl bg-sky-50 p-2.5 text-sky-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Plan usage + metrics */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="grid gap-4 xl:grid-cols-5"
      >
        <Card
          glass={false}
          className="border border-gray-100 bg-white p-5 shadow-sm xl:col-span-2"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                <Sparkles className="h-3.5 w-3.5" />
                Plan usage
              </div>
              <h2 className="mt-3 text-lg font-semibold text-gray-900">Invoice quota</h2>
              <p className="mt-1 text-sm text-gray-500">Sent + paid invoices this period</p>
            </div>
            <label className="sr-only" htmlFor="dashboard-employee-filter">
              Filter by team member
            </label>
            <select
              id="dashboard-employee-filter"
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
            >
              <option value="all">All team</option>
              {employeeStats.map((emp) => (
                <option key={emp.userId} value={emp.userId}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-bold tabular-nums text-gray-900">
                {employeeInvoiceCount}
                {maxInvoices !== undefined ? (
                  <span className="text-lg font-semibold text-gray-400"> / {maxInvoices}</span>
                ) : null}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {maxInvoices !== undefined
                  ? selectedEmployeeId === 'all'
                    ? `${invoicesLeft} left on your plan`
                    : 'Used by this teammate'
                  : 'Unlimited on your plan'}
              </p>
            </div>
            {maxInvoices !== undefined ? (
              <div
                className={cn(
                  'rounded-xl px-3 py-2 text-right text-sm font-semibold',
                  quotaTight ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
                )}
              >
                {invoicesLeft} left
              </div>
            ) : (
              <div className="rounded-xl bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700">
                Unlimited
              </div>
            )}
          </div>

          {maxInvoices !== undefined ? (
            <div className="mt-4">
              <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    quotaTight ? 'bg-amber-500' : 'bg-primary'
                  )}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-400">{usagePercent}% of plan limit used</p>
            </div>
          ) : null}
        </Card>

        <div className="grid gap-4 sm:grid-cols-3 xl:col-span-3 xl:grid-cols-3">
          {[
            {
              title: 'Customers',
              value: stats.customers || 0,
              hint: 'In your directory',
              icon: Users,
              tone: 'bg-violet-50 text-violet-600',
              to: '/admin/customers',
            },
            {
              title: 'Products',
              value: stats.products || 0,
              hint: 'Active catalog',
              icon: Package,
              tone: 'bg-orange-50 text-orange-600',
              to: '/admin/products',
            },
            {
              title: 'All invoices',
              value: stats.invoices || 0,
              hint: 'Including drafts',
              icon: Receipt,
              tone: 'bg-blue-50 text-blue-600',
              to: '/admin/invoices',
            },
          ].map((item) => (
            <Link
              key={item.title}
              to={item.to}
              className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-primary/25 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className={cn('rounded-xl p-2.5', item.tone)}>
                  <item.icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-gray-300 transition group-hover:text-primary" />
              </div>
              <p className="mt-4 text-sm font-medium text-gray-500">{item.title}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{item.value}</p>
              <p className="mt-1 text-xs text-gray-400">{item.hint}</p>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Recent invoices */}
      <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.14 }}>
        <Card glass={false} className="border border-gray-100 bg-white p-0 shadow-sm overflow-hidden">
          <CardHeader className="mb-0 flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 px-6 py-5">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Recent invoices
              </CardTitle>
              <p className="mt-1 text-sm text-gray-500">Your latest activity across the workspace</p>
            </div>
            <Link to="/admin/invoices">
              <Button variant="ghost" size="sm">
                View all
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>

          {recentInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-4 rounded-2xl bg-primary-50 p-4 text-primary">
                <Receipt className="h-8 w-8" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">No invoices yet</h3>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                Create your first invoice to start tracking customers, payments, and revenue here.
              </p>
              <Link to="/admin/invoices/new" className="mt-5">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Create invoice
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-50 text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-6 py-3 font-medium">Invoice</th>
                    <th className="px-6 py-3 font-medium">Customer</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Total</th>
                    <th className="px-6 py-3 font-medium text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentInvoices.map((row) => (
                    <tr
                      key={row._id}
                      className="transition-colors hover:bg-primary-50/40"
                    >
                      <td className="px-6 py-3.5">
                        <Link
                          to={`/admin/invoices/${row._id}/view`}
                          className="font-semibold text-gray-900 hover:text-primary"
                        >
                          {row.invoiceNumber || '—'}
                        </Link>
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">{customerName(row)}</td>
                      <td className="px-6 py-3.5">
                        <Badge variant={statusBadgeVariant(row.status)} className="capitalize">
                          {row.status || '—'}
                        </Badge>
                      </td>
                      <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-gray-900">
                        {formatCurrency(
                          resolveInvoiceTotal({
                            totals: row.totals,
                            customerSnapshot: row.customerSnapshot,
                          })
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right text-gray-500">
                        {row.createdAt ? formatDate(row.createdAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
