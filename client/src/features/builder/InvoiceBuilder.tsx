import { useEffect, useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TemplateDocument, TemplateSummary } from '@invogen/shared';
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Grid3X3, Plus, Trash2, Save, ArrowLeft, Layers, Eye, PencilLine, Copy,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import {
  undo, redo, setZoom, toggleSnapToGrid, addPage, deletePage, setActivePage, markClean, setTemplateName,
} from '@/store/slices/builderSlice';
import { clearBuilderDraft, saveBuilderDraft } from '@/features/builder/builder-draft';
import { AssetLibrarySidebar } from './asset-library';
import { BuilderCanvas } from './BuilderCanvas';
import { ElementToolbar } from './ElementToolbar';
import { InsertImageMenu } from './InsertImageMenu';
import { PositionFloatingPanel } from './PositionPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { CompanyBrandingProvider } from './CompanyBrandingProvider';
import { TaxSettingsProvider } from './TaxSettingsProvider';
import { ProductSettingsProvider } from './ProductSettingsProvider';
import { brandingScopeFromApiBase } from './company-branding';
import { Button } from '@/components/ui/Button';
import api from '@/api/client';
import { toast } from 'sonner';
import { TemplatePreviewModal } from './TemplatePreviewModal';
import { TemplateRenameDialog } from './TemplateRenameDialog';
import { TemplateDuplicateDialog } from './TemplateDuplicateDialog';
import { suggestTemplateName } from '@/features/template-gallery/CustomizeTemplateDialog';
import {
  invalidateTemplateCache,
  publishSavedTemplateDocument,
  primeTemplateCache,
} from '@/features/template-gallery/template-loader';

interface InvoiceBuilderProps {
  templateId: string;
  apiBase?: string;
  backTo?: string;
  /** Base path for opening a duplicated template (`{base}/{id}/edit`). Defaults to `backTo`. */
  templatesListPath?: string;
  onSave?: () => void;
  /** Show rename control for company custom templates (admin). */
  allowRename?: boolean;
  /** Show duplicate control when the user may create/add templates. */
  allowDuplicate?: boolean;
}

