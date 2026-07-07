import { useEffect, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { TemplateDocument } from '@invogen/shared';
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Grid3X3, Plus, Trash2, Save, ArrowLeft, Layers, Eye,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import {
  undo, redo, setZoom, toggleSnapToGrid, addPage, deletePage, setActivePage, markClean,
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
import { brandingScopeFromApiBase } from './company-branding';
import { Button } from '@/components/ui/Button';
import api from '@/api/client';
import { toast } from 'sonner';
import { TemplatePreviewModal } from './TemplatePreviewModal';
import {
  invalidateTemplateCache,
  publishSavedTemplateDocument,
} from '@/features/template-gallery/template-loader';

interface InvoiceBuilderProps {
  templateId: string;
  apiBase?: string;
  backTo?: string;
  onSave?: () => void;
}

export function InvoiceBuilder({
  templateId,
  apiBase = '/admin/templates',
  backTo = '/admin/templates',
  onSave,
}: InvoiceBuilderProps) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { pages, activePageIndex, zoom, snapToGrid, isDirty, templateName, historyIndex, history } =
    useAppSelector((s) => s.builder);
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const canDeletePage = pages.length > 1;
  const [saving, setSaving] = useState(false);
  const [positionOpen, setPositionOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleDeletePage = () => {
    if (!canDeletePage) return;
    const pageName = pages[activePageIndex]?.name ?? 'this page';
    if (!window.confirm(`Delete "${pageName}"? This cannot be undone until you save.`)) return;
    dispatch(deletePage(activePageIndex));
    toast.success('Page deleted');
  };

  const saveTemplate = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await api.patch(`${apiBase}/${templateId}`, { pages, name: templateName });
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
    } catch {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  }, [apiBase, templateId, pages, templateName, dispatch, onSave, saving, queryClient]);

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
          title={canDeletePage ? 'Delete current page' : 'At least one page is required'}
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
    </TaxSettingsProvider>
    <TemplatePreviewModal
      open={previewOpen}
      onClose={() => setPreviewOpen(false)}
      pages={pages}
      templateName={templateName}
      apiBase={apiBase}
    />
    </CompanyBrandingProvider>
  );
}
