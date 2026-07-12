import { InvoiceStatus } from '@invogen/shared';
import { Company, Invoice, Payment } from '../models';
import { getPagination, buildMeta } from '../utils/response';
import {
  getPreviousPeriod,
  OUTSTANDING_STATUSES,
  percentChange,
  resolveReportDateRange,
} from '../utils/sales-report';
import {
  getRevenueGroupFormat,
  resolveRevenueGroupBy,
} from '../utils/revenue-aggregation';
import { getInvoiceAmount, getInvoiceCustomerName } from '../utils/invoice-gst';
import {
  buildPaymentDateMatch,
  buildPlatformInvoiceMatch,
} from '../utils/platform-sales-report';

type InvoiceDoc = {
  companyId?: { toString(): string } | string | null;
  status: string;
  createdAt: Date;
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
  templateSnapshot?: import('@invogen/shared').TemplatePage[];
};

type PaymentDoc = {
  companyId: { toString(): string } | string;
  amount: number;
  status: string;
  createdAt: Date;
};

type SalesSummary = {
  totalSales: number;
  totalInvoices: number;
  actualRevenue: number;
  paidSales: number;
};

type ClientRow = {
  clientKey: string;
  name: string;
  totalInvoices: number;
  totalSales: number;
  paidAmount: number;
  outstanding: number;
};

type ClientAnalyticsRow = ClientRow & {
  avgInvoice: number;
  growthPercent: number | null;
};

const INVOICE_SELECT =
  'companyId totals customerSnapshot status createdAt templateSnapshot';

function periodKey(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (format === '%Y-%m') return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function resolveClientKey(invoice: InvoiceDoc): string {
  if (invoice.companyId) return String(invoice.companyId);
  return getInvoiceCustomerName(invoice);
}

function summarizeSales(invoices: InvoiceDoc[]): SalesSummary {
  let totalSales = 0;
  let actualRevenue = 0;

  for (const invoice of invoices) {
    const amount = getInvoiceAmount(invoice);
    totalSales += amount;
    if (invoice.status === InvoiceStatus.PAID) {
      actualRevenue += amount;
    }
  }

  return {
    totalSales,
    totalInvoices: invoices.length,
    actualRevenue,
    paidSales: actualRevenue,
  };
}

function buildClientSales(
  invoices: InvoiceDoc[],
  pendingPayments: PaymentDoc[]
): ClientRow[] {
  const rows = new Map<string, ClientRow>();

  for (const invoice of invoices) {
    const clientKey = resolveClientKey(invoice);
    const amount = getInvoiceAmount(invoice);
    const existing = rows.get(clientKey) ?? {
      clientKey,
      name: getInvoiceCustomerName(invoice),
      totalInvoices: 0,
      totalSales: 0,
      paidAmount: 0,
      outstanding: 0,
    };

    existing.totalInvoices += 1;
    existing.totalSales += amount;
    if (invoice.status === InvoiceStatus.PAID) {
      existing.paidAmount += amount;
    }
    if (OUTSTANDING_STATUSES.includes(invoice.status as (typeof OUTSTANDING_STATUSES)[number])) {
      existing.outstanding += amount;
    }

    rows.set(clientKey, existing);
  }

  for (const payment of pendingPayments) {
    if (payment.status !== 'pending') continue;
    const clientKey = String(payment.companyId);
    const existing = rows.get(clientKey) ?? {
      clientKey,
      name: clientKey,
      totalInvoices: 0,
      totalSales: 0,
      paidAmount: 0,
      outstanding: 0,
    };
    existing.outstanding += payment.amount;
    rows.set(clientKey, existing);
  }

  return [...rows.values()];
}

function buildSalesTrend(invoices: InvoiceDoc[], groupFormat: string) {
  const totals = new Map<string, { totalSales: number; invoiceCount: number }>();
  const paid = new Map<string, number>();

  for (const invoice of invoices) {
    const period = periodKey(new Date(invoice.createdAt), groupFormat);
    const amount = getInvoiceAmount(invoice);
    const bucket = totals.get(period) ?? { totalSales: 0, invoiceCount: 0 };
    bucket.totalSales += amount;
    bucket.invoiceCount += 1;
    totals.set(period, bucket);

    if (invoice.status === InvoiceStatus.PAID) {
      paid.set(period, (paid.get(period) ?? 0) + amount);
    }
  }

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, bucket]) => ({
      period,
      totalSales: bucket.totalSales,
      paidSales: paid.get(period) ?? 0,
      invoiceCount: bucket.invoiceCount,
    }));
}

