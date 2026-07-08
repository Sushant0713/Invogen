import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader } from '@/components/ui/Loader';
import { Badge } from '@/components/ui/Badge';
import { fetchPublicInvoiceView } from '@/features/invoice-composer/invoice-share';
import { InvoiceViewer } from '@/features/invoice-composer/InvoiceViewer';
import type { TemplatePage } from '@invogen/shared';

export default function PublicInvoiceViewPage() {
  const { token = '' } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-invoice-view', token],
    queryFn: () => fetchPublicInvoiceView(token),
    enabled: !!token,
    retry: false,
  });

  if (isLoading) return <Loader fullScreen />;
  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-lg font-semibold text-gray-900">Invoice not found</h1>
          <p className="mt-2 text-sm text-gray-500">This link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  const pages = (data.templateSnapshot ?? []) as TemplatePage[];

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm text-gray-500">{data.companyName}</p>
            <h1 className="text-xl font-bold text-gray-900">Invoice {data.invoiceNumber}</h1>
          </div>
          <Badge>{String(data.status).toUpperCase()}</Badge>
        </div>
        <p className="mb-4 text-xs text-gray-500">View only — you cannot edit this invoice.</p>
        <InvoiceViewer
          pages={pages}
          previewMaxWidth={Math.min(720, window.innerWidth - 32)}
          madeWithInvogen={data.showMadeWithInvogen === true}
        />
      </div>
    </div>
  );
}
