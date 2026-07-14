import { useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Download, Printer } from 'lucide-react';
import type { TemplatePage } from '@invogen/shared';
import { TemplatePreviewPages } from '@/features/builder/TemplatePreviewPages';
import { CompanyBrandingProvider } from '@/features/builder/CompanyBrandingProvider';
import { TaxSettingsProvider } from '@/features/builder/TaxSettingsProvider';
import { ProductSettingsProvider } from '@/features/builder/ProductSettingsProvider';
import { type CompanyBrandingScope } from '@/features/builder/company-branding';
import { Button } from '@/components/ui/Button';
import {
  buildExportPageInputs,
  createPdfExportRunner,
  downloadPdfBlob,
  exportTemplatePagesToPdf,
  pagesExportSignature,
  templatePdfFilename,
  waitForExportNodes,
} from '@/features/builder/template-pdf-export';
import { toast } from 'sonner';

interface InvoiceLivePreviewProps {
  pages: TemplatePage[];
  templateName: string;
  brandingScope?: CompanyBrandingScope;
  /** Override auto width — use in nested settings layouts. */
  previewMaxWidth?: number;
  /** When true, parent already wraps branding/tax/product providers. */
  embedded?: boolean;
  className?: string;
}

export function InvoiceLivePreview({
  pages,
  templateName,
  brandingScope = 'admin',
  previewMaxWidth: previewMaxWidthProp,
  embedded = false,
  className = '',
}: InvoiceLivePreviewProps) {
  const exportPageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [exporting, setExporting] = useState(false);
  const exportKeyRef = useRef('');
  const exportRunnerRef = useRef(
    createPdfExportRunner(() => exportKeyRef.current)
  );
  const previewWidth = useMemo(
    () =>
      previewMaxWidthProp ??
      Math.min(520, Math.max(280, window.innerWidth * 0.38)),
    [previewMaxWidthProp]
  );

  const generatePdf = async () => {
    setExporting(true);
    try {
      exportKeyRef.current = pagesExportSignature(pages);
      return await exportRunnerRef.current(async () => {
        const nodes = await waitForExportNodes(exportPageRefs, pages.length);
        return exportTemplatePagesToPdf(buildExportPageInputs(nodes));
      });
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

  const previewBody = (
    <>
        <div className={`flex h-full min-h-[400px] flex-col rounded-xl border border-gray-200 bg-gray-100/80 ${className}`}>
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

          <div className="flex min-h-0 flex-1 justify-center overflow-auto p-4 lg:p-6">
            <TemplatePreviewPages
              pages={pages}
              useSampleData={false}
              previewMaxWidth={previewWidth}
              trustTableProps
              autoReflow={false}
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
            pageRefs={exportPageRefs}
            trustTableProps
            autoReflow={false}
          />
        </div>
    </>
  );

  if (embedded) {
    return previewBody;
  }

  return (
    <CompanyBrandingProvider scope={brandingScope}>
      <TaxSettingsProvider scope={brandingScope}>
        <ProductSettingsProvider>
        {previewBody}
        </ProductSettingsProvider>
      </TaxSettingsProvider>
    </CompanyBrandingProvider>
  );
}

export async function exportInvoicePreviewPdf(
  pages: TemplatePage[],
  exportPageRefs: MutableRefObject<(HTMLDivElement | null)[]>
): Promise<Blob> {
  const nodes = await waitForExportNodes(exportPageRefs, pages.length);
  return exportTemplatePagesToPdf(buildExportPageInputs(nodes));
}
