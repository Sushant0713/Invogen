import { useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Download, Printer } from 'lucide-react';
import type { TemplatePage } from '@invogen/shared';
import type { PlaceholderContext } from '@/features/template-gallery/placeholder-utils';
import { TemplatePreviewPages } from '@/features/builder/TemplatePreviewPages';
import { CompanyBrandingProvider } from '@/features/builder/CompanyBrandingProvider';
import { TaxSettingsProvider } from '@/features/builder/TaxSettingsProvider';
import { type CompanyBrandingScope } from '@/features/builder/company-branding';
import { Button } from '@/components/ui/Button';
import {
  downloadPdfBlob,
  exportTemplatePagesToPdf,
  templatePdfFilename,
} from '@/features/builder/template-pdf-export';
import { getPageDimensions } from '@/features/builder/builder-dnd';
import { toast } from 'sonner';

interface InvoiceLivePreviewProps {
  pages: TemplatePage[];
  /** Omit when `pages` are already fully rendered (placeholders + element edits applied). */
  formContext?: PlaceholderContext;
  templateName: string;
  brandingScope?: CompanyBrandingScope;
}

export function InvoiceLivePreview({
  pages,
  formContext,
  templateName,
  brandingScope = 'admin',
}: InvoiceLivePreviewProps) {
  const exportPageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [exporting, setExporting] = useState(false);
  const previewWidth = useMemo(
    () => Math.min(520, Math.max(280, window.innerWidth * 0.38)),
    []
  );

  const generatePdf = async () => {
    setExporting(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      const nodes = exportPageRefs.current.filter(
        (node): node is HTMLDivElement => node != null
      );
      if (nodes.length === 0) throw new Error('Preview not ready');
      const pageInputs = nodes.map((element, index) => ({
        element,
        size: getPageDimensions(pages[index]),
      }));
      return await exportTemplatePagesToPdf(pageInputs);
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const blob = await generatePdf();
      if (!blob) return;
      downloadPdfBlob(blob, templatePdfFilename(templateName));
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  const handlePrint = async () => {
    try {
      const blob = await generatePdf();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const frame = document.createElement('iframe');
      frame.style.position = 'fixed';
      frame.style.right = '0';
      frame.style.bottom = '0';
      frame.style.width = '0';
      frame.style.height = '0';
      frame.style.border = '0';
      frame.src = url;
      document.body.appendChild(frame);
      frame.onload = () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        window.setTimeout(() => {
          frame.remove();
          URL.revokeObjectURL(url);
        }, 1000);
      };
    } catch {
      toast.error('Failed to print');
    }
  };

  return (
    <CompanyBrandingProvider scope={brandingScope}>
      <TaxSettingsProvider scope={brandingScope}>
        <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-gray-100/80">
          <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Live Preview</p>
              <p className="text-xs text-gray-500">Updates as you type</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleDownloadPdf()}
                loading={exporting}
                title="Download PDF"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handlePrint()}
                loading={exporting}
                title="Print"
              >
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            <TemplatePreviewPages
              pages={pages}
              useSampleData={false}
              placeholderContext={formContext}
              previewMaxWidth={previewWidth}
            />
          </div>
        </div>

        <div
          aria-hidden
          className="pointer-events-none fixed left-[-10000px] top-0 overflow-hidden opacity-0"
        >
          <TemplatePreviewPages
            pages={pages}
            useSampleData={false}
            placeholderContext={formContext}
            pageRefs={exportPageRefs}
          />
        </div>
      </TaxSettingsProvider>
    </CompanyBrandingProvider>
  );
}

export async function exportInvoicePreviewPdf(
  pages: TemplatePage[],
  exportPageRefs: MutableRefObject<(HTMLDivElement | null)[]>
): Promise<Blob> {
  await new Promise((resolve) => window.setTimeout(resolve, 300));
  const nodes = exportPageRefs.current.filter(
    (node): node is HTMLDivElement => node != null
  );
  if (nodes.length === 0) throw new Error('Preview not ready');
  const pageInputs = nodes.map((element, index) => ({
    element,
    size: getPageDimensions(pages[index]),
  }));
  return exportTemplatePagesToPdf(pageInputs);
}
