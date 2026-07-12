import { InvoiceStatus } from '@invogen/shared';
import { Company, Invoice } from '../models';
import { getPagination, buildMeta } from '../utils/response';
import {
  buildSalesInvoiceMatch,
  getPreviousPeriod,
  percentChange,
  resolveReportDateRange,
} from '../utils/sales-report';
import {
  getRevenueGroupFormat,
  resolveRevenueGroupBy,
} from '../utils/revenue-aggregation';
import { computeInvoiceGst, getInvoiceCustomerName } from '../utils/invoice-gst';
import type { TemplatePage } from '@invogen/shared';

type InvoiceDoc = {
  _id: { toString(): string };
  invoiceNumber: string;
  createdAt: Date;
  status: string;
  totals?: {
    subtotal?: number;
    discount?: number;
    tax?: number;
    total?: number;
  };
  customerSnapshot?: {
    state?: string;
    name?: string;
    placeholders?: Record<string, unknown>;
  };
  templateSnapshot?: TemplatePage[];
};

function buildGstInvoiceMatch(
  companyId: string,
  from: Date,
  to: Date,
  query: Record<string, unknown>
) {
  return buildSalesInvoiceMatch(companyId, from, to, {
    ...query,
    status: InvoiceStatus.PAID,
  });
}

function periodKey(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (format === '%Y-%m') return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function summarizeInvoices(invoices: InvoiceDoc[], companyState?: string | null) {
  let totalGst = 0;
  let taxableValue = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let totalAmount = 0;

  for (const invoice of invoices) {
    const breakdown = computeInvoiceGst(invoice, companyState);
    totalGst += breakdown.totalGst;
    taxableValue += breakdown.taxable;
    cgst += breakdown.cgst;
    sgst += breakdown.sgst;
    igst += breakdown.igst;
    totalAmount += breakdown.totalAmount;
  }

  return {
    totalGst,
    totalInvoices: invoices.length,
    taxableValue,
    cgst,
    sgst,
    igst,
    totalAmount,
  };
}

function buildTrend(
  invoices: InvoiceDoc[],
  companyState: string | null | undefined,
  groupFormat: string
) {
  const totals = new Map<string, number>();

  for (const invoice of invoices) {
    const key = periodKey(new Date(invoice.createdAt), groupFormat);
    const gst = computeInvoiceGst(invoice, companyState).totalGst;
    totals.set(key, (totals.get(key) ?? 0) + gst);
  }

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, totalGst]) => ({ period, totalGst }));
}

export const adminGstReportService = {
  async getGstReport(companyId: string, query: Record<string, unknown>) {
    const { from, to } = resolveReportDateRange(query);
    const { prevFrom, prevTo } = getPreviousPeriod(from, to);
    const match = buildGstInvoiceMatch(companyId, from, to, query);
    const prevMatch = buildGstInvoiceMatch(companyId, prevFrom, prevTo, query);
    const groupBy = resolveRevenueGroupBy(query.groupBy, String(query.from || ''), String(query.to || ''));
    const groupFormat = getRevenueGroupFormat(groupBy);

    const projection =
      'invoiceNumber createdAt totals customerSnapshot customerId status templateSnapshot';

    const [company, currentInvoices, previousInvoices] = await Promise.all([
      Company.findById(companyId).select('name address.state'),
      Invoice.find(match).select(projection).sort({ createdAt: -1 }).lean<InvoiceDoc[]>(),
      Invoice.find(prevMatch).select(projection).lean<InvoiceDoc[]>(),
    ]);

    const companyState = company?.address?.state ?? null;
    const currentSummary = summarizeInvoices(currentInvoices, companyState);
    const previousSummary = summarizeInvoices(previousInvoices, companyState);

    const search = String(query.search || '').trim().toLowerCase();
    let register = currentInvoices.map((invoice) => {
      const breakdown = computeInvoiceGst(invoice, companyState);
      return {
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber,
        customerName: getInvoiceCustomerName(invoice),
        issueDate: invoice.createdAt,
        ...breakdown,
      };
    });

    if (search) {
      register = register.filter(
        (row) =>
          row.invoiceNumber.toLowerCase().includes(search)
          || row.customerName.toLowerCase().includes(search)
      );
    }

    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const totalRegister = register.length;
    const pagedRegister = register.slice(skip, skip + limit);

    return {
      companyName: company?.name ?? 'Your company',
      from: from.toISOString(),
      to: to.toISOString(),
      groupBy,
      summary: {
        totalGst: currentSummary.totalGst,
        totalGstChange: percentChange(currentSummary.totalGst, previousSummary.totalGst),
        totalInvoices: currentSummary.totalInvoices,
        totalInvoicesChange: percentChange(
          currentSummary.totalInvoices,
          previousSummary.totalInvoices
        ),
        taxableValue: currentSummary.taxableValue,
        taxableValueChange: percentChange(
          currentSummary.taxableValue,
          previousSummary.taxableValue
        ),
        cgst: currentSummary.cgst,
        sgst: currentSummary.sgst,
        igst: currentSummary.igst,
      },
      trend: buildTrend(currentInvoices, companyState, groupFormat),
      register: pagedRegister,
      registerMeta: buildMeta(page, limit, totalRegister),
    };
  },
};
