import { Invoice, Setting } from '../models';
import { getPagination, buildMeta } from '../utils/response';
import {
  getPreviousPeriod,
  percentChange,
  resolveReportDateRange,
} from '../utils/sales-report';
import {
  getRevenueGroupFormat,
  resolveRevenueGroupBy,
} from '../utils/revenue-aggregation';
import { computeInvoiceGst, getInvoiceCustomerName } from '../utils/invoice-gst';
import {
  buildPlatformPaidInvoiceMatch,
  getPlatformCustomerState,
} from '../utils/platform-sales-report';
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
    address?: { state?: string };
    placeholders?: Record<string, unknown>;
  };
  templateSnapshot?: TemplatePage[];
};

function withCustomerState(invoice: InvoiceDoc): InvoiceDoc {
  const state = getPlatformCustomerState(invoice.customerSnapshot);
  if (!state || invoice.customerSnapshot?.state) return invoice;
  return {
    ...invoice,
    customerSnapshot: {
      ...invoice.customerSnapshot,
      state,
    },
  };
}

function periodKey(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (format === '%Y-%m') return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function summarizeInvoices(invoices: InvoiceDoc[], sellerState?: string | null) {
  let totalGst = 0;
  let taxableValue = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let totalAmount = 0;

  for (const invoice of invoices) {
    const breakdown = computeInvoiceGst(withCustomerState(invoice), sellerState);
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
  sellerState: string | null | undefined,
  groupFormat: string
) {
  const totals = new Map<string, number>();

  for (const invoice of invoices) {
    const key = periodKey(new Date(invoice.createdAt), groupFormat);
    const gst = computeInvoiceGst(withCustomerState(invoice), sellerState).totalGst;
    totals.set(key, (totals.get(key) ?? 0) + gst);
  }

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, totalGst]) => ({ period, totalGst }));
}

async function loadSellerState(): Promise<string | null> {
  const setting = await Setting.findOne({ key: 'invoice_settings', scope: 'system' });
  const value = (setting?.value || {}) as { seller?: { address?: { state?: string }; state?: string } };
  return value.seller?.address?.state ?? value.seller?.state ?? null;
}

export const superAdminGstReportService = {
  async getGstReport(query: Record<string, unknown>) {
    const { from, to } = resolveReportDateRange(query);
    const { prevFrom, prevTo } = getPreviousPeriod(from, to);
    const match = buildPlatformPaidInvoiceMatch(from, to, query);
    const prevMatch = buildPlatformPaidInvoiceMatch(prevFrom, prevTo, query);
    const groupBy = resolveRevenueGroupBy(
      query.groupBy,
      String(query.from || ''),
      String(query.to || '')
    );
    const groupFormat = getRevenueGroupFormat(groupBy);

    const projection =
      'invoiceNumber createdAt totals customerSnapshot customerId status templateSnapshot';

    const [sellerState, currentInvoices, previousInvoices] = await Promise.all([
      loadSellerState(),
      Invoice.find(match).select(projection).sort({ createdAt: -1 }).lean<InvoiceDoc[]>(),
      Invoice.find(prevMatch).select(projection).lean<InvoiceDoc[]>(),
    ]);

    const currentSummary = summarizeInvoices(currentInvoices, sellerState);
    const previousSummary = summarizeInvoices(previousInvoices, sellerState);

    const search = String(query.search || '').trim().toLowerCase();
    let register = currentInvoices.map((invoice) => {
      const breakdown = computeInvoiceGst(withCustomerState(invoice), sellerState);
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
      platformName: 'Invogen Platform',
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
      trend: buildTrend(currentInvoices, sellerState, groupFormat),
      register: pagedRegister,
      registerMeta: buildMeta(page, limit, totalRegister),
    };
  },
};
