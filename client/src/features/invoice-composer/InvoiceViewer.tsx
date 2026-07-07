import { useMemo } from 'react';
import type { TemplatePage } from '@invogen/shared';
import { TemplatePreviewPages } from '@/features/builder/TemplatePreviewPages';
import { CompanyBrandingProvider } from '@/features/builder/CompanyBrandingProvider';
import { TaxSettingsProvider } from '@/features/builder/TaxSettingsProvider';
import type { CompanyBrandingScope } from '@/features/builder/company-branding';
import { normalizeComposerPages } from '@/features/invoice-composer/invoice-document';

interface InvoiceViewerProps {
  pages: TemplatePage[];
  previewMaxWidth?: number;
  brandingScope?: CompanyBrandingScope;
  className?: string;
}

/** Read-only invoice preview (no editing). */
export function InvoiceViewer({
  pages,
  previewMaxWidth,
  brandingScope = 'admin',
  className = '',
}: InvoiceViewerProps) {
  const renderPages = useMemo(() => normalizeComposerPages(pages), [pages]);

  return (
    <CompanyBrandingProvider scope={brandingScope}>
      <TaxSettingsProvider scope={brandingScope}>
        <div className={`flex justify-center ${className}`}>
          <TemplatePreviewPages
            pages={renderPages}
            useSampleData={false}
            trustTableProps
            previewMaxWidth={previewMaxWidth}
          />
        </div>
      </TaxSettingsProvider>
    </CompanyBrandingProvider>
  );
}