export function InvoiceBuilder({
  templateId,
  apiBase = '/admin/templates',
  backTo = '/admin/templates',
  templatesListPath,
  onSave,
  allowRename = false,
  allowDuplicate = false,
}: InvoiceBuilderProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pages, activePageIndex, zoom, snapToGrid, isDirty, templateName, historyIndex, history } =
    useAppSelector((s) => s.builder);
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const canDeletePage = pages.length > 1 && activePageIndex > 0;
  const selectedPageName = pages[activePageIndex]?.name ?? 'selected page';
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [positionOpen, setPositionOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  const listNamesEnabled = allowRename || allowDuplicate;
  const { data: companyTemplates = [] } = useQuery({
    queryKey: [apiBase, 'rename', templateId],
    queryFn: async () =>
      (await api.get(apiBase, { params: { limit: 200 } })).data.data as TemplateSummary[],
    enabled: listNamesEnabled,
    staleTime: 0,
  });

  const takenTemplateNames = useMemo(
    () =>
      new Set(
        companyTemplates
          .filter((template) => {
            if (apiBase.includes('super-admin')) return template._id !== templateId;
            return !template.isSystem && template._id !== templateId;
          })
          .map((template) => template.name)
      ),
    [companyTemplates, templateId, apiBase]
  );

  const suggestedDuplicateName = useMemo(
    () => suggestTemplateName(`${templateName} Copy`, takenTemplateNames),
    [templateName, takenTemplateNames]
  );

  const handleDeletePage = () => {
    if (!canDeletePage) return;
    if (!window.confirm(`Delete "${selectedPageName}"? This cannot be undone until you save.`)) return;
    dispatch(deletePage(activePageIndex));
    toast.success('Page deleted');
  };

  const saveTemplate = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Deep-clone so Redux proxies / circular refs cannot break JSON serialization
      // when many pages and components are present.
      const payload = {
        name: templateName,
        pages: JSON.parse(JSON.stringify(pages)) as typeof pages,
      };
      const res = await api.patch(`${apiBase}/${templateId}`, payload);
      const updated = res.data?.data as TemplateDocument | undefined;
      if (updated?._id) {
        publishSavedTemplateDocument(queryClient, apiBase, updated);
      } else {
        invalidateTemplateCache(templateId);
        await queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            if (key[0] === 'template-document' && key[2] === templateId) return true;
            if (key[0] === 'invoice-composer-template' && key[2] === templateId) return true;
            if (key[0] === 'template' && key[1] === templateId) return true;
            if (key[0] === 'super-admin-template' && key[1] === templateId) return true;
            return false;
          },
        });
      }
      dispatch(markClean());
      clearBuilderDraft(templateId);
      toast.success('Template saved');
      onSave?.();
    } catch (error) {
      const message =
        error
        && typeof error === 'object'
        && 'response' in error
        && (error as { response?: { data?: { message?: string }; status?: number } }).response
          ?.data?.message;
      const status =
        error
        && typeof error === 'object'
        && 'response' in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 413) {
        toast.error('Template is too large to save. Remove unused images or split content.');
      } else {
        toast.error(message || 'Failed to save template');
      }
    } finally {
      setSaving(false);
    }
  }, [apiBase, templateId, pages, templateName, dispatch, onSave, saving, queryClient]);

  const duplicateTemplate = useCallback(
    async (payload: { name: string; description: string }) => {
      if (duplicating) return;
      setDuplicating(true);
      try {
        const res = await api.post(`${apiBase}/${templateId}/duplicate`, {
          name: payload.name,
          description: payload.description,
          pages: JSON.parse(JSON.stringify(pages)) as typeof pages,
        });
        const created = res.data?.data as TemplateDocument | undefined;
        if (!created?._id) {
          throw new Error('Missing duplicated template id');
        }
        if (created.pages?.length) {
          primeTemplateCache(created);
        }
        await queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return (
              typeof key[0] === 'string'
              && (String(key[0]).includes('template') || key[0] === apiBase)
            );
          },
        });
        setDuplicateOpen(false);
        toast.success(`Template "${created.name}" created`);
        const listBase = templatesListPath ?? backTo;
        navigate(`${listBase}/${created._id}/edit`, {
          replace: false,
          state: { freshTemplate: created },
        });
      } catch (error) {
        const message =
          error
          && typeof error === 'object'
          && 'response' in error
          && (error as { response?: { data?: { message?: string } } }).response?.data?.message;
        toast.error(message || 'Failed to duplicate template');
      } finally {
        setDuplicating(false);
      }
    },
    [apiBase, templateId, pages, duplicating, queryClient, navigate, backTo, templatesListPath]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 's') {
        event.preventDefault();
        void saveTemplate();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        if (canUndo) dispatch(undo());
        return;
      }
      if ((event.ctrlKey || event.metaKey) && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        if (canRedo) dispatch(redo());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveTemplate, canUndo, canRedo, dispatch]);

  // Auto-save draft to sessionStorage so tab switches don't lose work
  useEffect(() => {
    if (!templateId || !isDirty) return;
    const timer = window.setTimeout(() => {
      saveBuilderDraft({
        templateId,
        templateName,
        pages,
        isDirty: true,
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [templateId, templateName, pages, isDirty]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  return (
    <CompanyBrandingProvider scope={brandingScopeFromApiBase(apiBase)}>
    <TaxSettingsProvider scope={brandingScopeFromApiBase(apiBase)}>
    <ProductSettingsProvider>
    <div className="flex h-full min-h-0 flex-col bg-gray-100">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3">
        <Link
          to={backTo}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100"
          title="Back to templates"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="h-5 w-px bg-gray-200" />
        <span className="max-w-[200px] truncate text-sm font-medium text-gray-800">{templateName}</span>
        <div className="h-5 w-px bg-gray-200" />
        <InsertImageMenu />
        <div className="h-5 w-px bg-gray-200" />
        <Button variant="ghost" size="sm" onClick={() => dispatch(undo())} title="Undo (Ctrl+Z)" disabled={!canUndo}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => dispatch(redo())} title="Redo (Ctrl+Y)" disabled={!canRedo}>
          <Redo2 className="h-4 w-4" />
        </Button>
        <div className="h-5 w-px bg-gray-200" />
        <Button variant="ghost" size="sm" onClick={() => dispatch(setZoom(zoom - 0.1))} title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-xs text-gray-500">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="sm" onClick={() => dispatch(setZoom(zoom + 0.1))} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant={snapToGrid ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => dispatch(toggleSnapToGrid())}
          title="Snap to grid"
        >
          <Grid3X3 className="h-4 w-4" />
        </Button>
        <Button
          variant={positionOpen ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setPositionOpen((open) => !open)}
          title="Position & layers"
        >
          <Layers className="h-4 w-4" />
        </Button>
        <div className="h-5 w-px bg-gray-200" />
        {pages.map((p, i) => (
          <Button
            key={p.id}
            variant={i === activePageIndex ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => dispatch(setActivePage(i))}
          >
            {p.name}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => dispatch(addPage())} title="Add page">
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDeletePage}
          disabled={!canDeletePage}
          title={
            canDeletePage
              ? `Delete ${selectedPageName}`
              : activePageIndex === 0
                ? 'Cannot delete Page 1'
                : 'Cannot delete the only page'
          }
          className="text-gray-600 hover:text-red-600 disabled:hover:text-gray-400"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        {isDirty && !saving && (
          <span className="text-xs text-amber-600">Unsaved changes</span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreviewOpen(true)}
          title="Preview template and share as PDF"
        >
          <Eye className="h-4 w-4" />
          Preview
        </Button>
        {allowRename ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRenameOpen(true)}
            title="Rename template"
          >
            <PencilLine className="h-4 w-4" />
            Rename
          </Button>
        ) : null}
        {allowDuplicate ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDuplicateOpen(true)}
            title="Duplicate template"
            disabled={duplicating}
          >
            <Copy className="h-4 w-4" />
            Duplicate
          </Button>
        ) : null}
        <Button size="sm" onClick={() => void saveTemplate()} loading={saving} disabled={saving}>
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AssetLibrarySidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ElementToolbar />
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <BuilderCanvas />
            <PositionFloatingPanel open={positionOpen} onClose={() => setPositionOpen(false)} />
          </div>
        </div>
        <PropertiesPanel />
      </div>
    </div>
    </ProductSettingsProvider>
    </TaxSettingsProvider>
    <TemplatePreviewModal
      open={previewOpen}
      onClose={() => setPreviewOpen(false)}
      pages={pages}
      templateName={templateName}
      apiBase={apiBase}
    />
    <TemplateRenameDialog
      open={renameOpen}
      currentName={templateName}
      takenNames={takenTemplateNames}
      onClose={() => setRenameOpen(false)}
      onApply={(name) => {
        dispatch(setTemplateName(name));
        setRenameOpen(false);
        toast.success('Template renamed — click Save to keep changes');
      }}
    />
    <TemplateDuplicateDialog
      open={duplicateOpen}
      defaultName={suggestedDuplicateName}
      takenNames={takenTemplateNames}
      loading={duplicating}
      onClose={() => setDuplicateOpen(false)}
      onConfirm={(payload) => void duplicateTemplate(payload)}
    />
    </CompanyBrandingProvider>
  );
}
