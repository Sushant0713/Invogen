import { useMemo, type ReactNode } from 'react';
import type { TemplatePage } from '@invogen/shared';
import { TemplatePreviewPages } from '@/features/builder/TemplatePreviewPages';
import { CompanyBrandingProvider } from '@/features/builder/CompanyBrandingProvider';
import { TaxSettingsProvider } from '@/features/builder/TaxSettingsProvider';
import { MadeWithInvogenProvider } from '@/features/builder/MadeWithInvogenProvider';
import type { CompanyBrandingScope } from '@/features/builder/company-branding';
import { normalizeComposerPages } from '@/features/invoice-composer/invoice-document';
import { layoutDocumentPages } from '@/features/builder/document-layout';

interface InvoiceViewerProps {
  pages: TemplatePage[];
  previewMaxWidth?: number;
  brandingScope?: CompanyBrandingScope;
  className?: string;
  /**
   * Explicit plan advertising flag (e.g. public share links).
   * When omitted, uses ambient MadeWithInvogenProvider from Admin/Employee layout.
   */
  madeWithInvogen?: boolean;
}

/** Read-only invoice preview (no editing). */
export function InvoiceViewer({
  pages,
  previewMaxWidth,
  brandingScope = 'admin',
  className = '',
  madeWithInvogen,
}: InvoiceViewerProps) {
  const renderPages = useMemo(() => {
    const normalized = normalizeComposerPages(pages);
    return layoutDocumentPages(normalized);
  }, [pages]);

  const content = (
    <div className={`flex justify-center ${className}`}>
      <TemplatePreviewPages
        pages={renderPages}
        useSampleData={false}
        trustTableProps
        previewMaxWidth={previewMaxWidth}
      />
    </div>
  );

  const withProviders = (node: ReactNode) => (
    <CompanyBrandingProvider scope={brandingScope}>
      <TaxSettingsProvider scope={brandingScope}>{node}</TaxSettingsProvider>
    </CompanyBrandingProvider>
  );

  if (madeWithInvogen !== undefined) {
    return withProviders(
      <MadeWithInvogenProvider source="none" forcedShow={madeWithInvogen}>
        {content}
      </MadeWithInvogenProvider>
    );
  }

  return withProviders(content);
}
