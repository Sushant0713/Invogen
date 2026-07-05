import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  Link2,
  Printer,
  Save,
  Share2,
} from 'lucide-react';
import api from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { Badge } from '@/components/ui/Badge';
import { fetchTemplateDocument } from '@/features/template-gallery/template-loader';
import { extractPlaceholderKeys } from '@/features/template-gallery/placeholder-utils';
import { brandingScopeFromApiBase } from '@/features/builder/company-branding';
import {
  applyInvoiceFormToPages,
  buildInitialFormContext,
  customerToFormPatch,
  type CompanyDefaults,
  type CustomerRecord,
} from './apply-invoice-form';
import { InvoiceComposerForm } from './InvoiceComposerForm';
import { InvoiceLivePreview } from './InvoiceLivePreview';
import {
  downloadPdfBlob,
  templatePdfFilename,
} from '@/features/builder/template-pdf-export';
import { exportInvoicePreviewPdf } from './InvoiceLivePreview';
import {
  canNativeShareFiles,
  nativeSharePdf,
  openEmailShare,
  openWhatsAppShare,
} from '@/features/builder/template-share';
import { TemplatePreviewPages } from '@/features/builder/TemplatePreviewPages';
import type { PlaceholderContext } from '@/features/template-gallery/placeholder-utils';
import type { TemplatePage } from '@invogen/shared';
import { toast } from 'sonner';
import {
  deleteComposerPage,
  normalizeComposerPages,
  updateComposerTableCell,
  updateComposerTextContent,
} from './invoice-document';

export interface InvoiceComposerConfig {
  apiBase: '/admin' | '/employee';
  templatesApi: string;
  customersApi?: string;
  invoicesApi: string;
  companyApi?: string;
  invoicesListPath: string;
  templatePickPath: string;
  composerPath: string;
}

function companyToDefaults(company: Record<string, unknown> | undefined): CompanyDefaults {
  if (!company) return {};
  const settings = company.invoiceSettings as { prefix?: string; nextNumber?: number } | undefined;
  const address = company.address as CompanyDefaults['address'];
  return {
    name: company.name as string | undefined,
    email: company.email as string | undefined,
    phone: company.phone as string | undefined,
    gst: company.gst as string | undefined,
    pan: company.pan as string | undefined,
    address,
    invoicePrefix: settings?.prefix,
    nextInvoiceNumber: settings?.nextNumber,
  };
}

