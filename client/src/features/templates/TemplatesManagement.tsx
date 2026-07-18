import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import type { TemplateDocument, TemplateSummary } from '@invogen/shared';
import api from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { TemplateGallery } from '@/features/template-gallery';
import {
  isTemplateNameTaken,
  suggestTemplateName,
} from '@/features/template-gallery/CustomizeTemplateDialog';
import { primeTemplateCache } from '@/features/template-gallery/template-loader';
import { recordTemplateUse } from '@/features/template-gallery/template-manager';
import { confirmToast } from '@/lib/confirm-toast';
import { toast } from 'sonner';

import { TEMPLATE_CATEGORIES, defaultTemplateName } from '@/pages/super-admin/template-categories';

const selectClass =
  'w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

/** Sentinel value in the system-template dropdown for a blank custom template. */
const CUSTOM_TEMPLATE_OPTION = '__custom__';

const emptyCreateForm = () => ({
  name: '',
  sourceTemplateId: '',
  category: '',
  description: '',
  startBlank: false,
});

export interface TemplatesManagementProps {
  apiBase: string;
  queryKey: string;
  editPathPrefix: string;
  /** Open company templates in the layout editor. */
  canEditTemplates?: boolean;
  /** Add Template button and fork system templates into new copies. */
  canCreateTemplates: boolean;
  planCanAddTemplate: boolean;
  allowedTemplateIds?: string[] | null;
  planSyncOptions?: {
    staleTime?: number;
    refetchOnWindowFocus?: boolean;
    refetchOnReconnect?: boolean;
    refetchInterval?: number;
    refetchIntervalInBackground?: boolean;
  };
  createBlockedMessage?: string;
  /** Show view action that opens the invoice composer editor. */
  enablePreviewActions?: boolean;
  composerPath?: (templateId: string) => string;
  templateViewPath?: (templateId: string) => string;
  composerReturnPath?: string;
}

