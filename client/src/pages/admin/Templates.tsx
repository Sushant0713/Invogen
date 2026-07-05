import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import type { TemplateSummary } from '@invogen/shared';
import api from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { TemplateGallery } from '@/features/template-gallery';
import { TEMPLATE_CATEGORIES } from '@/features/template-gallery';
import { defaultTemplateName } from '@/pages/super-admin/template-categories';
import { useSubscriptionStatus } from '@/hooks/useAdminSubscription';
import { confirmToast } from '@/lib/confirm-toast';
import { toast } from 'sonner';

const selectClass =
  'w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const CUSTOM_CATEGORY = '__custom__';

const emptyCreateForm = () => ({
  name: '',
  category: '',
  customCategory: '',
  useCustomCategory: false,
  description: '',
});

export default function AdminTemplates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: subscriptionStatus } = useSubscriptionStatus();
  // Default true only while status is loading / legacy unrestricted plans.
  const canAddTemplate = subscriptionStatus
    ? subscriptionStatus.canAddTemplate !== false
    : true;
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [nameTouched, setNameTouched] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const resolvedCategory = createForm.useCustomCategory
    ? createForm.customCategory.trim()
    : createForm.category.trim();

  const resetCreateModal = () => {
    setShowCreate(false);
    setCreateForm(emptyCreateForm());
    setNameTouched(false);
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; category: string; description?: string }) =>
      api.post('/admin/templates', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      resetCreateModal();
      toast.success('Template created');
      const id = res.data.data?._id;
      if (id) navigate(`/admin/templates/${id}/edit`);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to create template');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      toast.success('Template deleted');
      setDeletingId(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to delete template');
      setDeletingId(null);
    },
  });

  const handleDeleteTemplate = async (template: TemplateSummary) => {
    const confirmed = await confirmToast(`Delete "${template.name}"?`, {
      description: 'This removes your custom template. System templates cannot be deleted.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    setDeletingId(template._id);
    deleteMutation.mutate(template._id);
  };

  const handleCategoryChange = (value: string) => {
    if (value === CUSTOM_CATEGORY) {
      setCreateForm((f) => ({ ...f, useCustomCategory: true, category: '' }));
      return;
    }
    const name = !nameTouched ? defaultTemplateName(value) : createForm.name;
    setCreateForm((f) => ({
      ...f,
      useCustomCategory: false,
      category: value,
      customCategory: '',
      name,
    }));
  };

  const handleCustomCategoryChange = (value: string) => {
    const name = !nameTouched ? defaultTemplateName(value) : createForm.name;
    setCreateForm((f) => ({ ...f, customCategory: value, name }));
  };

  const canSubmit = createForm.name.trim() && resolvedCategory;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    createMutation.mutate({
      name: createForm.name.trim(),
      category: resolvedCategory,
      description: createForm.description.trim() || undefined,
    });
  };

  return (
    <>
      <TemplateGallery
        apiBase="/admin/templates"
        queryKey="admin-templates"
        editPath="/admin/templates/:id/edit"
        title="Template Gallery"
        subtitle={
          canAddTemplate
            ? 'Browse templates available on your plan — each preview is rendered live from editable document JSON.'
            : 'Browse templates available on your plan. Creating custom templates is not included in your plan.'
        }
        headerActions={
          canAddTemplate ? (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Template
            </Button>
          ) : undefined
        }
        onDeleteTemplate={(template) => void handleDeleteTemplate(template)}
        canDeleteTemplate={(template) => !template.isSystem}
        deletingTemplateId={deletingId}
      />

      {canAddTemplate && showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg" glass={false}>
            <CardHeader>
              <CardTitle>Add New Template</CardTitle>
              <p className="text-sm text-gray-500">
                Create a blank custom template and design it in the editor
              </p>
            </CardHeader>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label htmlFor="admin-template-category" className="block text-sm font-medium text-gray-700">
                  Category
                </label>
                <select
                  id="admin-template-category"
                  className={selectClass}
                  value={createForm.useCustomCategory ? CUSTOM_CATEGORY : createForm.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  required={!createForm.useCustomCategory}
                >
                  <option value="" disabled>
                    Select a category
                  </option>
                  {TEMPLATE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                  <option value={CUSTOM_CATEGORY}>Custom category...</option>
                </select>
              </div>

              {createForm.useCustomCategory && (
                <Input
                  label="Custom category"
                  required
                  value={createForm.customCategory}
                  onChange={(e) => handleCustomCategoryChange(e.target.value)}
                  placeholder="e.g. Photography Studio"
                />
              )}

              <Input
                label="Template name"
                required
                value={createForm.name}
                onChange={(e) => {
                  setNameTouched(true);
                  setCreateForm((f) => ({ ...f, name: e.target.value }));
                }}
                placeholder="e.g. Retail Invoice"
              />

              <Input
                label="Description"
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short description shown in the gallery"
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={resetCreateModal}>
                  Cancel
                </Button>
                <Button type="submit" loading={createMutation.isPending} disabled={!canSubmit}>
                  Create & Edit
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
