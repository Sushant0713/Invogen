import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { TemplatePage } from '@invogen/shared';
import api from '@/api/client';
import { Loader } from '@/components/ui/Loader';
import { TemplatePreviewPages } from '@/features/builder/TemplatePreviewPages';
import { CompanyBrandingProvider } from '@/features/builder/CompanyBrandingProvider';
import { TaxSettingsProvider } from '@/features/builder/TaxSettingsProvider';
import { ProductSettingsProvider } from '@/features/builder/ProductSettingsProvider';
import {
  cloneTemplatePages,
  prepareInvoiceLivePreviewPages,
  recalculatePagesTables,
} from '@/features/invoice-composer/invoice-document';
import { EMPTY_TAX_SETTINGS, type TaxSettings } from '@/features/builder/tax-settings';
import { resolveMediaUrl } from '@/lib/media';
import { MadeWithInvogenProvider } from '@/features/builder/MadeWithInvogenProvider';

type RenderPayload = {
  pages: TemplatePage[];
  invoiceNumber: string;
  branding: { logo?: string; signature?: string };
  tax?: {
    cgstRate?: number;
    sgstRate?: number;
  };
};

function taxFromPayload(payload: RenderPayload | undefined): TaxSettings {
  const cgst =
    typeof payload?.tax?.cgstRate === 'number' ? payload.tax.cgstRate : EMPTY_TAX_SETTINGS.cgstRate;
  const sgst =
    typeof payload?.tax?.sgstRate === 'number' ? payload.tax.sgstRate : EMPTY_TAX_SETTINGS.sgstRate;
  return {
    ...EMPTY_TAX_SETTINGS,
    cgstRate: cgst,
    sgstRate: sgst,
    gstRate: cgst + sgst,
    igstRate: cgst + sgst,
  };
}

/**
 * Headless print surface for platform subscription invoice PDFs.
 * Mirrors Super Admin live preview: table math → one Word reflow → TemplatePreviewPages(autoReflow=false).
 */
export default function PlatformInvoicePrintPage() {
  const { token = '' } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['platform-invoice-render', token],
    queryFn: async () =>
      (await api.get(`/public/platform-invoice-render/${token}`)).data.data as RenderPayload,
    enabled: !!token,
    retry: false,
  });

  const brandingValue = useMemo(
    () => ({
      logo: resolveMediaUrl(data?.branding?.logo),
      signature: resolveMediaUrl(data?.branding?.signature),
    }),
    [data?.branding?.logo, data?.branding?.signature]
  );

  const printPages = useMemo((): TemplatePage[] => {
    if (!data?.pages?.length) return [];
    const tax = taxFromPayload(data);
    // Same pipeline as PlatformInvoiceLiveWorkspace → InvoiceLivePreview.
    const recalculated = recalculatePagesTables(cloneTemplatePages(data.pages), tax);
    return prepareInvoiceLivePreviewPages(recalculated);
  }, [data]);

  useEffect(() => {
    if (!printPages.length) return;

    let cancelled = false;
    const markReady = () => {
      if (!cancelled) {
        document.documentElement.setAttribute('data-platform-invoice-pdf-ready', 'true');
      }
    };

    const waitForImages = () => {
      const images = Array.from(document.querySelectorAll('img'));
      if (images.length === 0) {
        requestAnimationFrame(() => requestAnimationFrame(markReady));
        return;
      }
      let pending = images.length;
      const done = () => {
        pending -= 1;
        if (pending <= 0) markReady();
      };
      images.forEach((img) => {
        if (img.complete) done();
        else {
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }
      });
    };

    // Allow React to paint fitted pages before sampling images.
    const timer = window.setTimeout(waitForImages, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [printPages]);

  if (isLoading) return <Loader fullScreen />;
  if (isError || !printPages.length) {
    return <div className="p-8 text-sm text-gray-600">Invoice render unavailable.</div>;
  }

  return (
    <MadeWithInvogenProvider source="none" forcedShow={false}>
      <CompanyBrandingProvider scope="super-admin" override={brandingValue}>
        <TaxSettingsProvider scope="super-admin">
          <ProductSettingsProvider scope="super-admin">
            <div className="bg-white print:m-0">
              <TemplatePreviewPages
                pages={printPages}
                useSampleData={false}
                trustTableProps
                autoReflow={false}
              />
            </div>
            <style>{`
              @page { margin: 0; size: A4; }
              html, body { margin: 0; padding: 0; background: #fff; }
              [data-template-preview-page] { box-shadow: none !important; }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            `}</style>
          </ProductSettingsProvider>
        </TaxSettingsProvider>
      </CompanyBrandingProvider>
    </MadeWithInvogenProvider>
  );
}