export function TemplatesManagement({
  apiBase,
  queryKey,
  editPathPrefix,
  canEditTemplates = true,
  canCreateTemplates,
  planCanAddTemplate,
  allowedTemplateIds,
  planSyncOptions,
  createBlockedMessage = 'Creating custom templates is not available on your plan',
  enablePreviewActions = false,
  composerPath,
  templateViewPath,
  composerReturnPath,
}: TemplatesManagementProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [nameTouched, setNameTouched] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [forkingId, setForkingId] = useState<string | null>(null);

  const { data: allTemplates = [] } = useQuery({
    queryKey: [queryKey, 'all'],
    queryFn: async () =>
      (await api.get(apiBase, { params: { limit: 200 } })).data.data as TemplateSummary[],
    ...planSyncOptions,
  });

  const { data: systemTemplates = [], isLoading: systemTemplatesLoading } = useQuery({
    queryKey: [queryKey, 'system', allowedTemplateIds],
    queryFn: async () =>
      (await api.get(apiBase, { params: { limit: 200, systemOnly: 'true' } })).data
        .data as TemplateSummary[],
    enabled: canCreateTemplates,
    ...planSyncOptions,
  });

  const planSystemTemplates = useMemo(() => {
    if (allowedTemplateIds === null || allowedTemplateIds === undefined) {
      return systemTemplates;
    }
    const allowed = new Set(allowedTemplateIds.map(String));
    return systemTemplates.filter((template) => allowed.has(String(template._id)));
  }, [allowedTemplateIds, systemTemplates]);

  const companyTemplates = useMemo(
    () => allTemplates.filter((template) => !template.isSystem),
    [allTemplates]
  );

  const companyTemplateNames = useMemo(
    () => new Set(companyTemplates.map((template) => template.name)),
    [companyTemplates]
  );

  const sortedSystemTemplates = useMemo(
    () =>
      [...planSystemTemplates].sort(
        (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
      ),
    [planSystemTemplates]
  );

  const existingNamesForCategory = (category: string) =>
    companyTemplates
      .filter((template) => template.category === category)
      .map((template) => template.name);

  const selectedSystemTemplate = useMemo(
    () => sortedSystemTemplates.find((template) => template._id === createForm.sourceTemplateId),
    [createForm.sourceTemplateId, sortedSystemTemplates]
  );

  const resetCreateModal = () => {
    setShowCreate(false);
    setCreateForm(emptyCreateForm());
    setNameTouched(false);
  };

  const createFromSystem = async (template: TemplateSummary, name: string, description?: string) => {
    const res = await api.post(apiBase, {
      name,
      category: template.category,
      sourceTemplateId: template._id,
      description: description || template.description || undefined,
    });
    return res.data.data as TemplateDocument;
  };

  const createBlankCustom = async (payload: {
    name: string;
    category: string;
    description?: string;
  }) => {
    const res = await api.post(apiBase, {
      name: payload.name,
      category: payload.category,
      description: payload.description,
      startBlank: true,
    });
    return res.data.data as TemplateDocument;
  };

  const createMutation = useMutation({
    mutationFn: (payload:
      | { mode: 'system'; template: TemplateSummary; name: string; description?: string }
      | { mode: 'blank'; name: string; category: string; description?: string }
    ) =>
      payload.mode === 'blank'
        ? createBlankCustom(payload)
        : createFromSystem(payload.template, payload.name, payload.description),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.invalidateQueries({ queryKey: [queryKey, 'all'] });
      queryClient.invalidateQueries({ queryKey: [queryKey, 'system'] });
      resetCreateModal();
      setForkingId(null);
      if (created.pages?.length) {
        primeTemplateCache(created);
      }
      toast.success(created.name ? `Template "${created.name}" created` : 'Template created');
      if (created._id) {
        navigate(`${editPathPrefix}/${created._id}/edit`, {
          state: { freshTemplate: created },
        });
      }
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setForkingId(null);
      toast.error(err.response?.data?.message || 'Failed to create template');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${apiBase}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.invalidateQueries({ queryKey: [queryKey, 'all'] });
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

  const handleSystemTemplateChange = (templateId: string) => {
    if (templateId === CUSTOM_TEMPLATE_OPTION) {
      setCreateForm((form) => ({
        ...form,
        sourceTemplateId: CUSTOM_TEMPLATE_OPTION,
        startBlank: true,
        category: form.category || 'Custom',
        name: !nameTouched ? defaultTemplateName(form.category || 'Custom') : form.name,
        description: '',
      }));
      return;
    }

    const template = sortedSystemTemplates.find((item) => item._id === templateId);
    const name =
      !nameTouched && template
        ? suggestTemplateName(template.name, companyTemplateNames)
        : createForm.name;
    setCreateForm((form) => ({
      ...form,
      sourceTemplateId: templateId,
      startBlank: false,
      category: template?.category || form.category,
      name,
      description: template?.description || form.description,
    }));
  };

  const forkSystemTemplateForEdit = (template: TemplateSummary) => {
    if (!canEditTemplates) {
      toast.error('You do not have permission to edit templates');
      return;
    }
    if (!planCanAddTemplate) {
      toast.error(createBlockedMessage);
      return;
    }
    const name = suggestTemplateName(template.name, companyTemplateNames);
    setForkingId(template._id);
    createMutation.mutate({
      mode: 'system',
      template,
      name,
      description: template.description,
    });
  };

  const openComposerEditor = (template: TemplateSummary) => {
    if (!composerPath) return;
    recordTemplateUse(template._id);
    navigate(composerPath(template._id), {
      state: composerReturnPath ? { returnTo: composerReturnPath } : undefined,
    });
  };

  const openTemplateView = (template: TemplateSummary) => {
    if (templateViewPath) {
      recordTemplateUse(template._id);
      navigate(templateViewPath(template._id));
      return;
    }
    openComposerEditor(template);
  };

  const handleEditTemplate = (template: TemplateSummary) => {
    if (!canEditTemplates) {
      toast.error('You do not have permission to edit templates');
      return;
    }
    navigate(`${editPathPrefix}/${template._id}/edit`);
  };

  const handleOpenTemplate = (template: TemplateSummary) => {
    // Card / recent click → live preview when configured; never open the builder here.
    if (enablePreviewActions && templateViewPath) {
      openTemplateView(template);
      return;
    }
    if (enablePreviewActions && composerPath) {
      openComposerEditor(template);
      return;
    }
    handleEditTemplate(template);
  };

  const canEditTemplateCard = (template: TemplateSummary) => {
    if (!canEditTemplates) return false;
    if (!template.isSystem) return true;
    return planCanAddTemplate;
  };

  const createNameTaken = isTemplateNameTaken(createForm.name, companyTemplateNames);
  const isCustomBlank = createForm.startBlank || createForm.sourceTemplateId === CUSTOM_TEMPLATE_OPTION;
  const canSubmitCreate = Boolean(
    createForm.name.trim()
    && !createMutation.isPending
    && !createNameTaken
    && (isCustomBlank
      ? createForm.category.trim()
      : selectedSystemTemplate)
  );

  const handleSubmitCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmitCreate) return;

    if (isCustomBlank) {
      createMutation.mutate({
        mode: 'blank',
        name: createForm.name.trim(),
        category: createForm.category.trim(),
        description: createForm.description.trim() || undefined,
      });
      return;
    }

    if (!selectedSystemTemplate) return;
    createMutation.mutate({
      mode: 'system',
      template: selectedSystemTemplate,
      name: createForm.name.trim(),
      description: createForm.description.trim() || undefined,
    });
  };

  const subtitle = enablePreviewActions
    ? canCreateTemplates
      ? 'Click a template for live preview. Use the pencil to edit layout in the builder, or Open Editor from preview to create an invoice.'
      : planCanAddTemplate
        ? 'Click a template for live preview. Use the pencil to edit layout in the builder.'
        : 'Click a template for live preview. Creating custom templates is not included in your plan.'
    : canCreateTemplates
      ? 'Edit templates or use Add Template to copy a system layout or start a blank custom template.'
      : canEditTemplates
        ? 'Edit templates — system templates open as an auto-named copy. Enable Add templates to create copies with your own name.'
        : planCanAddTemplate
          ? 'Browse templates on your plan.'
          : 'Browse templates available on your plan. Creating custom templates is not included in your plan.';

  return (
    <>
      <TemplateGallery
        apiBase={apiBase}
        queryKey={queryKey}
        editPath={`${editPathPrefix}/:id/edit`}
        title="Template Gallery"
        subtitle={subtitle}
        headerActions={
          canCreateTemplates ? (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Template
            </Button>
          ) : undefined
        }
        onOpenTemplate={handleOpenTemplate}
        onEditTemplate={(template) => {
          if (!canEditTemplateCard(template)) return;
          handleEditTemplate(template);
        }}
        canEditTemplate={canEditTemplateCard}
        canOpenTemplate={() => Boolean(enablePreviewActions && templateViewPath)}
        onViewTemplate={
          enablePreviewActions && templateViewPath
            ? (template) => openTemplateView(template)
            : undefined
        }
        onDeleteTemplate={(template) => void handleDeleteTemplate(template)}
        canDeleteTemplate={(template) => !template.isSystem}
        deletingTemplateId={deletingId}
      />

      {canCreateTemplates && showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg" glass={false}>
            <CardHeader>
              <CardTitle>Add New Template</CardTitle>
              <p className="text-sm text-gray-500">
                Copy a system template from your plan, or start a blank custom template.
              </p>
            </CardHeader>
            <form className="space-y-4" onSubmit={handleSubmitCreate}>
              <div className="space-y-1.5">
                <label htmlFor="template-source" className="block text-sm font-medium text-gray-700">
                  Template source
                </label>
                <select
                  id="template-source"
                  className={selectClass}
                  value={
                    isCustomBlank ? CUSTOM_TEMPLATE_OPTION : createForm.sourceTemplateId
                  }
                  onChange={(e) => handleSystemTemplateChange(e.target.value)}
                  required
                  disabled={systemTemplatesLoading}
                >
                  <option value="" disabled>
                    {systemTemplatesLoading
                      ? 'Loading templates...'
                      : 'Select a system template or Custom'}
                  </option>
                  <option value={CUSTOM_TEMPLATE_OPTION}>Custom template (start blank)</option>
                  {sortedSystemTemplates.map((template) => (
                    <option key={template._id} value={template._id}>
                      {template.name}
                      {template.category && template.category !== template.name
                        ? ` (${template.category})`
                        : ''}
                    </option>
                  ))}
                </select>
                {isCustomBlank ? (
                  <p className="text-xs text-gray-500">
                    Starts with an empty canvas — design every component yourself in the builder.
                  </p>
                ) : selectedSystemTemplate?.description ? (
                  <p className="text-xs text-gray-500">{selectedSystemTemplate.description}</p>
                ) : null}
                {!isCustomBlank && selectedSystemTemplate && existingNamesForCategory(selectedSystemTemplate.category).length > 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <p className="font-medium">Existing templates for {selectedSystemTemplate.category}:</p>
                    <ul className="mt-1 list-inside list-disc">
                      {existingNamesForCategory(selectedSystemTemplate.category).map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                    <p className="mt-1">Use a different name below to keep both.</p>
                  </div>
                ) : null}
              </div>

              {isCustomBlank ? (
                <div className="space-y-1.5">
                  <label htmlFor="template-category" className="block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <select
                    id="template-category"
                    className={selectClass}
                    value={createForm.category}
                    onChange={(e) => {
                      const category = e.target.value;
                      setCreateForm((form) => ({
                        ...form,
                        category,
                        name: !nameTouched ? defaultTemplateName(category) : form.name,
                      }));
                    }}
                    required
                  >
                    <option value="" disabled>
                      Select a category
                    </option>
                    <option value="Custom">Custom</option>
                    {TEMPLATE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <Input
                label="Your template name"
                required
                value={createForm.name}
                onChange={(e) => {
                  setNameTouched(true);
                  setCreateForm((form) => ({ ...form, name: e.target.value }));
                }}
                placeholder={
                  isCustomBlank
                    ? 'e.g. My Company Invoice'
                    : 'e.g. Travel Agency Invoice (Custom)'
                }
                error={createNameTaken ? 'This name is already used. Choose a different name.' : undefined}
              />

              <Input
                label="Description"
                value={createForm.description}
                onChange={(e) => setCreateForm((form) => ({ ...form, description: e.target.value }))}
                placeholder="Short description shown in the gallery"
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={resetCreateModal}>
                  Cancel
                </Button>
                <Button type="submit" loading={createMutation.isPending} disabled={!canSubmitCreate}>
                  Create & Edit
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {forkingId ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
          <p className="rounded-xl bg-white px-4 py-3 text-sm text-gray-700 shadow-lg">
            Opening template editor…
          </p>
        </div>
      ) : null}
    </>
  );
}
