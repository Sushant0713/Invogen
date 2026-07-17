import { useMemo, type ReactNode } from 'react';
import type { TemplatePage } from '@invogen/shared';
import { TemplatePreviewPages } from '@/features/builder/TemplatePreviewPages';
import { CompanyBrandingProvider } from '@/features/builder/CompanyBrandingProvider';
import { TaxSettingsProvider } from '@/features/builder/TaxSettingsProvider';
import { MadeWithInvogenProvider } from '@/features/builder/MadeWithInvogenProvider';
import type { CompanyBrandingScope } from '@/features/builder/company-branding';
import {
  cloneTemplatePages,
  normalizeComposerPages,
  prepareInvoiceLivePreviewPages,
} from '@/features/invoice-composer/invoice-document';

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
  madeWithImage?: string;
}

/** Read-only invoice preview (no editing). */
export function InvoiceViewer({
  pages,
  previewMaxWidth,
  brandingScope = 'admin',
  className = '',
  madeWithInvogen,
  madeWithImage,
}: InvoiceViewerProps) {
  const renderPages = useMemo(
    () => prepareInvoiceLivePreviewPages(normalizeComposerPages(cloneTemplatePages(pages))),
    [pages]
  );

  const content = (
    <div className={`flex justify-center ${className}`}>
      <TemplatePreviewPages
        pages={renderPages}
        useSampleData={false}
        trustTableProps
        autoReflow={false}
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
      <MadeWithInvogenProvider
        source="none"
        forcedShow={madeWithInvogen}
        forcedImage={madeWithImage}
      >
        {content}
      </MadeWithInvogenProvider>
    );
  }

  return withProviders(content);
}
