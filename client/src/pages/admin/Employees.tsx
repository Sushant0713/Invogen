import { useMemo, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EMPLOYEE_DEFAULT_PERMISSIONS,
  type Permission,
} from '@invogen/shared';
import api from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { DataTable } from '@/components/ui/DataTable';
import { Switch } from '@/components/ui/Switch';
import { PermissionCheckboxes } from '@/features/employees/PermissionCheckboxes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type EmployeeUser = {
  firstName?: string;
  lastName?: string;
  email?: string;
  status?: string;
  isLoggedIn?: boolean;
  hasAccess?: boolean;
  lastLogin?: string;
};

function getEmployeeStatusLabel(user?: EmployeeUser) {
  if (!user) return { label: '—', tone: 'neutral' as const };
  if (user.status === 'pending') return { label: 'Pending approval', tone: 'warning' as const };
  if (user.status === 'suspended' || user.hasAccess === false) {
    return { label: 'No access', tone: 'danger' as const };
  }
  if (user.isLoggedIn) return { label: 'Online', tone: 'success' as const };
  return { label: 'Offline', tone: 'neutral' as const };
}

function EmployeeStatusBadge({ user }: { user?: EmployeeUser }) {
  const { label, tone } = getEmployeeStatusLabel(user);
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize',
        tone === 'success' && 'bg-green-50 text-green-700',
        tone === 'warning' && 'bg-amber-50 text-amber-700',
        tone === 'danger' && 'bg-red-50 text-red-700',
        tone === 'neutral' && 'bg-gray-100 text-gray-600'
      )}
    >
      {label}
    </span>
  );
}

type EmployeeRow = {
  _id: string;
  department?: string;
  designation?: string;
  permissions?: Permission[];
  userId?: EmployeeUser;
};

type EmployeeForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  department: string;
  designation: string;
  permissions: Permission[];
};

const emptyForm = (): EmployeeForm => ({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  department: '',
  designation: '',
  permissions: [...EMPLOYEE_DEFAULT_PERMISSIONS],
});

