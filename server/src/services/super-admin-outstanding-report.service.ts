import { InvoiceStatus } from '@invogen/shared';
import { Company, Invoice, Payment } from '../models';
import { getPagination, buildMeta } from '../utils/response';
import { resolveReportDateRange } from '../utils/sales-report';
import { getInvoiceAmount, getInvoiceCustomerName } from '../utils/invoice-gst';
import { PLATFORM_INVOICE_FILTER } from '../utils/platform-sales-report';

type OutstandingRow = {
  id: string;
  type: 'invoice' | 'payment';
  reference: string;
  clientName: string;
  amount: number;
  status: string;
  dueDate: string | null;
  createdAt: string;
};

export const superAdminOutstandingReportService = {
  async getOutstandingReport(query: Record<string, unknown>) {
    const { from, to } = resolveReportDateRange(query);
    const search = String(query.search || '').trim().toLowerCase();

    const [sentInvoices, pendingPayments, companies] = await Promise.all([
      Invoice.find({
        ...PLATFORM_INVOICE_FILTER,
        status: InvoiceStatus.SENT,
        createdAt: { $gte: from, $lte: to },
      })
        .select('invoiceNumber companyId totals customerSnapshot createdAt dueDate status')
        .sort({ createdAt: -1 })
        .lean(),
      Payment.find({
        status: 'pending',
        createdAt: { $gte: from, $lte: to },
      })
        .select('amount companyId createdAt status razorpayOrderId')
        .sort({ createdAt: -1 })
        .lean(),
      Company.find().select('name').lean(),
    ]);

    const companyNames = new Map(companies.map((c) => [String(c._id), c.name]));

    let rows: OutstandingRow[] = [
      ...sentInvoices.map((invoice) => {
        const doc = invoice as typeof invoice & { createdAt: Date; dueDate?: Date };
        return {
        id: String(invoice._id),
        type: 'invoice' as const,
        reference: invoice.invoiceNumber,
        clientName:
          companyNames.get(String(invoice.companyId))
          ?? getInvoiceCustomerName(invoice as Parameters<typeof getInvoiceCustomerName>[0]),
        amount: getInvoiceAmount(invoice as Parameters<typeof getInvoiceAmount>[0]),
        status: invoice.status,
        dueDate: doc.dueDate ? new Date(doc.dueDate).toISOString() : null,
        createdAt: new Date(doc.createdAt).toISOString(),
      };
      }),
      ...pendingPayments.map((payment) => {
        const doc = payment as typeof payment & { createdAt: Date };
        return {
        id: String(payment._id),
        type: 'payment' as const,
        reference: payment.razorpayOrderId || String(payment._id),
        clientName: companyNames.get(String(payment.companyId)) ?? 'Unknown client',
        amount: payment.amount,
        status: payment.status,
        dueDate: null,
        createdAt: new Date(doc.createdAt).toISOString(),
      };
      }),
    ];

    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (search) {
      rows = rows.filter(
        (row) =>
          row.clientName.toLowerCase().includes(search)
          || row.reference.toLowerCase().includes(search)
          || row.type.includes(search)
      );
    }

    const totalOutstanding = rows.reduce((sum, row) => sum + row.amount, 0);
    const invoiceOutstanding = rows
      .filter((row) => row.type === 'invoice')
      .reduce((sum, row) => sum + row.amount, 0);
    const paymentOutstanding = rows
      .filter((row) => row.type === 'payment')
      .reduce((sum, row) => sum + row.amount, 0);

    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const total = rows.length;
    const pagedRows = rows.slice(skip, skip + limit);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      summary: {
        totalOutstanding,
        invoiceOutstanding,
        paymentOutstanding,
        totalItems: total,
      },
      rows: pagedRows,
      rowsMeta: buildMeta(page, limit, total),
    };
  },
};
