import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Copy,
  Download,
  Eye,
  Link2,
  Printer,
  Save,
  Share2,
  Trash2,
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
} from '@/features/builder/template-share';
import { TemplatePreviewPages } from '@/features/builder/TemplatePreviewPages';
import type { PlaceholderContext } from '@/features/template-gallery/placeholder-utils';
import type { TemplatePage } from '@invogen/shared';
import { toast } from 'sonner';
import { confirmToast } from '@/lib/confirm-toast';
import { deleteInvoiceApi } from './invoice-share';
import { ShareInvoiceDialog } from './ShareInvoiceDialog';
import {
  deleteComposerPage,
  normalizeComposerPages,
  updateComposerTableCell,
  updateComposerTableDiscountMode,
  addComposerTableRow,
  deleteComposerTableRow,
  updateComposerTextContent,
  recalculatePagesTables,
  extractTablePlaceholderTotals,
  addComposerFooter,
  deleteComposerFooter,
  addComposerTerms,
  deleteComposerTerms,
  updateComposerTermsTitle,
  updateComposerTermsItem,
  addComposerTermsItem,
  deleteComposerTermsItem,
  updateComposerCardProp,
  addComposerCardCustomField,
  updateComposerCardCustomField,
  deleteComposerCardCustomField,
  deleteComposerCardStandardField,
} from './invoice-document';
import { parseAdminCompanyTax, EMPTY_TAX_SETTINGS } from '@/features/builder/tax-settings';
import { useTaxSettingsQuery } from '@/features/builder/use-tax-settings-query';
import {
  fetchSavedInvoice,
  hydrateComposerFromSavedInvoice,
} from './saved-invoice';

export interface InvoiceComposerConfig {
  apiBase: '/admin' | '/employee';
  templatesApi: string;
  customersApi?: string;
  invoicesApi: string;
  /** React Query key for the invoices list page (must match All Invoices query). */
  invoicesListQueryKey: string[];
  sharesQueryKey?: string[];
  companyApi?: string;
  invoicesListPath: string;
  templatePickPath: string;
  composerPath: string;
  invoiceEditPath: string;
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
  const { templateId = '', invoiceId = '' } = useParams();
  const isEditing = !!invoiceId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const brandingScope = brandingScopeFromApiBase(`${config.templatesApi}`);
  const exportPageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [workingPages, setWorkingPages] = useState<TemplatePage[]>([]);
  const [formContext, setFormContext] = useState<PlaceholderContext>({});
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(invoiceId || null);
  const [sharing, setSharing] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [loadedTemplateId, setLoadedTemplateId] = useState('');

  const { data: template, isLoading: loadingTemplate } = useQuery({
    queryKey: ['invoice-composer-template', config.templatesApi, templateId],
    queryFn: () => fetchTemplateDocument(config.templatesApi, templateId),
    enabled: !!templateId && !isEditing,
  });

