import type { TemplatePage } from '@invogen/shared';
import api from '@/api/client';
import type { PlaceholderContext } from '@/features/template-gallery/placeholder-utils';
import { normalizeComposerPages } from './invoice-document';

export interface SavedInvoiceRecord {
  _id: string;
  invoiceNumber: string;
  status: string;
  templateId?: string;
  templateSnapshot?: TemplatePage[];
  pdfUrl?: string;
  customerId?: string | { _id?: string; name?: string };
  customerSnapshot?: {
    name?: string;
    email?: string;
    phone?: string;
    gst?: string;
    address?: string;
    state?: string;
    placeholders?: PlaceholderContext;
  };
}

export async function fetchSavedInvoice(
  invoicesApi: string,
  invoiceId: string
): Promise<SavedInvoiceRecord> {
  const res = await api.get(`${invoicesApi}/${invoiceId}`);
  return res.data.data as SavedInvoiceRecord;
}

export function hydrateComposerFromSavedInvoice(invoice: SavedInvoiceRecord): {
  pages: TemplatePage[];
  formContext: PlaceholderContext;
  customerId: string;
} {
  const pages = normalizeComposerPages(
    Array.isArray(invoice.templateSnapshot) ? invoice.templateSnapshot : []
  );
  const snap = invoice.customerSnapshot ?? {};
  const placeholders = (snap.placeholders ?? {}) as PlaceholderContext;

  const formContext: PlaceholderContext = {
    ...placeholders,
    ClientName: placeholders.ClientName ?? snap.name ?? '',
    Email: placeholders.Email ?? snap.email ?? '',
    Phone: placeholders.Phone ?? snap.phone ?? '',
    GST: placeholders.GST ?? snap.gst ?? '',
    Address: placeholders.Address ?? snap.address ?? '',
    State: placeholders.State ?? snap.state ?? '',
    InvoiceNumber: invoice.invoiceNumber,
  };

  const customerId =
    typeof invoice.customerId === 'object' && invoice.customerId
      ? String(invoice.customerId._id ?? '')
      : String(invoice.customerId ?? '');

  return { pages, formContext, customerId };
}
