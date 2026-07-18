import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TemplatePage } from '@invogen/shared';
import {
  X,
  Download,
  Mail,
  MessageCircle,
  Share2,
  Loader2,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CompanyBrandingProvider } from './CompanyBrandingProvider';
import { TaxSettingsProvider } from './TaxSettingsProvider';
import { TemplatePreviewPages } from './TemplatePreviewPages';
import {
  buildExportPageInputs,
  downloadPdfBlob,
  exportTemplatePagesToPdf,
  templatePdfFilename,
  waitForExportNodes,
} from './template-pdf-export';
import {
  canNativeShareFiles,
  nativeSharePdf,
  openEmailShare,
  openWhatsAppShare,
} from './template-share';
import { brandingScopeFromApiBase } from './company-branding';
import { toast } from 'sonner';

interface TemplatePreviewModalProps {
  open: boolean;
  onClose: () => void;
  pages: TemplatePage[];
  templateName: string;
  apiBase?: string;
}

function pagesExportKey(pages: TemplatePage[]): string {
  return pages.map((page) => `${page.id}:${page.elements.length}`).join('|');
}

export function TemplatePreviewModal({
  open,
  onClose,
  pages,
  templateName,
  apiBase = '/admin/templates',
}: TemplatePreviewModalProps) {
  const brandingScope = brandingScopeFromApiBase(apiBase);
  const exportPageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pagesRef = useRef(pages);
  const onCloseRef = useRef(onClose);
  const wasOpenRef = useRef(false);
  pagesRef.current = pages;
  onCloseRef.current = onClose;

  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const pdfFilename = templatePdfFilename(templateName);
  const showNativeShare = canNativeShareFiles();
  const exportKey = open ? pagesExportKey(pages) : '';

  const generatePdf = useCallback(async () => {
    setGenerating(true);
    setPdfBlob(null);
    try {
      const nodes = await waitForExportNodes(exportPageRefs, pagesRef.current.length);
      const blob = await exportTemplatePagesToPdf(buildExportPageInputs(nodes));
      setPdfBlob(blob);
    } catch {
      toast.error('Failed to generate PDF preview');
    } finally {
      setGenerating(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        setPdfBlob(null);
        setGenerating(false);
        setSharing(false);
        exportPageRefs.current = [];
      }
      return;
    }

    wasOpenRef.current = true;
    let cancelled = false;

    void (async () => {
      setGenerating(true);
      setPdfBlob(null);
      try {
        const nodes = await waitForExportNodes(exportPageRefs, pagesRef.current.length);
        if (cancelled) return;
        const blob = await exportTemplatePagesToPdf(buildExportPageInputs(nodes));
        if (cancelled) return;
        setPdfBlob(blob);
      } catch {
        if (!cancelled) toast.error('Failed to generate PDF preview');
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, exportKey]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const handleDownload = () => {
    if (!pdfBlob) return;
    downloadPdfBlob(pdfBlob, pdfFilename);
    toast.success('PDF downloaded');
  };

  const handleEmail = () => {
    if (pdfBlob) downloadPdfBlob(pdfBlob, pdfFilename);
    openEmailShare(templateName, pdfFilename);
  };

  const handleWhatsApp = async () => {
    if (showNativeShare && pdfBlob) {
      setSharing(true);
      try {
        const shared = await nativeSharePdf(pdfBlob, pdfFilename, templateName);
        if (shared) {
          toast.success('Shared');
          return;
        }
      } catch {
        // Fall through to WhatsApp web link.
      } finally {
        setSharing(false);
      }
    }
    if (pdfBlob) downloadPdfBlob(pdfBlob, pdfFilename);
    openWhatsAppShare(templateName);
    toast.message('PDF downloaded — attach it in WhatsApp before sending');
  };

  const handleNativeShare = async () => {
    if (!pdfBlob) return;
    setSharing(true);
    try {
      await nativeSharePdf(pdfBlob, pdfFilename, templateName);
      toast.success('Shared');
    } catch {
      toast.error('Share cancelled or not supported');
    } finally {
      setSharing(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <CompanyBrandingProvider scope={brandingScope}>
      <TaxSettingsProvider scope={brandingScope}>
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-preview-title"
          >
            <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Eye className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="template-preview-title" className="truncate text-lg font-semibold text-gray-900">
                  Preview — {templateName}
                </h2>
                <p className="text-sm text-gray-500">
                  Matches the editor layout
                  {pages.length > 1 ? ` · ${pages.length} pages` : ''}. PDF is generated from this preview.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
                aria-label="Close preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-[#eef0f4] p-6">
              <TemplatePreviewPages
                pages={pages}
                useSampleData={false}
                trustTableProps
                autoReflow={false}
                fitDataFields={false}
                previewMaxWidth={Math.min(680, window.innerWidth - 120)}
              />
            </div>

            <div className="shrink-0 border-t border-gray-200 bg-white px-5 py-4">
              <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Generating PDF…
                  </>
                ) : pdfBlob ? (
                  <span className="text-green-700">PDF ready — share or download below</span>
                ) : (
                  <span className="text-amber-700">PDF generation failed — try again</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleDownload}
                  disabled={!pdfBlob || generating}
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEmail}
                  disabled={!pdfBlob || generating}
                >
                  <Mail className="h-4 w-4" />
                  Email
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleWhatsApp()}
                  disabled={!pdfBlob || generating || sharing}
                  loading={sharing}
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
                {showNativeShare && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleNativeShare()}
                    disabled={!pdfBlob || generating || sharing}
                    loading={sharing}
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                )}
                {!pdfBlob && !generating && (
                  <Button variant="ghost" size="sm" onClick={() => void generatePdf()}>
                    Retry PDF
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Off-screen export surface at full resolution for PDF capture */}
          <div
            aria-hidden
            className="pointer-events-none fixed left-[-10000px] top-0 overflow-hidden opacity-0"
          >
            <TemplatePreviewPages
              pages={pages}
              pageRefs={exportPageRefs}
              useSampleData={false}
              trustTableProps
              autoReflow={false}
              fitDataFields={false}
            />
          </div>
        </div>
      </TaxSettingsProvider>
    </CompanyBrandingProvider>,
    document.body
  );
}
