import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EMPLOYEE_DEFAULT_PERMISSIONS,
  type EmployeeSettings,
  type Permission,
} from '@invogen/shared';
import api from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { PermissionCheckboxes } from '@/features/employees/PermissionCheckboxes';
import { toast } from 'sonner';

const defaultSettings = (): EmployeeSettings => ({
  allowSelfRegistration: true,
  requireApproval: true,
  defaultPermissions: [...EMPLOYEE_DEFAULT_PERMISSIONS],
  joinCode: '',
});

function normalizeJoinCodeInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function EmployeeSettingsPanel() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['admin-company'],
    queryFn: async () => (await api.get('/admin/company')).data.data,
  });
  const [form, setForm] = useState<EmployeeSettings>(defaultSettings());

  useEffect(() => {
    if (!data?.employeeSettings) return;
    setForm({
      allowSelfRegistration: data.employeeSettings.allowSelfRegistration !== false,
      requireApproval: data.employeeSettings.requireApproval !== false,
      defaultPermissions:
        (data.employeeSettings.defaultPermissions as Permission[] | undefined) ?? [
          ...EMPLOYEE_DEFAULT_PERMISSIONS,
        ],
      joinCode: data.employeeSettings.joinCode || '',
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const joinCode = normalizeJoinCodeInput(form.joinCode);
      if (joinCode.length < 6) {
        throw new Error('Join code must be at least 6 characters');
      }
      return api.patch('/admin/company', {
        employeeSettings: {
          allowSelfRegistration: form.allowSelfRegistration,
          requireApproval: form.requireApproval,
          defaultPermissions: form.defaultPermissions,
          joinCode,
        },
      });
    },
    onSuccess: (response) => {
      const joinCode = response.data.data?.employeeSettings?.joinCode as string | undefined;
      if (joinCode) setForm((prev) => ({ ...prev, joinCode }));
      void queryClient.invalidateQueries({ queryKey: ['admin-company'] });
      toast.success('Employee settings saved');
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (error as Error)?.message ||
        'Failed to save employee settings';
      toast.error(message);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => api.patch('/admin/company', { regenerateJoinCode: true }),
    onSuccess: (response) => {
      const joinCode = response.data.data?.employeeSettings?.joinCode as string | undefined;
      if (joinCode) setForm((prev) => ({ ...prev, joinCode }));
      void queryClient.invalidateQueries({ queryKey: ['admin-company'] });
      toast.success('Join code regenerated');
    },
    onError: () => toast.error('Failed to regenerate join code'),
  });

  const copyJoinCode = async () => {
    if (!form.joinCode) return;
    try {
      await navigator.clipboard.writeText(form.joinCode);
      toast.success('Join code copied');
    } catch {
      toast.error('Could not copy join code');
    }
  };

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Employee access</h2>
        <p className="mt-1 text-sm text-gray-500">
          Control self-registration, default feature access, and the join code employees use to register.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Allow employee self-registration</p>
          <p className="text-xs text-gray-500">Employees can register using your company join code</p>
        </div>
        <Switch
          checked={form.allowSelfRegistration}
          onChange={(value) => setForm({ ...form, allowSelfRegistration: value })}
          label="Allow employee self-registration"
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Require admin approval</p>
          <p className="text-xs text-gray-500">New self-registrations stay pending until you approve them</p>
        </div>
        <Switch
          checked={form.requireApproval}
          onChange={(value) => setForm({ ...form, requireApproval: value })}
          label="Require admin approval"
        />
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Company join code</p>
          <p className="mt-1 text-xs text-gray-500">
            Set your own code or regenerate a random one. Employees use this on the registration page.
          </p>
        </div>
        <Input
          label="Join code"
          value={form.joinCode}
          onChange={(e) =>
            setForm({ ...form, joinCode: normalizeJoinCodeInput(e.target.value) })
          }
          placeholder="e.g. ACME2024"
          maxLength={20}
          className="font-mono tracking-widest uppercase"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void copyJoinCode()}>
            Copy
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
          >
            {regenerateMutation.isPending ? 'Regenerating...' : 'Regenerate random code'}
          </Button>
        </div>
      </div>

      <PermissionCheckboxes
        value={form.defaultPermissions}
        onChange={(defaultPermissions) => setForm({ ...form, defaultPermissions })}
      />

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? 'Saving...' : 'Save employee settings'}
      </Button>
    </Card>
  );
}