function sortClients(rows: ClientAnalyticsRow[], sort: string) {
  const sorted = [...rows];
  switch (sort) {
    case 'invoices':
      sorted.sort((a, b) => b.totalInvoices - a.totalInvoices);
      break;
    case 'paid':
      sorted.sort((a, b) => b.paidAmount - a.paidAmount);
      break;
    case 'outstanding':
      sorted.sort((a, b) => b.outstanding - a.outstanding);
      break;
    case 'avg':
      sorted.sort((a, b) => b.avgInvoice - a.avgInvoice);
      break;
    case 'growth':
      sorted.sort((a, b) => (b.growthPercent ?? -Infinity) - (a.growthPercent ?? -Infinity));
      break;
    case 'sales':
    default:
      sorted.sort((a, b) => b.totalSales - a.totalSales);
      break;
  }
  return sorted;
}

export const superAdminSalesReportService = {
  async getSalesReport(query: Record<string, unknown>) {
    const { from, to } = resolveReportDateRange(query);
    const { prevFrom, prevTo } = getPreviousPeriod(from, to);
    const match = buildPlatformInvoiceMatch(from, to, query);
    const prevMatch = buildPlatformInvoiceMatch(prevFrom, prevTo, query);
    const paymentMatch = buildPaymentDateMatch(from, to, 'pending');
    const prevPaymentMatch = buildPaymentDateMatch(prevFrom, prevTo, 'pending');

    const groupBy = resolveRevenueGroupBy(
      query.groupBy,
      String(query.from || ''),
      String(query.to || '')
    );
    const groupFormat = getRevenueGroupFormat(groupBy);

    const [currentInvoices, previousInvoices, currentPending, previousPending, companies] =
      await Promise.all([
        Invoice.find(match).select(INVOICE_SELECT).lean<InvoiceDoc[]>(),
        Invoice.find(prevMatch).select(INVOICE_SELECT).lean<InvoiceDoc[]>(),
        Payment.find(paymentMatch).select('companyId amount status createdAt').lean<PaymentDoc[]>(),
        Payment.find(prevPaymentMatch).select('companyId amount status createdAt').lean<PaymentDoc[]>(),
        Company.find().select('name').lean(),
      ]);

    const companyNames = new Map(companies.map((c) => [String(c._id), c.name]));

    const enrichClientName = (row: ClientRow) => ({
      ...row,
      name: companyNames.get(row.clientKey) ?? row.name,
    });

    const currentSummary = summarizeSales(currentInvoices);
    const previousSummary = summarizeSales(previousInvoices);
    const trend = buildSalesTrend(currentInvoices, groupFormat);
    const currentClients = buildClientSales(currentInvoices, currentPending).map(enrichClientName);
    const previousClients = buildClientSales(previousInvoices, previousPending);

    const prevByClient = new Map(
      previousClients.map((row) => [row.clientKey, row.totalSales])
    );

    const search = String(query.search || '').trim().toLowerCase();
    let clients: ClientAnalyticsRow[] = currentClients.map((row) => {
      const prevSales = prevByClient.get(row.clientKey) ?? 0;
      const growthPercent = percentChange(row.totalSales, prevSales);
      const avgInvoice = row.totalInvoices > 0 ? row.totalSales / row.totalInvoices : 0;
      return {
        ...row,
        avgInvoice,
        growthPercent,
      };
    });

    if (search) {
      clients = clients.filter((row) => row.name.toLowerCase().includes(search));
    }

    const sort = String(query.sort || 'sales');
    clients = sortClients(clients, sort);

    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const totalClients = clients.length;
    const pagedClients = clients.slice(skip, skip + limit);

    return {
      platformName: 'Invogen Platform',
      from: from.toISOString(),
      to: to.toISOString(),
      groupBy,
      summary: {
        totalSales: currentSummary.totalSales,
        totalSalesChange: percentChange(currentSummary.totalSales, previousSummary.totalSales),
        totalInvoices: currentSummary.totalInvoices,
        totalInvoicesChange: percentChange(
          currentSummary.totalInvoices,
          previousSummary.totalInvoices
        ),
        actualRevenue: currentSummary.actualRevenue,
        actualRevenueChange: percentChange(
          currentSummary.actualRevenue,
          previousSummary.actualRevenue
        ),
        paidSales: currentSummary.paidSales,
      },
      trend,
      clients: pagedClients,
      clientsMeta: buildMeta(page, limit, totalClients),
    };
  },
};
