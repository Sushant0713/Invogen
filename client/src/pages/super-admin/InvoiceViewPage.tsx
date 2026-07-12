import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, FileWarning } from 'lucide-react';
import { Loader } from '@/components/ui/Loader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fetchSavedInvoice } from '@/features/invoice-composer/saved-invoice';
import { InvoiceViewer } from '@/features/invoice-composer/InvoiceViewer';
import { resolveMediaUrl } from '@/lib/media';
import type { TemplatePage } from '@invogen/shared';

export default function SuperAdminInvoiceViewPage() {
  const { invoiceId = '' } = useParams();

  const { data: invoice, isLoading, isError } = useQuery({
    queryKey: ['super-admin-platform-invoice-view', invoiceId],
    queryFn: () => fetchSavedInvoice('/super-admin/invoices', invoiceId),
    enabled: !!invoiceId,
    retry: false,
  });

  if (isLoading) return <Loader />;

  if (isError || !invoice) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link
            to="/super-admin/invoices"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Invoice not available</h1>
        </div>
        <Card glass={false} className="border border-amber-100 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-medium text-amber-900">This invoice cannot be opened here.</p>
              <p className="mt-1 text-sm text-amber-800">
                Super Admin only shows platform subscription invoices. Customer invoices created by
                admins and employees are managed in their own portals.
              </p>
              <Link to="/super-admin/invoices" className="mt-4 inline-block">
                <Button type="button" size="sm" variant="outline">
                  Back to platform invoices
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const pages = (invoice.templateSnapshot ?? []) as TemplatePage[];
  const pdfUrl = resolveMediaUrl(invoice.pdfUrl);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/super-admin/invoices"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-gray-500">Platform subscription invoice · view only</p>
        </div>
        <Badge>{String(invoice.status).toUpperCase()}</Badge>
        {pdfUrl ? (
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="ml-auto">
            <Button type="button" variant="outline" size="sm">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </a>
        ) : null}
      </div>

      {pages.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <InvoiceViewer
            pages={pages}
            previewMaxWidth={Math.min(720, window.innerWidth - 48)}
          />
        </div>
      ) : pdfUrl ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <iframe title="Platform invoice PDF" src={pdfUrl} className="h-[80vh] w-full" />
        </div>
      ) : (
        <Card glass={false} className="border border-gray-100 p-6 text-sm text-muted-foreground">
          No preview is available for this invoice.
        </Card>
      )}
    </div>
  );
}
