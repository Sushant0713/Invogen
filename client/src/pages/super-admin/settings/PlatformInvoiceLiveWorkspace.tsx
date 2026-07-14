import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TemplatePage } from '@invogen/shared';
import { Loader } from '@/components/ui/Loader';
import { CompanyBrandingProvider } from '@/features/builder/CompanyBrandingProvider';
import { TaxSettingsProvider } from '@/features/builder/TaxSettingsProvider';
import { ProductSettingsProvider } from '@/features/builder/ProductSettingsProvider';
import { reflowPagesForPreview } from '@/features/builder/preview-page-reflow';
import { useTaxSettingsQuery } from '@/features/builder/use-tax-settings-query';
import { parseProductSettings } from '@/features/builder/product-settings';
import { fetchTemplateDocument } from '@/features/template-gallery/template-loader';
import { extractPlaceholderKeys, type PlaceholderContext } from '@/features/template-gallery/placeholder-utils';
import {
  applyInvoiceFormToPages,
  buildInitialFormContext,
} from '@/features/invoice-composer/apply-invoice-form';
import { InvoiceComposerForm } from '@/features/invoice-composer/InvoiceComposerForm';
import { InvoiceLivePreview } from '@/features/invoice-composer/InvoiceLivePreview';
import {
  addComposerFooter,
  addComposerTableRow,
  addComposerTerms,
  addComposerTermsItem,
  deleteComposerCardCustomField,
  deleteComposerCardStandardField,
  deleteComposerFooter,
  deleteComposerPage,
  deleteComposerTableRow,
  deleteComposerTerms,
  deleteComposerTermsItem,
  extractTablePlaceholderTotals,
  cloneTemplatePages,
  normalizeComposerPages,
  recalculatePagesTables,
  toggleComposerCardCustomField,
  toggleComposerCardStandardField,
  updateComposerCardCustomField,
  updateComposerCardProp,
  updateComposerProductPick,
  updateComposerTableCell,
  updateComposerTableDiscountMode,
  updateComposerTermsItem,
  updateComposerTermsTitle,
  updateComposerTextContent,
} from '@/features/invoice-composer/invoice-document';
import type { InvoiceSettings } from './invoice-settings.types';
import {
  buildPlatformInvoicePlaceholderContext,
  buildPlatformPreviewTaxSettings,
  applyPlatformPreviewPlanToPages,
} from './platform-invoice-preview-context';
import { toast } from 'sonner';

const SUPER_ADMIN_TEMPLATES_API = '/super-admin/templates';

interface PlatformInvoiceLiveWorkspaceProps {
  form: InvoiceSettings;
  templateId: string;
  templateName: string;
}

export function PlatformInvoiceLiveWorkspace({
  form,
  templateId,
  templateName,
}: PlatformInvoiceLiveWorkspaceProps) {
  const [workingPages, setWorkingPages] = useState<TemplatePage[]>([]);
  const [formContext, setFormContext] = useState<PlaceholderContext>({});

  const { data: template, isLoading } = useQuery({
    queryKey: ['platform-invoice-template', templateId],
    queryFn: () => fetchTemplateDocument(SUPER_ADMIN_TEMPLATES_API, templateId),
    enabled: Boolean(templateId),
  });

  const taxSettings = useMemo(
    () => buildPlatformPreviewTaxSettings(form),
    [form.cgstRate, form.sgstRate]
  );
  const productSettings = useMemo(() => parseProductSettings(undefined), []);

  useEffect(() => {
    if (!template?.pages?.length) return;
    const normalized = normalizeComposerPages(template.pages);
    const withPlan = applyPlatformPreviewPlanToPages(normalized, form);
    setWorkingPages(withPlan);
    const keys = extractPlaceholderKeys(withPlan);
    const platformContext = buildPlatformInvoicePlaceholderContext(form);
    setFormContext({ ...buildInitialFormContext(keys), ...platformContext });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset canvas when template changes
  }, [template?._id, template?.pages]);

  useEffect(() => {
    const platformContext = buildPlatformInvoicePlaceholderContext(form);
    setFormContext((prev) => ({ ...prev, ...platformContext }));
  }, [form]);

  useEffect(() => {
    setWorkingPages((prev) => {
      if (!prev.length) return prev;
      return applyPlatformPreviewPlanToPages(cloneTemplatePages(prev), form);
    });
    // Keep table line in sync with plan pricing / discount / tax defaults.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional pricing deps only
  }, [
    form.showDiscount,
    form.defaultDiscount,
    form.cgstRate,
    form.sgstRate,
    form.enableRounding,
  ]);

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
      product: { name: string; sku?: string; price?: number }
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
    (pageId: string, elementId: string, _elementType: string, value: string) => {
      setWorkingPages((prev) => updateComposerTextContent(prev, pageId, elementId, value));
    },
    []
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

  const handleCardPropChange = useCallback(
    (pageId: string, elementId: string, key: string, value: string) => {
      setWorkingPages((prev) => updateComposerCardProp(prev, pageId, elementId, key, value));
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
      setWorkingPages((prev) =>
        deleteComposerCardCustomField(prev, pageId, elementId, fieldId)
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

  const pagesForPreview = useMemo(
    () =>
      filledPages.length
        ? reflowPagesForPreview(cloneTemplatePages(filledPages), { trustTableProps: true })
        : [],
    [filledPages]
  );

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewContainerWidth, setPreviewContainerWidth] = useState(0);

  useEffect(() => {
    const node = previewContainerRef.current;
    if (!node) return;

    const updateWidth = () => {
      setPreviewContainerWidth(node.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const previewMaxWidth = useMemo(() => {
    if (previewContainerWidth > 0) {
      return Math.max(300, Math.floor(previewContainerWidth - 32));
    }
    if (typeof window === 'undefined') return 600;
    return Math.min(820, Math.max(400, Math.floor(window.innerWidth * 0.42)));
  }, [previewContainerWidth]);

  if (!templateId) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 text-center">
        <div>
          <p className="text-sm font-medium text-gray-700">No template selected</p>
          <p className="mt-1 text-xs text-gray-500">
            Choose a Super Admin template to edit components and preview the invoice.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || !template) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-gray-200 bg-white">
        <Loader />
      </div>
    );
  }

  return (
    <CompanyBrandingProvider scope="super-admin">
      <TaxSettingsProvider scope="super-admin">
        <ProductSettingsProvider>
          <div className="grid h-full min-h-0 grid-cols-1 gap-0 xl:grid-cols-[minmax(300px,360px)_1fr]">
            <div className="max-h-[40vh] overflow-auto border-b border-gray-200 bg-white p-3 xl:max-h-full xl:border-b-0 xl:border-r">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Template fields
              </p>
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
                customers={[]}
                selectedCustomerId=""
                onSelectCustomer={() => {}}
                showPageManagement={false}
              />
            </div>

            <div ref={previewContainerRef} className="min-h-[400px] min-w-0 flex-1 overflow-auto xl:min-h-0">
              <InvoiceLivePreview
                pages={pagesForPreview}
                templateName={templateName}
                brandingScope="super-admin"
                previewMaxWidth={previewMaxWidth}
                embedded
                className="h-full min-h-[400px]"
              />
            </div>
          </div>
        </ProductSettingsProvider>
      </TaxSettingsProvider>
    </CompanyBrandingProvider>
  );
}