export function InvoiceComposer({ config }: { config: InvoiceComposerConfig }) {
  const { templateId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const brandingScope = brandingScopeFromApiBase(`${config.templatesApi}`);
  const exportPageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [workingPages, setWorkingPages] = useState<TemplatePage[]>([]);
  const [formContext, setFormContext] = useState<PlaceholderContext>({});
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const { data: template, isLoading: loadingTemplate } = useQuery({
    queryKey: ['invoice-composer-template', config.templatesApi, templateId],
    queryFn: () => fetchTemplateDocument(config.templatesApi, templateId),
    enabled: !!templateId,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['invoice-composer-templates', config.templatesApi],
    queryFn: async () => (await api.get(config.templatesApi)).data.data as { _id: string; name: string }[],
  });

  const { data: company } = useQuery({
    queryKey: ['invoice-composer-company', config.companyApi],
    queryFn: async () =>
      config.companyApi
        ? ((await api.get(config.companyApi)).data.data as Record<string, unknown>)
        : undefined,
    enabled: !!config.companyApi,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['invoice-composer-customers', config.customersApi],
    queryFn: async () =>
      config.customersApi
        ? ((await api.get(config.customersApi)).data.data as CustomerRecord[])
        : [],
    enabled: !!config.customersApi,
  });

  useEffect(() => {
    if (!template) return;
    const normalized = normalizeComposerPages(template.pages);
    setWorkingPages(normalized);
    const keys = extractPlaceholderKeys(normalized);
    setFormContext(buildInitialFormContext(keys, companyToDefaults(company)));
    setSelectedCustomerId('');
    setSavedInvoiceId(null);
  }, [template?._id, company]);

  const updateField = useCallback((key: string, value: string) => {
    setFormContext((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleDeletePage = useCallback((pageId: string) => {
    setWorkingPages((prev) => {
      const next = deleteComposerPage(prev, pageId);
      if (next.length === prev.length) {
        toast.error('At least one page is required');
        return prev;
      }
      toast.success('Page removed');
      return next;
    });
  }, []);

  const handleTableCellChange = useCallback(
    (pageId: string, elementId: string, rowId: string, columnId: string, value: string) => {
      setWorkingPages((prev) =>
        updateComposerTableCell(prev, pageId, elementId, rowId, columnId, value)
      );
    },
    []
  );

  const handleElementTextChange = useCallback(
    (pageId: string, elementId: string, elementType: string, value: string) => {
      setWorkingPages((prev) =>
        updateComposerTextContent(prev, pageId, elementId, value, elementType)
      );
    },
    []
  );

  const handleSelectCustomer = useCallback(
    (customerId: string) => {
      setSelectedCustomerId(customerId);
      if (!customerId) return;
      const customer = customers.find((item) => item._id === customerId);
      if (!customer) return;
      setFormContext((prev) => ({ ...prev, ...customerToFormPatch(customer) }));
    },
    [customers]
  );

  const handleSelectTemplate = useCallback(
    (nextTemplateId: string) => {
      if (!nextTemplateId || nextTemplateId === templateId) return;
      navigate(config.composerPath.replace(':templateId', nextTemplateId));
    },
    [config.composerPath, navigate, templateId]
  );

  const filledPages = useMemo(
    () => (workingPages.length ? applyInvoiceFormToPages(workingPages, formContext) : []),
    [workingPages, formContext]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        templateId,
        customerId: selectedCustomerId || undefined,
        customerSnapshot: {
          name: formContext.ClientName,
          email: formContext.Email,
          phone: formContext.Phone,
          gst: formContext.GST,
          address: formContext.Address,
          state: formContext.State,
          placeholders: formContext,
        },
        templateSnapshot: filledPages,
        lineItems: [{ name: 'Service', quantity: 1, unit: 'pcs', price: 0, discount: 0, tax: 0, total: 0 }],
        totals: { subtotal: 0, discount: 0, tax: 0, total: 0 },
        type: 'tax',
        status: 'draft',
      };
      const res = await api.post(config.invoicesApi, payload);
      return res.data.data as { _id: string; invoiceNumber: string };
    },
    onSuccess: (invoice) => {
      setSavedInvoiceId(invoice._id);
      if (invoice.invoiceNumber) {
        setFormContext((prev) => ({ ...prev, InvoiceNumber: invoice.invoiceNumber }));
      }
      queryClient.invalidateQueries({ queryKey: [config.invoicesApi] });
      toast.success('Invoice saved as draft');
    },
    onError: () => toast.error('Failed to save invoice'),
  });

  const getPdfBlob = async () => {
    if (!filledPages.length) throw new Error('No template pages');
    return exportInvoicePreviewPdf(filledPages, exportPageRefs);
  };

  const handleDownloadPdf = async () => {
    try {
      const blob = await getPdfBlob();
      downloadPdfBlob(blob, templatePdfFilename(template?.name ?? 'invoice'));
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  const handlePrint = async () => {
    try {
      const blob = await getPdfBlob();
      const url = URL.createObjectURL(blob);
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
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

  const handleCopyLink = async () => {
    const url = savedInvoiceId
      ? `${window.location.origin}${config.invoicesListPath}/${savedInvoiceId}`
      : window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const blob = await getPdfBlob();
      const filename = templatePdfFilename(template?.name ?? 'invoice');
      if (canNativeShareFiles()) {
        await nativeSharePdf(blob, filename, template?.name ?? 'Invoice');
        toast.success('Shared');
        return;
      }
      downloadPdfBlob(blob, filename);
      openWhatsAppShare(template?.name ?? 'Invoice');
    } catch {
      toast.error('Share failed');
    } finally {
      setSharing(false);
    }
  };

  const handleEmail = async () => {
    try {
      const blob = await getPdfBlob();
      downloadPdfBlob(blob, templatePdfFilename(template?.name ?? 'invoice'));
      openEmailShare(template?.name ?? 'Invoice', templatePdfFilename(template?.name ?? 'invoice'));
    } catch {
      toast.error('Failed to prepare email');
    }
  };

  if (loadingTemplate || !template) return <Loader />;

  const invoiceLabel = `${formContext.InvoiceNumber || 'Draft'}`.trim();
  const showNativeShare = canNativeShareFiles();

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-50">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:px-6">
        <Link
          to={config.templatePickPath}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
          title="Back to templates"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-gray-900">Create Invoice</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">{invoiceLabel}</span>
            <Badge variant="warning">DRAFT</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            <Save className="h-4 w-4" />
            Save Invoice
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleDownloadPdf()}>
            <Download className="h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handlePrint()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleCopyLink()}>
            <Link2 className="h-4 w-4" />
            Link
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleEmail()}>
            Share
          </Button>
          {showNativeShare && (
            <Button variant="outline" size="sm" onClick={() => void handleShare()} loading={sharing}>
              <Share2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(320px,38%)_1fr] lg:p-6">
        <div className="min-h-0 overflow-auto pr-1">
          <InvoiceComposerForm
            pages={workingPages}
            formContext={formContext}
            onChange={updateField}
            onDeletePage={handleDeletePage}
            onTableCellChange={handleTableCellChange}
            onElementTextChange={handleElementTextChange}
            customers={customers}
            selectedCustomerId={selectedCustomerId}
            onSelectCustomer={handleSelectCustomer}
            templates={templates}
            selectedTemplateId={templateId}
            onSelectTemplate={handleSelectTemplate}
          />
        </div>

        <div className="min-h-0 overflow-hidden">
          <InvoiceLivePreview
            pages={filledPages}
            templateName={template.name}
            brandingScope={brandingScope}
          />
        </div>
      </div>

      <div aria-hidden className="pointer-events-none fixed left-[-10000px] top-0 opacity-0">
        <TemplatePreviewPages
          pages={filledPages}
          useSampleData={false}
          pageRefs={exportPageRefs}
        />
      </div>
    </div>
  );
}
