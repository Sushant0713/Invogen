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
import { fitPreviewCardLayout } from '@/features/builder/preview-page-reflow';
import { resolveMediaUrl } from '@/lib/media';
import { MadeWithInvogenProvider } from '@/features/builder/MadeWithInvogenProvider';

type RenderPayload = {
  pages: TemplatePage[];
  invoiceNumber: string;
  branding: { logo?: string; signature?: string };
};

/**
 * Headless print surface for platform subscription invoice PDFs.
 * Uses the same TemplatePreviewPages stack as Super Admin live preview.
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
    // Pages are already filled server-side; only resolve card overflow vs divider.
    return fitPreviewCardLayout(data.pages);
  }, [data?.pages]);

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
    const timer = window.setTimeout(waitForImages, 50);
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
