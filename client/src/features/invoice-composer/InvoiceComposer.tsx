import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
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
import { brandingScopeFromApiBase, companyApiForScope } from '@/features/builder/company-branding';
import { CompanyBrandingProvider } from '@/features/builder/CompanyBrandingProvider';
import { TaxSettingsProvider } from '@/features/builder/TaxSettingsProvider';
import {
  applyInvoiceFormToPages,
  buildInitialFormContext,
  customerToFormPatch,
  type CompanyDefaults,
  type CustomerRecord,
} from './apply-invoice-form';
import {
  clampDueDateToInvoiceDate,
  formatIsoDate,
  normalizeInvoiceFormDates,
  parseFlexibleDate,
  toIsoDateValue,
} from '@/lib/date-format';
import { InvoiceComposerForm } from './InvoiceComposerForm';
import { InvoiceLivePreview } from './InvoiceLivePreview';
import { ProductSettingsProvider } from '@/features/builder/ProductSettingsProvider';
import {
  createPdfExportRunner,
  downloadPdfBlob,
  pagesExportSignature,
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
  hydrateComposerTemplatePages,
  prepareInvoiceLivePreviewPages,
  updateComposerTableCell,
  updateComposerProductPick,
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
  updateComposerCardCustomField,
  deleteComposerCardCustomField,
  deleteComposerCardStandardField,
  toggleComposerCardCustomField,
  toggleComposerCardStandardField,
} from './invoice-document';
import { parseAdminCompanyTax, EMPTY_TAX_SETTINGS } from '@/features/builder/tax-settings';
import { parseProductSettings } from '@/features/builder/product-settings';
import { useTaxSettingsQuery } from '@/features/builder/use-tax-settings-query';
import {
  fetchSavedInvoice,
  hydrateComposerFromSavedInvoice,
} from './saved-invoice';
import { useFontsVersion } from '@/features/builder/use-fonts-version';
import { buildInvoiceTotalsFromPlaceholders } from './invoice-totals';

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
  /** When false, hides save and post-save invoice actions (template preview from gallery). */
  canSaveInvoice?: boolean;
  canShareInvoice?: boolean;
  canDuplicateInvoice?: boolean;
  canDeleteInvoice?: boolean;
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
  const location = useLocation();
  const queryClient = useQueryClient();
  const canSaveInvoice = config.canSaveInvoice !== false;
  const canShareInvoice = config.canShareInvoice ?? canSaveInvoice;
  const canDuplicateInvoice = config.canDuplicateInvoice ?? canSaveInvoice;
  const canDeleteInvoice = config.canDeleteInvoice ?? canSaveInvoice;
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
  const backPath =
    returnTo ?? (isEditing ? config.invoicesListPath : config.templatePickPath);
  const brandingScope = brandingScopeFromApiBase(`${config.templatesApi}`);
  const exportPageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [workingPages, setWorkingPages] = useState<TemplatePage[]>([]);
  const [formContext, setFormContext] = useState<PlaceholderContext>({});
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(invoiceId || null);
  const [sharing, setSharing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [loadedTemplateId, setLoadedTemplateId] = useState('');
  const exportKeyRef = useRef('');
  const exportRunnerRef = useRef(
    createPdfExportRunner(() => exportKeyRef.current)
  );

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
    queryKey: ['invoice-composer-company', config.companyApi, brandingScope],
    queryFn: async () =>
      ((await api.get(config.companyApi ?? companyApiForScope(brandingScope))).data.data as Record<
        string,
        unknown
      >),
    enabled: Boolean(config.companyApi) || brandingScope === 'employee' || brandingScope === 'admin',
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['invoice-composer-customers', config.customersApi],
    queryFn: async () =>
      config.customersApi
        ? ((await api.get(config.customersApi)).data.data as CustomerRecord[])
        : [],
    enabled: !!config.customersApi,
  });

  const { data: queriedTax } = useTaxSettingsQuery(brandingScope);

  const taxSettings = useMemo(() => {
    if (company) return parseAdminCompanyTax(company);
    return queriedTax ?? EMPTY_TAX_SETTINGS;
  }, [company, queriedTax]);

  const productSettings = useMemo(() => parseProductSettings(company), [company]);

  useEffect(() => {
    if (!template || isEditing) return;
    const normalized = hydrateComposerTemplatePages(template.pages);
    setWorkingPages(normalized);
    const keys = extractPlaceholderKeys(normalized);
    setFormContext(buildInitialFormContext(keys, companyToDefaults(company), normalized));
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
    setFormContext((prev) => {
      if (key === 'Date') {
        const invoiceIso = toIsoDateValue(value) || value;
        const dueIso = toIsoDateValue(prev.DueDate ?? '');
        const next = normalizeInvoiceFormDates({
          ...prev,
          Date: invoiceIso,
          DueDate: dueIso || prev.DueDate,
        });
        if (dueIso && next.DueDate && next.DueDate !== dueIso) {
          toast.message('Due date updated — it cannot be before invoice date');
        }
        return next;
      }
      if (key === 'DueDate') {
        const invoiceIso = toIsoDateValue(prev.Date ?? '');
        const dueIso = toIsoDateValue(value) || value;
        const clamped = clampDueDateToInvoiceDate(invoiceIso, dueIso);
        if (invoiceIso && dueIso && clamped && clamped !== dueIso) {
          toast.error('Due date cannot be before invoice date');
          return { ...prev, DueDate: clamped };
        }
        return { ...prev, DueDate: clamped || dueIso };
      }
      return { ...prev, [key]: value };
    });
  }, []);

  // Keep form dates consistent even if values came from an old invoice / template sample.
  useEffect(() => {
    setFormContext((prev) => {
      const next = normalizeInvoiceFormDates(prev);
      if (next.Date === prev.Date && next.DueDate === prev.DueDate) return prev;
      return next;
    });
  }, [formContext.Date, formContext.DueDate]);

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

  const handleTableProductPick = useCallback(
    (
      pageId: string,
      elementId: string,
      rowId: string,
      columnId: string,
      product: { name: string; sku?: string; price?: number; discount?: number; discountType?: 'percentage' | 'fixed'; gst?: number; tax?: number }
    ) => {
      setWorkingPages((prev) =>
        updateComposerProductPick(
          prev,
          pageId,
          elementId,
          rowId,
          columnId,
          product,
          taxSettings,
          productSettings
        )
      );
    },
    [taxSettings, productSettings]
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

  const handleToggleCardStandardField = useCallback(
    (pageId: string, elementId: string, fieldKey: string, hidden: boolean) => {
      setWorkingPages((prev) =>
        toggleComposerCardStandardField(prev, pageId, elementId, fieldKey, hidden)
      );
    },
    []
  );

  const handleToggleCardCustomField = useCallback(
    (pageId: string, elementId: string, fieldId: string, hidden: boolean) => {
      setWorkingPages((prev) =>
        toggleComposerCardCustomField(prev, pageId, elementId, fieldId, hidden)
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
      if (!nextTemplateId || nextTemplateId === loadedTemplateId) return;
      navigate(config.composerPath.replace(':templateId', nextTemplateId));
    },
    [config.composerPath, navigate, loadedTemplateId]
  );

  const buildSavePayload = () => {
    const tableTotals = extractTablePlaceholderTotals(displayPages, taxSettings);
    const placeholders = { ...formContext, ...tableTotals };
    const totals = buildInvoiceTotalsFromPlaceholders(placeholders);
    const issueDate = parseFlexibleDate(String(formContext.Date ?? '')) ?? new Date();
    const rawDue = parseFlexibleDate(String(formContext.DueDate ?? ''));
    const dueDate =
      rawDue && rawDue.getTime() < issueDate.getTime()
        ? new Date(issueDate)
        : rawDue;

    const payload = {
      templateId: loadedTemplateId || templateId || undefined,
      customerId: selectedCustomerId || undefined,
      customerSnapshot: {
        name: formContext.ClientName,
        email: formContext.Email,
        phone: formContext.Phone,
        gst: formContext.GST,
        address: formContext.Address,
        state: formContext.State,
        placeholders: {
          ...placeholders,
          Date: toIsoDateValue(String(formContext.Date ?? '')) || placeholders.Date,
          DueDate:
            (dueDate ? formatIsoDate(dueDate) : toIsoDateValue(String(formContext.DueDate ?? '')))
            || placeholders.DueDate,
        },
      },
      templateSnapshot: filledPages,
      lineItems: [{ name: 'Service', quantity: 1, unit: 'pcs', price: 0, discount: 0, tax: 0, total: 0 }],
      totals,
      type: 'tax',
      issueDate,
      dueDate: dueDate ?? undefined,
    };
    return savedInvoiceId ? payload : { ...payload, status: 'draft' };
  };

  // Re-run table fitting / reflow when late web fonts change text metrics.
  const fontsVersion = useFontsVersion();

  const displayPages = useMemo(
    () => recalculatePagesTables(workingPages, taxSettings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workingPages, taxSettings, fontsVersion]
  );

  const mergedFormContext = useMemo(() => {
    const fromTables = extractTablePlaceholderTotals(displayPages, taxSettings);
    return { ...formContext, ...fromTables };
  }, [formContext, displayPages, taxSettings]);

  const filledPages = useMemo(
    () => (displayPages.length ? applyInvoiceFormToPages(displayPages, mergedFormContext) : []),
    [displayPages, mergedFormContext]
  );

  const pagesForPreview = useMemo(
    () => (filledPages.length ? prepareInvoiceLivePreviewPages(filledPages) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filledPages, fontsVersion]
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
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to save invoice';
      toast.error(msg);
    },
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
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to duplicate invoice';
      toast.error(msg);
    },
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
    const ok = await confirmToast(`Permanently delete invoice ${label}?`, {
      description: 'This action cannot be undone.',
      confirmLabel: 'Delete permanently',
      variant: 'danger',
    });
    if (ok) deleteMutation.mutate();
  };

  const getPdfBlob = async () => {
    if (!filledPages.length) throw new Error('No template pages');
    exportKeyRef.current = pagesExportSignature(filledPages);
    setExportingPdf(true);
    try {
      return await exportRunnerRef.current(() =>
        exportInvoicePreviewPdf(filledPages, exportPageRefs)
      );
    } finally {
      setExportingPdf(false);
    }
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
    if (savedInvoice.status === 'paid') {
      return <Navigate to={`${config.invoicesListPath}/${invoiceId}/view`} replace />;
    }
  } else if (loadingTemplate || !template) {
    return <Loader />;
  }

  const invoiceLabel = `${formContext.InvoiceNumber || 'Draft'}`.trim();
  const showNativeShare = canNativeShareFiles();
  const invoiceStatus = savedInvoice?.status ?? 'draft';

  return (
    <CompanyBrandingProvider scope={brandingScope}>
    <div className="flex h-full min-h-0 flex-col bg-gray-50">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:px-6">
        <Link
          to={backPath}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
          title={isEditing ? 'Back to invoices' : 'Back to templates'}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Invoice' : canSaveInvoice ? 'Create Invoice' : 'Invoice Preview'}
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">{invoiceLabel}</span>
            <Badge variant="warning">{String(invoiceStatus).toUpperCase()}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canSaveInvoice && (
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              <Save className="h-4 w-4" />
              {isEditing ? 'Save Changes' : 'Save Invoice'}
            </Button>
          )}
          {canSaveInvoice && savedInvoiceId ? (
            <>
              <Link to={`${config.invoicesListPath}/${savedInvoiceId}/view`}>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4" />
                  View
                </Button>
              </Link>
              {canShareInvoice && (
                <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)}>
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
              )}
              {canDuplicateInvoice && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => duplicateMutation.mutate()}
                  loading={duplicateMutation.isPending}
                >
                  <Copy className="h-4 w-4" />
                  Duplicate
                </Button>
              )}
              {canDeleteInvoice && invoiceStatus === 'draft' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => void handleDeleteInvoice()}
                  loading={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleDownloadPdf()}
            loading={exportingPdf}
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handlePrint()}
            loading={exportingPdf}
          >
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
          <ProductSettingsProvider scope={brandingScope}>
          <InvoiceComposerForm
            pages={displayPages}
            pageList={workingPages}
            formContext={mergedFormContext}
            onChange={updateField}
            onDeletePage={handleDeletePage}
            onTableCellChange={handleTableCellChange}
            onTableProductPick={handleTableProductPick}
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
            onToggleCardStandardField={handleToggleCardStandardField}
            onUpdateCardCustomField={handleUpdateCardCustomField}
            onDeleteCardCustomField={handleDeleteCardCustomField}
            onToggleCardCustomField={handleToggleCardCustomField}
            customers={customers}
            selectedCustomerId={selectedCustomerId}
            onSelectCustomer={handleSelectCustomer}
          />
          </ProductSettingsProvider>
        </div>

        <div className="min-h-0 overflow-hidden">
          <InvoiceLivePreview
            pages={pagesForPreview}
            templateName={templateName}
            brandingScope={brandingScope}
          />
        </div>
      </div>

      <div aria-hidden className="pointer-events-none fixed left-[-10000px] top-0 opacity-0">
        <CompanyBrandingProvider scope={brandingScope}>
          <TaxSettingsProvider scope={brandingScope}>
            <ProductSettingsProvider scope={brandingScope}>
              <TemplatePreviewPages
                pages={pagesForPreview}
                useSampleData={false}
                pageRefs={exportPageRefs}
                trustTableProps
                autoReflow={false}
              />
            </ProductSettingsProvider>
          </TaxSettingsProvider>
        </CompanyBrandingProvider>
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
    </CompanyBrandingProvider>
  );
}