  const { data: savedInvoice, isLoading: loadingInvoice } = useQuery({
    queryKey: ['invoice-composer-invoice', config.invoicesApi, invoiceId],
    queryFn: () => fetchSavedInvoice(config.invoicesApi, invoiceId),
    enabled: isEditing,
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

  const { data: queriedTax } = useTaxSettingsQuery('admin');

  const taxSettings = useMemo(() => {
    if (company) return parseAdminCompanyTax(company);
    return queriedTax ?? EMPTY_TAX_SETTINGS;
  }, [company, queriedTax]);

  useEffect(() => {
    if (!template || isEditing) return;
    const normalized = normalizeComposerPages(template.pages);
    setWorkingPages(normalized);
    const keys = extractPlaceholderKeys(normalized);
    setFormContext(buildInitialFormContext(keys, companyToDefaults(company)));
    setSelectedCustomerId('');
    setSavedInvoiceId(null);
    setLoadedTemplateId(templateId);
  }, [template?._id, company, isEditing, templateId, template]);

  useEffect(() => {
    if (!savedInvoice || !isEditing) return;
    const hydrated = hydrateComposerFromSavedInvoice(savedInvoice);
    setWorkingPages(hydrated.pages);
    setFormContext(hydrated.formContext);
    setSelectedCustomerId(hydrated.customerId);
    setSavedInvoiceId(savedInvoice._id);
    setLoadedTemplateId(savedInvoice.templateId ?? '');
  }, [savedInvoice?._id, isEditing, savedInvoice]);

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
        updateComposerTableCell(prev, pageId, elementId, rowId, columnId, value, taxSettings)
      );
    },
    [taxSettings]
  );

  const handleTableDiscountModeChange = useCallback(
    (pageId: string, elementId: string, mode: 'amount' | 'percent') => {
      setWorkingPages((prev) =>
        updateComposerTableDiscountMode(prev, pageId, elementId, mode, taxSettings)
      );
    },
    [taxSettings]
  );

  const handleAddFooter = useCallback((pageId?: string) => {
    setWorkingPages((prev) => addComposerFooter(prev, pageId));
  }, []);

  const handleDeleteFooter = useCallback((pageId: string, elementId: string) => {
    setWorkingPages((prev) => deleteComposerFooter(prev, pageId, elementId));
  }, []);

  const handleAddTerms = useCallback((pageId?: string) => {
    setWorkingPages((prev) => addComposerTerms(prev, pageId));
  }, []);

  const handleDeleteTerms = useCallback((pageId: string, elementId: string) => {
    setWorkingPages((prev) => deleteComposerTerms(prev, pageId, elementId));
  }, []);

  const handleTermsTitleChange = useCallback(
    (pageId: string, elementId: string, title: string) => {
      setWorkingPages((prev) => updateComposerTermsTitle(prev, pageId, elementId, title));
    },
    []
  );

  const handleTermsItemChange = useCallback(
    (pageId: string, elementId: string, itemIndex: number, value: string) => {
      setWorkingPages((prev) =>
        updateComposerTermsItem(prev, pageId, elementId, itemIndex, value)
      );
    },
    []
  );

  const handleAddTermsItem = useCallback((pageId: string, elementId: string) => {
    setWorkingPages((prev) => addComposerTermsItem(prev, pageId, elementId));
  }, []);

  const handleDeleteTermsItem = useCallback(
    (pageId: string, elementId: string, itemIndex: number) => {
      setWorkingPages((prev) => deleteComposerTermsItem(prev, pageId, elementId, itemIndex));
    },
    []
  );

  const handleAddTableRow = useCallback(
    (pageId: string, elementId: string) => {
      setWorkingPages((prev) => addComposerTableRow(prev, pageId, elementId, taxSettings));
    },
    [taxSettings]
  );

  const handleDeleteTableRow = useCallback(
    (pageId: string, elementId: string, rowId: string) => {
      setWorkingPages((prev) =>
        deleteComposerTableRow(prev, pageId, elementId, rowId, taxSettings)
      );
    },
    [taxSettings]
  );

  const handleElementTextChange = useCallback(
    (pageId: string, elementId: string, elementType: string, value: string) => {
      setWorkingPages((prev) =>
        updateComposerTextContent(prev, pageId, elementId, value, elementType)
      );
    },
    []
  );

  const handleCardPropChange = useCallback(
    (pageId: string, elementId: string, key: string, value: string) => {
      setWorkingPages((prev) => updateComposerCardProp(prev, pageId, elementId, key, value));
    },
    []
  );

  const handleAddCardCustomField = useCallback((pageId: string, elementId: string) => {
    setWorkingPages((prev) => addComposerCardCustomField(prev, pageId, elementId));
  }, []);

  const handleUpdateCardCustomField = useCallback(
    (
      pageId: string,
      elementId: string,
      fieldId: string,
      patch: { label?: string; value?: string }
    ) => {
      setWorkingPages((prev) =>
        updateComposerCardCustomField(prev, pageId, elementId, fieldId, patch)
      );
    },
    []
  );

  const handleDeleteCardCustomField = useCallback(
    (pageId: string, elementId: string, fieldId: string) => {
      setWorkingPages((prev) => deleteComposerCardCustomField(prev, pageId, elementId, fieldId));
    },
    []
  );

  const handleDeleteCardStandardField = useCallback(
    (pageId: string, elementId: string, fieldKey: string, formContextKey?: string) => {
      setWorkingPages((prev) =>
        deleteComposerCardStandardField(prev, pageId, elementId, fieldKey)
      );
      if (formContextKey) {
        setFormContext((prev) => ({ ...prev, [formContextKey]: '' }));
      }
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
      if (!nextTemplateId || nextTemplateId === loadedTemplateId) return;
      navigate(config.composerPath.replace(':templateId', nextTemplateId));
    },
    [config.composerPath, navigate, loadedTemplateId]
  );

  const buildSavePayload = () => ({
    templateId: loadedTemplateId || templateId || undefined,
    customerId: selectedCustomerId || undefined,
    customerSnapshot: {
      name: formContext.ClientName,
      email: formContext.Email,
      phone: formContext.Phone,
      gst: formContext.GST,
      address: formContext.Address,
      state: formContext.State,
      placeholders: mergedFormContext,
    },
    templateSnapshot: filledPages,
    lineItems: [{ name: 'Service', quantity: 1, unit: 'pcs', price: 0, discount: 0, tax: 0, total: 0 }],
    totals: { subtotal: 0, discount: 0, tax: 0, total: 0 },
    type: 'tax',
    status: 'draft',
  });

  const displayPages = useMemo(
    () => recalculatePagesTables(workingPages, taxSettings),
    [workingPages, taxSettings]
  );

  const mergedFormContext = useMemo(() => {
    const fromTables = extractTablePlaceholderTotals(displayPages, taxSettings);
    return { ...formContext, ...fromTables };
  }, [formContext, displayPages, taxSettings]);

  const filledPages = useMemo(
    () => (displayPages.length ? applyInvoiceFormToPages(displayPages, mergedFormContext) : []),
    [displayPages, mergedFormContext]
  );

  const templateName = template?.name ?? savedInvoice?.invoiceNumber ?? 'Invoice';

  const sharesQueryKey = config.sharesQueryKey ?? ['admin-invoice-shares'];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildSavePayload();
      if (savedInvoiceId) {
        const res = await api.patch(`${config.invoicesApi}/${savedInvoiceId}`, payload);
        return { ...(res.data.data as { _id: string; invoiceNumber: string }), isNew: false };
      }
      const res = await api.post(config.invoicesApi, payload);
      return { ...(res.data.data as { _id: string; invoiceNumber: string }), isNew: true };
    },
    onSuccess: (invoice) => {
      setSavedInvoiceId(invoice._id);
      if (invoice.invoiceNumber) {
        setFormContext((prev) => ({ ...prev, InvoiceNumber: invoice.invoiceNumber }));
      }
      void queryClient.invalidateQueries({ queryKey: config.invoicesListQueryKey });
      if (isEditing || !invoice.isNew) {
        void queryClient.invalidateQueries({
          queryKey: ['invoice-composer-invoice', config.invoicesApi, invoice._id],
        });
      }
      if (invoice.isNew) {
        navigate(config.invoiceEditPath.replace(':invoiceId', invoice._id), { replace: true });
      }
      toast.success(invoice.isNew ? 'Invoice saved as draft' : 'Invoice updated');
    },
    onError: () => toast.error('Failed to save invoice'),
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      if (!savedInvoiceId) throw new Error('Save the invoice first');
      const res = await api.post(`${config.invoicesApi}/${savedInvoiceId}/duplicate`);
      return res.data.data as { _id: string; invoiceNumber: string };
    },
    onSuccess: (invoice) => {
      void queryClient.invalidateQueries({ queryKey: config.invoicesListQueryKey });
      toast.success('Invoice duplicated — edit the copy');
      navigate(config.invoiceEditPath.replace(':invoiceId', invoice._id));
    },
    onError: () => toast.error('Failed to duplicate invoice'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!savedInvoiceId) throw new Error('No invoice to delete');
      await deleteInvoiceApi(config.invoicesApi, savedInvoiceId);
    },
    onSuccess: () => {
      queryClient.setQueryData(
        config.invoicesListQueryKey,
        (old: { data?: Array<{ _id?: string }> } | undefined) => {
          if (!old?.data || !savedInvoiceId) return old;
          return {
            ...old,
            data: old.data.filter((row) => String(row._id) !== savedInvoiceId),
          };
        }
      );
      void queryClient.invalidateQueries({ queryKey: config.invoicesListQueryKey });
      void queryClient.invalidateQueries({ queryKey: sharesQueryKey });
      toast.success('Invoice deleted');
      navigate(config.invoicesListPath);
    },
    onError: () => toast.error('Failed to delete invoice'),
  });

  const handleDeleteInvoice = async () => {
    const label = formContext.InvoiceNumber || 'draft';
    const ok = await confirmToast(`Delete invoice ${label}?`, {
      description: 'This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (ok) deleteMutation.mutate();
  };

  const getPdfBlob = async () => {
    if (!filledPages.length) throw new Error('No template pages');
    return exportInvoicePreviewPdf(filledPages, exportPageRefs);
  };

  const handleDownloadPdf = async () => {
    try {
      const blob = await getPdfBlob();
      downloadPdfBlob(blob, templatePdfFilename(templateName));
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
      ? `${window.location.origin}${config.invoiceEditPath.replace(':invoiceId', savedInvoiceId)}`
      : window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleSharePdf = async () => {
    if (!savedInvoiceId) {
      toast.message('Save the invoice first, then share a view link');
      return;
    }
    setShareDialogOpen(true);
  };

  const handleShareNative = async () => {
    setSharing(true);
    try {
      const blob = await getPdfBlob();
      const filename = templatePdfFilename(templateName);
      if (canNativeShareFiles()) {
        await nativeSharePdf(blob, filename, templateName);
        toast.success('Shared');
        return;
      }
      downloadPdfBlob(blob, filename);
    } catch {
      toast.error('Share failed');
    } finally {
      setSharing(false);
    }
  };

  if (isEditing) {
    if (loadingInvoice || !savedInvoice) return <Loader />;
  } else if (loadingTemplate || !template) {
    return <Loader />;
  }

  const invoiceLabel = `${formContext.InvoiceNumber || 'Draft'}`.trim();
  const showNativeShare = canNativeShareFiles();
  const invoiceStatus = savedInvoice?.status ?? 'draft';

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-50">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:px-6">
        <Link
          to={isEditing ? config.invoicesListPath : config.templatePickPath}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
          title={isEditing ? 'Back to invoices' : 'Back to templates'}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Invoice' : 'Create Invoice'}
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">{invoiceLabel}</span>
            <Badge variant="warning">{String(invoiceStatus).toUpperCase()}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            <Save className="h-4 w-4" />
            {isEditing ? 'Save Changes' : 'Save Invoice'}
          </Button>
          {savedInvoiceId ? (
            <>
              <Link to={`${config.invoicesListPath}/${savedInvoiceId}/view`}>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4" />
                  View
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)}>
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => duplicateMutation.mutate()}
                loading={duplicateMutation.isPending}
              >
                <Copy className="h-4 w-4" />
                Duplicate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50"
                onClick={() => void handleDeleteInvoice()}
                loading={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : null}
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
          <Button variant="outline" size="sm" onClick={() => void handleSharePdf()}>
            Share link
          </Button>
          {showNativeShare && (
            <Button variant="outline" size="sm" onClick={() => void handleShareNative()} loading={sharing}>
              <Share2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(320px,38%)_1fr] lg:p-6">
        <div className="min-h-0 overflow-auto pr-1">
          <InvoiceComposerForm
            pages={displayPages}
            pageList={workingPages}
            formContext={mergedFormContext}
            onChange={updateField}
            onDeletePage={handleDeletePage}
            onTableCellChange={handleTableCellChange}
            onTableDiscountModeChange={handleTableDiscountModeChange}
            onAddTableRow={handleAddTableRow}
            onDeleteTableRow={handleDeleteTableRow}
            onElementTextChange={handleElementTextChange}
            onAddFooter={handleAddFooter}
            onDeleteFooter={handleDeleteFooter}
            onTermsTitleChange={handleTermsTitleChange}
            onTermsItemChange={handleTermsItemChange}
            onAddTermsItem={handleAddTermsItem}
            onDeleteTermsItem={handleDeleteTermsItem}
            onAddTerms={handleAddTerms}
            onDeleteTerms={handleDeleteTerms}
            onCardPropChange={handleCardPropChange}
            onDeleteCardStandardField={handleDeleteCardStandardField}
            onAddCardCustomField={handleAddCardCustomField}
            onUpdateCardCustomField={handleUpdateCardCustomField}
            onDeleteCardCustomField={handleDeleteCardCustomField}
            customers={customers}
            selectedCustomerId={selectedCustomerId}
            onSelectCustomer={handleSelectCustomer}
          />
        </div>

        <div className="min-h-0 overflow-hidden">
          <InvoiceLivePreview
            pages={filledPages}
            templateName={templateName}
            brandingScope={brandingScope}
            onTableCellChange={handleTableCellChange}
          />
        </div>
      </div>

      <div aria-hidden className="pointer-events-none fixed left-[-10000px] top-0 opacity-0">
        <TemplatePreviewPages
          pages={filledPages}
          useSampleData={false}
          pageRefs={exportPageRefs}
          trustTableProps
        />
      </div>

      {savedInvoiceId ? (
        <ShareInvoiceDialog
          open={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          invoiceId={savedInvoiceId}
          invoicesApi={config.invoicesApi}
          invoiceNumber={invoiceLabel}
          defaultRecipientName={formContext.ClientName}
          defaultRecipientEmail={formContext.Email}
          onShared={() => {
            void queryClient.invalidateQueries({ queryKey: sharesQueryKey });
            void queryClient.invalidateQueries({ queryKey: config.invoicesListQueryKey });
          }}
        />
      ) : null}
    </div>
  );
}
