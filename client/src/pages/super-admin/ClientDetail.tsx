import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Users,
  FileText,
  DollarSign,
  Activity,
  Save,
} from 'lucide-react';
import api from '@/api/client';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { StatCard } from '@/components/dashboard/StatCard';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { formatCurrency, formatDate } from '@/lib/utils';
import { confirmToast } from '@/lib/confirm-toast';
import { toast } from 'sonner';
import { ActivityListItem } from '@/components/dashboard/ActivityListItem';
import type { ActivityUserRef } from '@/lib/activity';

type Tab = 'overview' | 'subscription' | 'revenue' | 'activity';

interface ClientRevenue {
  totalCollected: number;
  capturedCount: number;
  pendingCount: number;
  failedCount: number;
  averagePayment: number;
  lastPaymentAt?: string | null;
  monthly: { month: string; total: number; count: number }[];
  payments: {
    _id: string;
    amount: number;
    currency: string;
    status: string;
    razorpayOrderId?: string;
    createdAt: string;
    metadata?: {
      discountCode?: string;
      totalGst?: number;
      subtotal?: number;
    };
  }[];
}

interface PlanRef {
  _id: string;
  name: string;
  billingCycle: string;
  price: number;
  currency: string;
}

interface ClientProfile {
  user: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
    isEmailVerified: boolean;
    lastLogin?: string;
    createdAt: string;
  };
  company: {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    gst?: string;
    pan?: string;
    createdAt: string;
  } | null;
  subscription: {
    _id: string;
    status: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    planId: PlanRef;
  } | null;
  stats: {
    employeeCount: number;
    customerCount: number;
    invoiceCount: number;
    totalRevenue: number;
  };
  payments: {
    _id: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
  }[];
  activities: {
    _id: string;
    action: string;
    module: string;
    description: string;
    createdAt: string;
    userId?: ActivityUserRef;
  }[];
  employees: {
    _id: string;
    department?: string;
    designation?: string;
    userId: { firstName: string; lastName: string; email: string; status: string };
  }[];
}

