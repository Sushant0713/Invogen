import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Calendar,
  FileText,
  IndianRupee,
  ShieldCheck,
} from 'lucide-react';
import type { TemplatePage } from '@invogen/shared';
import { Badge } from '@/components/ui/Badge';
import { fetchPublicInvoiceView } from '@/features/invoice-composer/invoice-share';
import { InvoiceViewer } from '@/features/invoice-composer/InvoiceViewer';
import { formatCurrency, formatDate } from '@/lib/utils';
import { resolveInvoiceTotal } from '@/features/invoice-composer/invoice-totals';

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'info' {
  if (status === 'paid') return 'success';
  if (status === 'sent') return 'info';
  if (status === 'draft') return 'warning';
  return 'default';
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function PublicViewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6f4f1] print:bg-white">
      <div
        className="pointer-events-none absolute inset-0 print:hidden"
        aria-hidden
      >
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-amber-100/60 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgb(0 0 0 / 0.04) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 print:max-w-none print:px-0 print:py-0">
        {children}
      </div>
    </div>
  );
}

function PublicViewSkeleton() {
  return (
    <PublicViewShell>
      <div className="animate-pulse space-y-5">
        <div className="h-28 rounded-2xl bg-white/70 shadow-sm ring-1 ring-black/5" />
        <div className="h-[70vh] rounded-2xl bg-white/80 shadow-sm ring-1 ring-black/5" />
      </div>
    </PublicViewShell>
  );
}

export default function PublicInvoiceViewPage() {
  const { token = '' } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-invoice-view', token],
    queryFn: () => fetchPublicInvoiceView(token),
    enabled: !!token,
    retry: false,
  });

  const pages = useMemo(
    () => (data?.templateSnapshot ?? []) as TemplatePage[],
    [data?.templateSnapshot]
  );

  const customerName = (data?.customerSnapshot as { name?: string } | undefined)?.name?.trim();
  const total = resolveInvoiceTotal({
    totals: data?.totals,
    customerSnapshot: data?.customerSnapshot as { placeholders?: Record<string, unknown> } | undefined,
  });
  const previewWidth = Math.min(760, typeof window !== 'undefined' ? window.innerWidth - 40 : 760);

  if (isLoading) return <PublicViewSkeleton />;

  if (isError || !data) {
    return (
      <PublicViewShell>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="w-full max-w-md rounded-2xl border border-white/80 bg-white/90 p-8 text-center shadow-xl shadow-orange-950/5 ring-1 ring-black/5 backdrop-blur-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <FileText className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Invoice not found</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              This link may be invalid, expired, or no longer available. Ask the sender to share a
              new link.
            </p>
          </div>
        </div>
      </PublicViewShell>
    );
  }

  return (
    <PublicViewShell>
      <header className="mb-6 print:hidden">
        <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/85 shadow-xl shadow-orange-950/5 ring-1 ring-black/5 backdrop-blur-md">
          <div className="bg-gradient-to-r from-primary/10 via-white to-orange-50 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-primary shadow-sm ring-1 ring-primary/10">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Secure invoice link
                </div>
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <Building2 className="h-4 w-4 shrink-0 text-primary/80" />
                    {data.companyName}
                  </p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                    Invoice {data.invoiceNumber}
                  </h1>
                  {customerName ? (
                    <p className="mt-1 text-sm text-gray-600">Prepared for {customerName}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                <Badge variant={statusVariant(data.status)} className="px-3 py-1 text-xs">
                  {formatStatusLabel(data.status)}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-gray-100/80 sm:grid-cols-2">
            {data.issueDate ? (
              <div className="flex items-center gap-3 bg-white/90 px-5 py-3.5 sm:px-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Issue date</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(data.issueDate)}</p>
                </div>
              </div>
            ) : null}
            <div className="flex items-center gap-3 bg-white/90 px-5 py-3.5 sm:px-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <IndianRupee className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Amount</p>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(total)}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-white/90 bg-white shadow-2xl shadow-orange-950/10 ring-1 ring-black/5 print:rounded-none print:border-0 print:shadow-none print:ring-0">
        <div className="border-b border-gray-100 bg-gradient-to-b from-gray-50/80 to-white px-5 py-3 print:hidden">
          <p className="text-center text-xs font-medium text-gray-500">
            View only — this is a read-only copy shared with you
          </p>
        </div>

        <div className="bg-[#eceae6] px-3 py-6 sm:px-6 sm:py-8 print:bg-white print:px-0 print:py-0">
          {pages.length > 0 ? (
            <InvoiceViewer
              pages={pages}
              previewMaxWidth={previewWidth}
              madeWithInvogen={data.showMadeWithInvogen === true}
              madeWithImage={data.madeWithImage}
            />
          ) : (
            <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white/70 p-8 text-center">
              <div>
                <FileText className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-700">Preview unavailable</p>
                <p className="mt-1 text-xs text-gray-500">
                  The invoice content could not be loaded for this link.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="mt-6 text-center text-xs text-gray-500 print:hidden">
        <p>Shared securely · Open on any device</p>
      </footer>
    </PublicViewShell>
  );
}
