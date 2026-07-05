import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserCheck, UserX, CreditCard, Plus, Search, Trash2 } from 'lucide-react';
import api from '@/api/client';
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

interface PlanRef {
  _id: string;
  name: string;
  billingCycle: string;
  price: number;
  currency: string;
}

interface ClientRow {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  isEmailVerified: boolean;
  authProvider?: 'local' | 'google';
  createdAt: string;
  company?: { _id?: string; name?: string; email?: string; phone?: string } | null;
  subscription?: {
    status: string;
    plan?: PlanRef | null;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
  } | null;
  revenueCollected?: number;
}

const formatStatusLabel = (status?: string) => {
  if (!status) return '—';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

interface PlanOption {
  _id: string;
  name: string;
  billingCycle: string;
  price: number;
  currency: string;
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

const emptyCreateForm = () => ({
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  companyName: '',
  planId: '',
});

export default function SuperAdminClients() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['super-admin-client-stats'],
    queryFn: async () => (await api.get('/super-admin/clients/stats')).data.data,
  });

  const { data: plans } = useQuery({
    queryKey: ['super-admin-plans'],
    queryFn: async () => (await api.get('/super-admin/plans')).data.data as PlanOption[],
  });

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-clients', search, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/super-admin/clients?${params}`);
      return res.data;
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/super-admin/clients/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-clients'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-client-stats'] });
      toast.success('Client status updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/super-admin/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-clients'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-client-stats'] });
      setDeletingId(null);
      toast.success('Client deleted');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setDeletingId(null);
      toast.error(err.response?.data?.message || 'Failed to delete client');
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof emptyCreateForm>) =>
      api.post('/super-admin/clients', {
        ...payload,
        planId: payload.planId || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-clients'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-client-stats'] });
      setShowCreate(false);
      setCreateForm(emptyCreateForm());
      toast.success('Client created');
      const id = res.data.data?.user?._id;
      if (id) navigate(`/super-admin/clients/${id}`);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to create client');
    },
  });

  const clients = (data?.data || []) as ClientRow[];
  const meta = data?.meta;
  const activePlans = useMemo(
    () => (plans || []).filter((p) => p.name),
    [plans]
  );

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirmToast(`Delete client "${name}"?`, {
      description:
        'This will permanently remove their company, invoices, subscriptions, and all related data.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) return;
    setDeletingId(id);
    deleteMutation.mutate(id);
  };

  const stickyActionsClass =
    'sticky right-0 z-20 min-w-[280px] border-l border-gray-200 bg-white shadow-[-6px_0_12px_-6px_rgba(15,23,42,0.08)] group-hover:bg-orange-50';
  const stickyActionsHeaderClass =
    'sticky right-0 z-30 min-w-[280px] border-l border-gray-200 bg-gray-50';

  if (statsLoading && isLoading) return <Loader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage client accounts, subscriptions, and company profiles
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard compact title="Total Clients" value={stats?.total || 0} icon={Users} />
        <StatCard compact title="Active" value={stats?.active || 0} icon={UserCheck} />
        <StatCard compact title="Suspended" value={stats?.suspended || 0} icon={UserX} />
        <StatCard
          compact
          title="Active Subscriptions"
          value={(stats?.activeSubscriptions || 0) + (stats?.trialSubscriptions || 0)}
          icon={CreditCard}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>All Clients</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  className="rounded-xl border border-gray-200 bg-white/80 pl-9 pr-4 py-2 text-sm w-full sm:w-64 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Search name, email, company..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <select
                className={selectClass}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <DataTable
          loading={isLoading}
          columns={[
            {
              key: 'client',
              label: 'Client',
              render: (r) => {
                const row = r as unknown as ClientRow;
                return (
                  <button
                    type="button"
                    onClick={() => navigate(`/super-admin/clients/${row._id}`)}
                    className="text-left hover:text-primary"
                  >
                    <p className="font-medium text-gray-900">
                      {row.firstName} {row.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{row.email}</p>
                  </button>
                );
              },
            },
            {
              key: 'company',
              label: 'Company',
              render: (r) => {
                const row = r as unknown as ClientRow;
                return (
                  <div>
                    <p className="font-medium text-gray-900">{row.company?.name || '—'}</p>
                    {row.company?.email && (
                      <p className="text-xs text-gray-500">{row.company.email}</p>
                    )}
                  </div>
                );
              },
            },
            {
              key: 'plan',
              label: 'Plan',
              render: (r) => {
                const sub = (r as unknown as ClientRow).subscription;
                if (!sub?.plan) return <span className="text-gray-400">No plan</span>;
                return (
                  <div>
                    <p className="font-medium text-gray-900">{sub.plan.name}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {formatCurrency(sub.plan.price, sub.plan.currency)} · {sub.plan.billingCycle}
                    </p>
                  </div>
                );
              },
            },
            {
              key: 'subscription',
              label: 'Subscription',
              render: (r) => {
                const sub = (r as unknown as ClientRow).subscription;
                if (!sub) return <Badge variant="default">None</Badge>;
                return (
                  <div className="space-y-1">
                    <Badge variant={subscriptionBadge(sub.status)}>
                      {formatStatusLabel(sub.status)}
                    </Badge>
                    {sub.currentPeriodEnd && (
                      <p className="text-xs text-gray-500">
                        Until {formatDate(sub.currentPeriodEnd)}
                      </p>
                    )}
                  </div>
                );
              },
            },
            {
              key: 'account',
              label: 'Account',
              render: (r) => {
                const row = r as unknown as ClientRow;
                return (
                  <div className="space-y-1">
                    <Badge variant={row.status === 'active' ? 'success' : 'danger'}>
                      {formatStatusLabel(row.status)}
                    </Badge>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                      {row.authProvider === 'google' ? 'Google sign-up' : 'Email sign-up'}
                    </p>
                    {row.isEmailVerified && (
                      <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600">
                        Verified
                      </p>
                    )}
                  </div>
                );
              },
            },
            {
              key: 'revenue',
              label: 'Revenue',
              render: (r) => {
                const row = r as unknown as ClientRow;
                return (
                  <span className="font-medium tabular-nums text-gray-900">
                    {formatCurrency(row.revenueCollected || 0)}
                  </span>
                );
              },
            },
            {
              key: 'joined',
              label: 'Joined',
              render: (r) => (
                <span className="whitespace-nowrap text-gray-600">
                  {formatDate((r as unknown as ClientRow).createdAt)}
                </span>
              ),
            },
            {
              key: 'actions',
              label: 'Actions',
              headerClassName: stickyActionsHeaderClass,
              cellClassName: stickyActionsClass,
              render: (r) => {
                const row = r as unknown as ClientRow;
                const isDeleting = deletingId === row._id;
                return (
                  <div className="flex gap-2 whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/super-admin/clients/${row._id}`)}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={statusMutation.isPending || deleteMutation.isPending}
                      onClick={() =>
                        statusMutation.mutate({
                          id: row._id,
                          status: row.status === 'active' ? 'suspended' : 'active',
                        })
                      }
                    >
                      {row.status === 'active' ? 'Suspend' : 'Activate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={statusMutation.isPending || deleteMutation.isPending}
                      loading={isDeleting}
                      onClick={() => handleDelete(row._id, `${row.firstName} ${row.lastName}`)}
                      title={`Delete ${row.firstName} ${row.lastName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                );
              },
            },
          ]}
          data={clients as unknown as Record<string, unknown>[]}
          keyField="_id"
          pagination={
            meta?.totalPages > 1
              ? { page: meta.page, totalPages: meta.totalPages, onPageChange: setPage }
              : undefined
          }
        />
      </Card>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto" glass={false}>
            <CardHeader>
              <CardTitle>Add New Client</CardTitle>
              <p className="text-sm text-gray-500">Create a client account with company profile</p>
            </CardHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(createForm);
              }}
            >
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First name"
                  required
                  value={createForm.firstName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))}
                />
                <Input
                  label="Last name"
                  required
                  value={createForm.lastName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
              <Input
                label="Email"
                type="email"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Password"
                type="password"
                required
                minLength={8}
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              />
              <Input
                label="Company name"
                required
                value={createForm.companyName}
                onChange={(e) => setCreateForm((f) => ({ ...f, companyName: e.target.value }))}
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Subscription plan (optional)</label>
                <select
                  className={`${selectClass} w-full`}
                  value={createForm.planId}
                  onChange={(e) => setCreateForm((f) => ({ ...f, planId: e.target.value }))}
                >
                  <option value="">No plan — assign later</option>
                  {activePlans.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} — {formatCurrency(p.price, p.currency)} / {p.billingCycle}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Client'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