const selectClass =
  'rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const subscriptionBadge = (status?: string) => {
  switch (status) {
    case 'active':
      return 'success' as const;
    case 'trial':
      return 'info' as const;
    case 'past_due':
      return 'warning' as const;
    case 'cancelled':
    case 'paused':
      return 'danger' as const;
    default:
      return 'default' as const;
  }
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedPlanId, setSelectedPlanId] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['super-admin-client', id],
    queryFn: async () => (await api.get(`/super-admin/clients/${id}`)).data.data as ClientProfile,
    enabled: !!id,
  });

  const { data: revenue, isLoading: revenueLoading } = useQuery({
    queryKey: ['super-admin-client-revenue', id],
    queryFn: async () => (await api.get(`/super-admin/clients/${id}/revenue`)).data.data as ClientRevenue,
    enabled: !!id && tab === 'revenue',
  });

  const { data: plans } = useQuery({
    queryKey: ['super-admin-plans'],
    queryFn: async () => (await api.get('/super-admin/plans')).data.data as PlanRef[],
  });

  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    status: 'active',
    companyName: '',
    companyEmail: '',
    companyPhone: '',
    gst: '',
    pan: '',
  });

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      email: profile.user.email,
      status: profile.user.status,
      companyName: profile.company?.name || '',
      companyEmail: profile.company?.email || '',
      companyPhone: profile.company?.phone || '',
      gst: profile.company?.gst || '',
      pan: profile.company?.pan || '',
    });
  }, [profile?.user._id]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['super-admin-client', id] });
    queryClient.invalidateQueries({ queryKey: ['super-admin-clients'] });
    queryClient.invalidateQueries({ queryKey: ['super-admin-client-stats'] });
  };

  const updateMutation = useMutation({
    mutationFn: (payload: typeof profileForm) =>
      api.patch(`/super-admin/clients/${id}`, {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        status: payload.status,
        company: {
          name: payload.companyName,
          email: payload.companyEmail,
          phone: payload.companyPhone,
          gst: payload.gst,
          pan: payload.pan,
        },
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Profile updated');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Update failed');
    },
  });

  const assignPlanMutation = useMutation({
    mutationFn: (planId: string) =>
      api.post(`/super-admin/clients/${id}/subscription/plan`, { planId }),
    onSuccess: () => {
      invalidate();
      setSelectedPlanId('');
      toast.success('Plan assigned');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to assign plan');
    },
  });

  const subscriptionMutation = useMutation({
    mutationFn: (status: string) =>
      api.patch(`/super-admin/clients/${id}/subscription`, { status }),
    onSuccess: () => {
      invalidate();
      toast.success('Subscription updated');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to update subscription');
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      api.patch(`/super-admin/clients/${id}/status`, { status }),
    onSuccess: () => {
      invalidate();
      toast.success('Account status updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/super-admin/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-clients'] });
      toast.success('Client deleted');
      navigate('/super-admin/clients');
    },
  });

  if (isLoading || !profile) return <Loader />;

  const { user, company, subscription, stats, activities, employees } = profile;
  const plan = subscription?.planId;

  const tabs: { key: Tab; label: string; icon: typeof Building2 }[] = [
    { key: 'overview', label: 'Overview', icon: Building2 },
    { key: 'subscription', label: 'Subscription', icon: CreditCard },
    { key: 'revenue', label: 'Revenue', icon: DollarSign },
    { key: 'activity', label: 'Activity', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/super-admin/clients')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-sm text-gray-500">{user.email}</p>
            <div className="flex gap-2 mt-2">
              <Badge variant={user.status === 'active' ? 'success' : 'danger'}>{user.status}</Badge>
              {user.isEmailVerified && <Badge variant="info">Verified</Badge>}
              {subscription && (
                <Badge variant={subscriptionBadge(subscription.status)}>{subscription.status}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              statusMutation.mutate(user.status === 'active' ? 'suspended' : 'active')
            }
          >
            {user.status === 'active' ? 'Suspend Account' : 'Activate Account'}
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              const confirmed = await confirmToast(
                `Delete ${user.firstName} ${user.lastName}?`,
                {
                  description: 'This permanently removes all client data.',
                  confirmLabel: 'Delete',
                  cancelLabel: 'Cancel',
                  variant: 'danger',
                }
              );
              if (confirmed) deleteMutation.mutate();
            }}
          >
            Delete Client
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Employees" value={stats.employeeCount} icon={Users} />
        <StatCard title="Customers" value={stats.customerCount} icon={Users} />
        <StatCard title="Invoices" value={stats.invoiceCount} icon={FileText} />
        <StatCard title="Revenue Collected" value={formatCurrency(stats.totalRevenue)} icon={DollarSign} />
      </div>

      <div className="flex gap-2 border-b border-gray-100 pb-1 overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-xl transition-colors ${
              tab === key
                ? 'text-primary border-b-2 border-primary bg-primary-50/50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Client Profile</CardTitle>
            </CardHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate(profileForm);
              }}
            >
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First name"
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm((f) => ({ ...f, firstName: e.target.value }))}
                />
                <Input
                  label="Last name"
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
              <Input
                label="Email"
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Account status</label>
                <select
                  className={`${selectClass} w-full`}
                  value={profileForm.status}
                  onChange={(e) => setProfileForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="text-xs text-gray-400 space-y-1 pt-2 border-t border-gray-50">
                <p>Joined: {formatDate(user.createdAt)}</p>
                {user.lastLogin && <p>Last login: {formatDate(user.lastLogin)}</p>}
              </div>
              <Button type="submit" disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Profile
              </Button>
            </form>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Company Details</CardTitle>
            </CardHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate(profileForm);
              }}
            >
              <Input
                label="Company name"
                value={profileForm.companyName}
                onChange={(e) => setProfileForm((f) => ({ ...f, companyName: e.target.value }))}
              />
              <Input
                label="Company email"
                type="email"
                value={profileForm.companyEmail}
                onChange={(e) => setProfileForm((f) => ({ ...f, companyEmail: e.target.value }))}
              />
              <Input
                label="Phone"
                value={profileForm.companyPhone}
                onChange={(e) => setProfileForm((f) => ({ ...f, companyPhone: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="GST"
                  value={profileForm.gst}
                  onChange={(e) => setProfileForm((f) => ({ ...f, gst: e.target.value }))}
                />
                <Input
                  label="PAN"
                  value={profileForm.pan}
                  onChange={(e) => setProfileForm((f) => ({ ...f, pan: e.target.value }))}
                />
              </div>
              {company && (
                <p className="text-xs text-gray-400">Company since {formatDate(company.createdAt)}</p>
              )}
              <Button type="submit" disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save Company
              </Button>
            </form>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Team ({employees.length})</CardTitle>
            </CardHeader>
            <DataTable
              columns={[
                {
                  key: 'name',
                  label: 'Employee',
                  render: (r) => {
                    const emp = r as unknown as ClientProfile['employees'][0];
                    return (
                      <div>
                        <p className="font-medium">
                          {emp.userId.firstName} {emp.userId.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{emp.userId.email}</p>
                      </div>
                    );
                  },
                },
                { key: 'department', label: 'Department', render: (r) => (r as { department?: string }).department || '—' },
                { key: 'designation', label: 'Role', render: (r) => (r as { designation?: string }).designation || '—' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => {
                    const status = (r as unknown as ClientProfile['employees'][0]).userId.status;
                    return (
                      <Badge variant={status === 'active' ? 'success' : 'danger'}>{status}</Badge>
                    );
                  },
                },
              ]}
              data={employees as unknown as Record<string, unknown>[]}
              keyField="_id"
            />
          </Card>
        </div>
      )}

      {tab === 'subscription' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Current Subscription</CardTitle>
            </CardHeader>
            {subscription && plan ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold">{plan.name}</p>
                    <p className="text-sm text-gray-500 capitalize">{plan.billingCycle} billing</p>
                  </div>
                  <Badge variant={subscriptionBadge(subscription.status)}>{subscription.status}</Badge>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(plan.price, plan.currency)}
                  <span className="text-sm font-normal text-gray-500"> / {plan.billingCycle}</span>
                </p>
                {subscription.currentPeriodStart && (
                  <p className="text-sm text-gray-600">
                    Period: {formatDate(subscription.currentPeriodStart)} —{' '}
                    {subscription.currentPeriodEnd
                      ? formatDate(subscription.currentPeriodEnd)
                      : 'No end date'}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  {subscription.status !== 'active' && (
                    <Button
                      size="sm"
                      onClick={() => subscriptionMutation.mutate('active')}
                      disabled={subscriptionMutation.isPending}
                    >
                      Activate
                    </Button>
                  )}
                  {subscription.status !== 'paused' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => subscriptionMutation.mutate('paused')}
                      disabled={subscriptionMutation.isPending}
                    >
                      Pause
                    </Button>
                  )}
                  {subscription.status !== 'cancelled' && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        const confirmed = await confirmToast('Cancel this subscription?', {
                          description: 'The client will lose access when the current period ends.',
                          confirmLabel: 'Cancel subscription',
                          cancelLabel: 'Keep',
                          variant: 'danger',
                        });
                        if (confirmed) subscriptionMutation.mutate('cancelled');
                      }}
                      disabled={subscriptionMutation.isPending}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No active subscription. Assign a plan below.</p>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assign / Change Plan</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <select
                className={`${selectClass} w-full`}
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
              >
                <option value="">Select a plan</option>
                {(plans || []).map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} — {formatCurrency(p.price, p.currency)} / {p.billingCycle}
                  </option>
                ))}
              </select>
              <Button
                disabled={!selectedPlanId || assignPlanMutation.isPending}
                onClick={async () => {
                  if (subscription) {
                    const confirmed = await confirmToast(
                      'Replace the current subscription?',
                      {
                        description: 'This will replace the current subscription immediately.',
                        confirmLabel: 'Continue',
                        cancelLabel: 'Cancel',
                      }
                    );
                    if (!confirmed) return;
                  }
                  if (selectedPlanId) assignPlanMutation.mutate(selectedPlanId);
                }}
              >
                {assignPlanMutation.isPending ? 'Assigning...' : 'Assign Plan'}
              </Button>
              <p className="text-xs text-gray-400">
                Super-admin plan assignment bypasses payment and activates immediately.
              </p>
            </div>
          </Card>
        </div>
      )}

      {tab === 'revenue' && (
        <div className="space-y-6">
          {revenueLoading ? (
            <Loader />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Total collected"
                  value={formatCurrency(revenue?.totalCollected || 0)}
                  icon={DollarSign}
                  compact
                />
                <StatCard
                  title="Successful payments"
                  value={revenue?.capturedCount || 0}
                  icon={CreditCard}
                  compact
                />
                <StatCard
                  title="Average payment"
                  value={formatCurrency(revenue?.averagePayment || 0)}
                  icon={DollarSign}
                  compact
                />
                <StatCard
                  title="Pending / failed"
                  value={`${revenue?.pendingCount || 0} / ${revenue?.failedCount || 0}`}
                  icon={Activity}
                  compact
                />
              </div>

              {revenue?.lastPaymentAt && (
                <p className="text-sm text-gray-500">
                  Last payment received on {formatDate(revenue.lastPaymentAt)}
                </p>
              )}

              <ChartCard
                title="Monthly revenue collected"
                data={
                  (revenue?.monthly || []).length > 0
                    ? revenue!.monthly.map((m) => ({
                        name: m.month,
                        value: m.total,
                      }))
                    : [{ name: 'No data', value: 0 }]
                }
              />

              <Card>
                <CardHeader>
                  <CardTitle>
                    Payment transactions ({revenue?.payments?.length ?? 0})
                  </CardTitle>
                </CardHeader>
                <DataTable
                  columns={[
                    {
                      key: 'date',
                      label: 'Date',
                      render: (r) => formatDate((r as ClientRevenue['payments'][0]).createdAt),
                    },
                    {
                      key: 'amount',
                      label: 'Amount',
                      render: (r) => {
                        const p = r as ClientRevenue['payments'][0];
                        return formatCurrency(p.amount, p.currency);
                      },
                    },
                    {
                      key: 'gst',
                      label: 'GST',
                      render: (r) => {
                        const gst = (r as ClientRevenue['payments'][0]).metadata?.totalGst;
                        return gst != null ? formatCurrency(gst) : '—';
                      },
                    },
                    {
                      key: 'status',
                      label: 'Status',
                      render: (r) => {
                        const status = (r as ClientRevenue['payments'][0]).status;
                        const variant =
                          status === 'captured'
                            ? 'success'
                            : status === 'failed' || status === 'refunded'
                              ? 'danger'
                              : 'warning';
                        return <Badge variant={variant}>{status}</Badge>;
                      },
                    },
                    {
                      key: 'orderId',
                      label: 'Order ID',
                      render: (r) => (
                        <span className="font-mono text-xs text-gray-600">
                          {(r as ClientRevenue['payments'][0]).razorpayOrderId || '—'}
                        </span>
                      ),
                    },
                    {
                      key: 'coupon',
                      label: 'Coupon',
                      render: (r) =>
                        (r as ClientRevenue['payments'][0]).metadata?.discountCode || '—',
                    },
                  ]}
                  data={(revenue?.payments || []) as unknown as Record<string, unknown>[]}
                  keyField="_id"
                />
              </Card>

              {(revenue?.monthly || []).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly breakdown</CardTitle>
                  </CardHeader>
                  <DataTable
                    columns={[
                      {
                        key: 'month',
                        label: 'Month',
                        render: (r) => (r as ClientRevenue['monthly'][0]).month,
                      },
                      {
                        key: 'count',
                        label: 'Payments',
                        render: (r) => String((r as ClientRevenue['monthly'][0]).count),
                      },
                      {
                        key: 'total',
                        label: 'Collected',
                        render: (r) => formatCurrency((r as ClientRevenue['monthly'][0]).total),
                      },
                    ]}
                    data={(revenue?.monthly || []) as unknown as Record<string, unknown>[]}
                    keyField="month"
                  />
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <div className="space-y-3 max-h-[32rem] overflow-auto">
            {activities.length === 0 ? (
              <p className="text-gray-500 text-sm">No activity recorded</p>
            ) : (
              activities.map((a) => (
                <ActivityListItem
                  key={a._id}
                  description={a.description}
                  createdAt={a.createdAt}
                  userId={a.userId}
                  meta={`${a.module} · ${a.action}`}
                />
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
