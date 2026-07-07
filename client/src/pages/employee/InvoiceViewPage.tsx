import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Loader } from '@/components/ui/Loader';
import { Badge } from '@/components/ui/Badge';
import { fetchSavedInvoice } from '@/features/invoice-composer/saved-invoice';
import { InvoiceViewer } from '@/features/invoice-composer/InvoiceViewer';
import type { TemplatePage } from '@invogen/shared';

export default function EmployeeInvoiceViewPage() {
  const { invoiceId = '' } = useParams();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['employee-invoice-view', invoiceId],
    queryFn: () => fetchSavedInvoice('/employee/invoices', invoiceId),
    enabled: !!invoiceId,
  });

  if (isLoading || !invoice) return <Loader />;

  const pages = (invoice.templateSnapshot ?? []) as TemplatePage[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/employee/invoices"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-gray-500">View only</p>
        </div>
        <Badge>{String(invoice.status).toUpperCase()}</Badge>
        <Link
          to={`/employee/invoices/${invoiceId}/edit`}
          className="ml-auto text-sm font-medium text-primary hover:underline"
        >
          Open editor
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <InvoiceViewer
          pages={pages}
          previewMaxWidth={Math.min(720, window.innerWidth - 48)}
          brandingScope="employee"
        />
      </div>
    </div>
  );
}
