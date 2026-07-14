import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, PencilLine } from 'lucide-react';
import type { TemplatePage } from '@invogen/shared';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { CompanyBrandingProvider } from '@/features/builder/CompanyBrandingProvider';
import { TaxSettingsProvider } from '@/features/builder/TaxSettingsProvider';
import { ProductSettingsProvider } from '@/features/builder/ProductSettingsProvider';
import { TemplatePreviewPages } from '@/features/builder/TemplatePreviewPages';
import { brandingScopeFromApiBase } from '@/features/builder/company-branding';
import { reflowPagesForPreview } from '@/features/builder/preview-page-reflow';
import {
  applyInvoiceFormToPages,
  buildInitialFormContext,
} from '@/features/invoice-composer/apply-invoice-form';
import { normalizeComposerPages } from '@/features/invoice-composer/invoice-document';
import { extractPlaceholderKeys } from '@/features/template-gallery/placeholder-utils';
import { fetchTemplateDocument } from '@/features/template-gallery/template-loader';
import { recordTemplateUse } from '@/features/template-gallery/template-manager';

export interface TemplateInvoiceLivePreviewPageProps {
  apiBase: string;
  templatesListPath: string;
  composerPath: (templateId: string) => string;
  openEditorLabel?: string;
}

export function TemplateInvoiceLivePreviewPage({
  apiBase,
  templatesListPath,
  composerPath,
  openEditorLabel = 'Open Editor',
}: TemplateInvoiceLivePreviewPageProps) {
  const { templateId = '' } = useParams();
  const navigate = useNavigate();
  const brandingScope = brandingScopeFromApiBase(apiBase);

  const { data: template, isLoading } = useQuery({
    queryKey: ['template-live-preview', apiBase, templateId],
    queryFn: async () => fetchTemplateDocument(apiBase, templateId),
    enabled: Boolean(templateId),
  });

  useEffect(() => {
    if (templateId) recordTemplateUse(templateId);
  }, [templateId]);

  const previewPages = useMemo((): TemplatePage[] => {
    if (!template?.pages?.length) return [];
    const normalized = normalizeComposerPages(template.pages);
    const keys = extractPlaceholderKeys(normalized);
    const context = buildInitialFormContext(keys, undefined, normalized);
    const filled = applyInvoiceFormToPages(normalized, context);
    return reflowPagesForPreview(filled, { trustTableProps: true });
  }, [template]);

  const previewMaxWidth = useMemo(
    () => Math.min(920, Math.max(320, window.innerWidth - 48)),
    []
  );

  if (isLoading || !template) return <Loader fullScreen />;

  const openEditor = () => {
    navigate(composerPath(templateId), {
      state: { returnTo: `${templatesListPath}/${templateId}/preview` },
    });
  };

  return (
    <CompanyBrandingProvider scope={brandingScope}>
      <TaxSettingsProvider scope={brandingScope}>
        <ProductSettingsProvider scope={brandingScope}>
          <div className="flex h-full min-h-0 flex-col bg-gray-50">
            <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:px-6">
              <Link
                to={templatesListPath}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
                title="Back to templates"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-lg font-semibold text-gray-900">{template.name}</h1>
                <p className="text-sm text-gray-500">Live preview with sample invoice data</p>
              </div>
              <Button onClick={openEditor}>
                <PencilLine className="h-4 w-4" />
                {openEditorLabel}
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-8">
              <div className="mx-auto flex max-w-5xl flex-col rounded-xl border border-gray-200 bg-[#eef0f4] shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Live Preview</p>
                    <p className="text-xs text-gray-500">Read-only view — open the editor to make changes</p>
                  </div>
                </div>
                <div className="flex justify-center p-6">
                  <TemplatePreviewPages
                    pages={previewPages}
                    useSampleData={false}
                    trustTableProps
                    autoReflow
                    previewMaxWidth={previewMaxWidth}
                  />
                </div>
              </div>
            </div>
          </div>
        </ProductSettingsProvider>
      </TaxSettingsProvider>
    </CompanyBrandingProvider>
  );
}
