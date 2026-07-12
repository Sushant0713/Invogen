import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import type { TemplatePage, TemplateSummary } from '@invogen/shared';
import api from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { TemplateGallery } from '@/features/template-gallery';
import { fetchTemplateDocument } from '@/features/template-gallery/template-loader';
import { TemplatePreviewModal } from '@/features/builder/TemplatePreviewModal';
import { confirmToast } from '@/lib/confirm-toast';
import {
  defaultTemplateName,
  SUPER_ADMIN_TEMPLATE_CATEGORY,
  TEMPLATE_CATEGORIES,
} from '@/pages/super-admin/template-categories';
import { toast } from 'sonner';

const selectClass =
  'w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const CUSTOM_CATEGORY = '__custom__';

type WorkspaceVariant = 'standard' | 'super-admin';

const emptyCreateForm = (variant: WorkspaceVariant) => ({
  name: variant === 'super-admin' ? defaultTemplateName(SUPER_ADMIN_TEMPLATE_CATEGORY) : '',
  category: variant === 'super-admin' ? SUPER_ADMIN_TEMPLATE_CATEGORY : '',
  customCategory: '',
  useCustomCategory: false,
  description: '',
});

export function SuperAdminTemplatesWorkspace({ variant }: { variant: WorkspaceVariant }) {
  const isSuperAdminList = variant === 'super-admin';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(() => emptyCreateForm(variant));
  const [nameTouched, setNameTouched] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateSummary | null>(null);
  const [previewPages, setPreviewPages] = useState<TemplatePage[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const listScope = isSuperAdminList ? 'super_admin' : 'standard';
  const galleryQueryKey = isSuperAdminList ? 'super-admin-templates-sa' : 'super-admin-templates';

  const { data: allTemplates } = useQuery({
    queryKey: ['super-admin-templates-categories', listScope],
    queryFn: async () =>
      (
        await api.get('/super-admin/templates', {
          params: { limit: 200, scope: listScope },
        })
      ).data.data as TemplateSummary[],
  });

  const usedCategories = useMemo(
    () =>
      new Set(
        (allTemplates || [])
          .map((t) => t.category)
          .filter((category) => category !== SUPER_ADMIN_TEMPLATE_CATEGORY)
      ),
    [allTemplates]
  );

  const availableCategories = useMemo(
    () => TEMPLATE_CATEGORIES.filter((c) => !usedCategories.has(c)),
    [usedCategories]
  );

  const resolvedCategory = isSuperAdminList
    ? SUPER_ADMIN_TEMPLATE_CATEGORY
    : createForm.useCustomCategory
      ? createForm.customCategory.trim()
      : createForm.category.trim();

  const resetCreateModal = () => {
    setShowCreate(false);
    setCreateForm(emptyCreateForm(variant));
    setNameTouched(false);
  };

  const invalidateTemplateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['super-admin-templates'] });
    queryClient.invalidateQueries({ queryKey: ['super-admin-templates-sa'] });
    queryClient.invalidateQueries({ queryKey: ['super-admin-templates-categories'] });
    queryClient.invalidateQueries({ queryKey: ['super-admin-templates-for-plans'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; category: string; description?: string }) =>
      api.post('/super-admin/templates', payload),
    onSuccess: (res) => {
      invalidateTemplateQueries();
      resetCreateModal();
      toast.success('Template created');
      const id = res.data.data?._id;
      if (id) navigate(`/super-admin/templates/${id}/edit`);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to create template');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/super-admin/templates/${id}`),
    onSuccess: () => {
      invalidateTemplateQueries();
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
      description: 'This removes the system template for all clients. This cannot be undone.',
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

  const openCreateModal = () => {
    setCreateForm(emptyCreateForm(variant));
    setNameTouched(false);
    setShowCreate(true);
  };

  const handleViewTemplate = async (template: TemplateSummary) => {
    setPreviewLoading(true);
    setPreviewTemplate(template);
    try {
      const doc = await fetchTemplateDocument('/super-admin/templates', template._id);
      setPreviewPages(doc.pages ?? []);
    } catch {
      toast.error('Failed to load template preview');
      setPreviewTemplate(null);
      setPreviewPages([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewTemplate(null);
    setPreviewPages([]);
  };

  return (
    <>
      <TemplateGallery
        apiBase="/super-admin/templates"
        queryKey={galleryQueryKey}
        listScope={listScope}
        hideCategoryFilters={isSuperAdminList}
        editPath="/super-admin/templates/:id/edit"
        title={isSuperAdminList ? 'Super Admin Templates' : 'Template Settings'}
        subtitle={
          isSuperAdminList
            ? 'Internal super-admin templates — stored under the Super Admin category.'
            : 'Manage system invoice templates — previews are rendered from live document JSON, never screenshots.'
        }
        headerActions={
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            Add Template
          </Button>
        }
        onDeleteTemplate={(template) => void handleDeleteTemplate(template)}
        deletingTemplateId={deletingId}
        onViewTemplate={(template) => void handleViewTemplate(template)}
      />

      <TemplatePreviewModal
        open={Boolean(previewTemplate) && !previewLoading && previewPages.length > 0}
        onClose={closePreview}
        pages={previewPages}
        templateName={previewTemplate?.name ?? 'Template'}
        apiBase="/super-admin/templates"
      />

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card
            className={`w-full max-w-lg ${isSuperAdminList ? 'ring-2 ring-red-500/40' : ''}`}
            glass={false}
          >
            <CardHeader>
              <CardTitle>Add New Template</CardTitle>
              <p className="text-sm text-gray-500">
                {isSuperAdminList
                  ? 'Creates a template in the Super Admin category.'
                  : 'Create a blank template and design it in the editor'}
              </p>
              {isSuperAdminList && (
                <span className="inline-flex w-fit items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                  Super Admin Category
                </span>
              )}
            </CardHeader>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {!isSuperAdminList && (
                <div className="space-y-1.5">
                  <label htmlFor="template-category" className="block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <select
                    id="template-category"
                    className={selectClass}
                    value={createForm.useCustomCategory ? CUSTOM_CATEGORY : createForm.category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    required={!createForm.useCustomCategory}
                  >
                    <option value="" disabled>
                      Select a category
                    </option>
                    {availableCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                    <option value={CUSTOM_CATEGORY}>Custom category...</option>
                  </select>
                </div>
              )}

              {createForm.useCustomCategory && !isSuperAdminList && (
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