function EmployeeFormFields({
  form,
  onChange,
  includePassword,
}: {
  form: EmployeeForm;
  onChange: (form: EmployeeForm) => void;
  includePassword?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="First name"
          value={form.firstName}
          onChange={(e) => onChange({ ...form, firstName: e.target.value })}
        />
        <Input
          label="Last name"
          value={form.lastName}
          onChange={(e) => onChange({ ...form, lastName: e.target.value })}
        />
      </div>
      <Input
        label="Email"
        fieldKind="email"
        value={form.email}
        onChange={(e) => onChange({ ...form, email: e.target.value })}
      />
      {includePassword && (
        <Input
          label="Password"
          fieldKind="password-new"
          value={form.password}
          onChange={(e) => onChange({ ...form, password: e.target.value })}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Department"
          value={form.department}
          onChange={(e) => onChange({ ...form, department: e.target.value })}
        />
        <Input
          label="Designation"
          value={form.designation}
          onChange={(e) => onChange({ ...form, designation: e.target.value })}
        />
      </div>
      <PermissionCheckboxes
        value={form.permissions}
        onChange={(permissions) => onChange({ ...form, permissions })}
      />
    </div>
  );
}

export default function AdminEmployeesPage() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const isPendingView = location.pathname.endsWith('/pending');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [approvalPermissions, setApprovalPermissions] = useState<Permission[]>([
    ...EMPLOYEE_DEFAULT_PERMISSIONS,
  ]);

  const { data: companyData } = useQuery({
    queryKey: ['admin-company'],
    queryFn: async () => (await api.get('/admin/company')).data.data,
  });

  const defaultPermissions = useMemo(
    () => (companyData?.employeeSettings?.defaultPermissions as Permission[] | undefined) ?? [
      ...EMPLOYEE_DEFAULT_PERMISSIONS,
    ],
    [companyData]
  );

  useEffect(() => {
    setApprovalPermissions([...defaultPermissions]);
  }, [defaultPermissions]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-employees'],
    queryFn: async () => (await api.get('/admin/employees')).data,
    enabled: !isPendingView,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['admin-employees-pending'],
    queryFn: async () => (await api.get('/admin/employees/pending')).data,
    enabled: isPendingView,
  });

  const rows: EmployeeRow[] = isPendingView ? pendingData?.data || [] : data?.data || [];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-employees-pending'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-notifications-unread'] });
  };

  const createMutation = useMutation({
    mutationFn: (body: EmployeeForm) => api.post('/admin/employees', body),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setForm({ ...emptyForm(), permissions: [...defaultPermissions] });
      toast.success('Employee created');
    },
    onError: () => toast.error('Failed to create employee'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<EmployeeForm> }) =>
      api.patch(`/admin/employees/${id}`, body),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm());
      toast.success('Employee updated');
    },
    onError: () => toast.error('Failed to update employee'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/employees/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success('Employee deleted');
    },
    onError: () => toast.error('Failed to delete employee'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/admin/employees/${id}/approve`, { permissions: approvalPermissions }),
    onSuccess: () => {
      invalidate();
      toast.success('Employee approved');
    },
    onError: () => toast.error('Failed to approve employee'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/employees/${id}/reject`),
    onSuccess: () => {
      invalidate();
      toast.success('Registration rejected');
    },
    onError: () => toast.error('Failed to reject registration'),
  });

  const accessMutation = useMutation({
    mutationFn: ({ id, accessEnabled }: { id: string; accessEnabled: boolean }) =>
      api.patch(`/admin/employees/${id}`, { accessEnabled }),
    onSuccess: (_data, variables) => {
      invalidate();
      toast.success(variables.accessEnabled ? 'Employee access enabled' : 'Employee access disabled');
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update employee access';
      toast.error(message);
    },
  });

  const startCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm(), permissions: [...defaultPermissions] });
    setShowForm(true);
  };

  const startEdit = (row: EmployeeRow) => {
    const user = row.userId;
    setEditId(row._id);
    setForm({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      password: '',
      department: row.department || '',
      designation: row.designation || '',
      permissions: row.permissions?.length ? row.permissions : [...defaultPermissions],
    });
    setShowForm(true);
  };

  if (isLoading || pendingLoading) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Link
            to="/admin/employees"
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
              !isPendingView ? 'bg-primary text-white' : 'bg-white text-gray-700 border border-gray-200'
            )}
          >
            All employees
          </Link>
          <Link
            to="/admin/employees/pending"
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
              isPendingView ? 'bg-primary text-white' : 'bg-white text-gray-700 border border-gray-200'
            )}
          >
            Pending approvals
          </Link>
        </div>
        {!isPendingView && (
          <Button onClick={() => (showForm ? setShowForm(false) : startCreate())}>
            {showForm ? 'Close' : 'Add employee'}
          </Button>
        )}
      </div>

      {showForm && !isPendingView && (
        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (editId) {
                const { password, email, ...rest } = form;
                const body: Partial<EmployeeForm> = { ...rest };
                if (password) body.password = password;
                updateMutation.mutate({ id: editId, body });
                return;
              }
              createMutation.mutate(form);
            }}
          >
            <h2 className="text-lg font-semibold text-gray-900">
              {editId ? 'Edit employee' : 'Create employee'}
            </h2>
            <EmployeeFormFields
              form={form}
              onChange={setForm}
              includePassword={!editId}
            />
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editId ? 'Save changes' : 'Create employee'}
            </Button>
          </form>
        </Card>
      )}

      {isPendingView ? (
        <div className="space-y-4">
          {rows.length === 0 ? (
            <Card className="text-sm text-gray-500">No pending employee registrations.</Card>
          ) : (
            rows.map((row) => {
              const user = row.userId;
              return (
                <Card key={row._id} className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      {user?.firstName} {user?.lastName}
                    </h3>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                    {(row.department || row.designation) && (
                      <p className="mt-1 text-sm text-gray-600">
                        {[row.designation, row.department].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <PermissionCheckboxes
                    value={approvalPermissions}
                    onChange={setApprovalPermissions}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => approveMutation.mutate(row._id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => rejectMutation.mutate(row._id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <DataTable
          columns={[
            {
              key: 'userId',
              label: 'Name',
              render: (row: EmployeeRow) => {
                const user = row.userId;
                return `${user?.firstName || ''} ${user?.lastName || ''} (${user?.email || ''})`;
              },
            },
            { key: 'department', label: 'Department' },
            { key: 'designation', label: 'Designation' },
            {
              key: 'access',
              label: 'Access',
              render: (row: EmployeeRow) => {
                const user = row.userId;
                const isPending = user?.status === 'pending';
                const hasAccess = user?.hasAccess ?? user?.status === 'active';
                return (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={hasAccess}
                      disabled={isPending || accessMutation.isPending}
                      label={hasAccess ? 'Employee access enabled' : 'Employee access disabled'}
                      onChange={(enabled) =>
                        accessMutation.mutate({ id: row._id, accessEnabled: enabled })
                      }
                    />
                    <span className="text-xs text-gray-500">{hasAccess ? 'On' : 'Off'}</span>
                  </div>
                );
              },
            },
            {
              key: 'status',
              label: 'Status',
              render: (row: EmployeeRow) => <EmployeeStatusBadge user={row.userId} />,
            },
            {
              key: 'lastLogin',
              label: 'Last login',
              render: (row: EmployeeRow) => {
                const lastLogin = row.userId?.lastLogin;
                if (!lastLogin) return '—';
                return new Date(lastLogin).toLocaleString();
              },
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (row: EmployeeRow) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(row)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => deleteMutation.mutate(row._id)}
                  >
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
          data={rows}
          keyField="_id"
        />
      )}
    </div>
  );
}
