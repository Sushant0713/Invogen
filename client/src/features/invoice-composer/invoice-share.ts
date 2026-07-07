import api from '@/api/client';
import { buildPublicInvoiceViewUrl } from '@/lib/invoice-routes';

export interface ShareInvoiceInput {
  recipientName?: string;
  recipientEmail?: string;
  method: 'email' | 'whatsapp' | 'link';
}

export interface ShareInvoiceResult {
  token: string;
  invoiceNumber: string;
}

export async function shareInvoiceApi(
  invoicesApi: string,
  invoiceId: string,
  input: ShareInvoiceInput
): Promise<ShareInvoiceResult & { viewUrl: string }> {
  const res = await api.post(`${invoicesApi}/${invoiceId}/share`, input);
  const data = res.data.data as ShareInvoiceResult;
  return { ...data, viewUrl: buildPublicInvoiceViewUrl(data.token) };
}

export interface SharedInvoiceRow {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  recipientName: string;
  recipientEmail: string;
  method: string;
  sharedAt: string;
  token: string;
  status: string;
}

export async function fetchSharedInvoices(invoicesApi: string): Promise<SharedInvoiceRow[]> {
  const res = await api.get(`${invoicesApi}/shares`);
  return res.data.data as SharedInvoiceRow[];
}

export interface PublicInvoiceView {
  invoiceNumber: string;
  status: string;
  templateSnapshot: unknown[];
  customerSnapshot?: Record<string, unknown>;
  totals?: { total?: number };
  issueDate?: string;
  companyName: string;
}

export async function fetchPublicInvoiceView(token: string): Promise<PublicInvoiceView> {
  const res = await api.get(`/public/invoices/view/${token}`);
  return res.data.data as PublicInvoiceView;
}

export async function deleteInvoiceApi(invoicesApi: string, invoiceId: string): Promise<void> {
  await api.delete(`${invoicesApi}/${invoiceId}`);
}
