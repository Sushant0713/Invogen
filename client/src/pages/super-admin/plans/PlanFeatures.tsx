import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { TruncateText } from '@/components/ui/TruncateText';
import { DataTable } from '@/components/ui/DataTable';
import { Loader } from '@/components/ui/Loader';
import { toast } from 'sonner';

interface PlanFeature {
  _id: string;
  name: string;
  key: string;
  description?: string;
  isActive: boolean;
  usageCount?: number;
}

const emptyForm = () => ({
  name: '',
  description: '',
  key: '',
  isActive: true,
});

export default function PlanFeaturesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['plan-features'],
    queryFn: async () => (await api.get('/super-admin/plan-features')).data.data as PlanFeature[],
  });

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editingId
        ? api.patch(`/super-admin/plan-features/${editingId}`, body)
        : api.post('/super-admin/plan-features', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-features'] });
      toast.success(editingId ? 'Feature updated' : 'Feature created');
      resetForm();
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Failed to save feature');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/super-admin/plan-features/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-features'] });
      toast.success('Feature status updated');
    },
    onError: () => toast.error('Failed to update feature status'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/super-admin/plan-features/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-features'] });
      toast.success('Feature deleted');
    },
  });

  const handleEdit = (feature: PlanFeature) => {
    setEditingId(feature._id);
    setForm({
      name: feature.name,
      description: feature.description || '',
      key: feature.key,
      isActive: feature.isActive,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      key: form.key.trim() || undefined,
      isActive: form.isActive,
    });
  };

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setShowForm(true); }}>Add Feature</Button>
      </div>

      {showForm && (
        <Card>
          <h3 className="font-semibold mb-4">{editingId ? 'Edit Feature' : 'New Feature'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="Feature Name"
                placeholder="e.g. Unlimited Invoices"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                label="Key"
                placeholder="unlimited_invoices"
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                disabled={!!editingId}
              />
              <Input
                label="Description"
                className="md:col-span-2"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <Switch
                checked={form.isActive}
                onChange={(isActive) => setForm({ ...form, isActive })}
                label="Feature active"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {form.isActive ? 'Active' : 'Inactive'}
                </p>
                <p className="text-xs text-gray-500">
                  {form.isActive ? 'Feature is available for plan assignment' : 'Feature is hidden from new assignments'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" loading={saveMutation.isPending}>
                {editingId ? 'Update Feature' : 'Save Feature'}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'key', label: 'Key' },
          {
            key: 'description',
            label: 'Description',
            render: (r) => {
              const feature = r as unknown as PlanFeature;
              return <TruncateText text={feature.description} maxLength={30} />;
            },
          },
          {
            key: 'usageCount',
            label: 'Times Used',
            render: (r) => {
              const feature = r as unknown as PlanFeature;
              return (
                <span className="text-sm font-medium text-gray-700 tabular-nums">
                  {feature.usageCount ?? 0}
                </span>
              );
            },
          },
          {
            key: 'isActive',
            label: 'Status',
            render: (r) => {
              const feature = r as unknown as PlanFeature;
              return (
                <div className="flex items-center gap-3">
                  <Switch
                    checked={feature.isActive}
                    disabled={toggleMutation.isPending}
                    onChange={(isActive) => toggleMutation.mutate({ id: feature._id, isActive })}
                    label={`Toggle ${feature.name}`}
                  />
                  <span className={`text-sm ${feature.isActive ? 'text-green-700' : 'text-gray-500'}`}>
                    {feature.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              );
            },
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (r) => {
              const feature = r as unknown as PlanFeature;
              return (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(feature)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => deleteMutation.mutate(feature._id)}>Delete</Button>
                </div>
              );
            },
          },
        ]}
        data={(data || []) as unknown as Record<string, unknown>[]}
        keyField="_id"
      />
    </div>
  );
}
