import { InvoiceStatus } from '@invogen/shared';
import { Company, Invoice } from '../models';
import { getPagination, buildMeta } from '../utils/response';
import {
  buildSalesInvoiceMatch,
  getPreviousPeriod,
  OUTSTANDING_STATUSES,
  percentChange,
  resolveReportDateRange,
  resolveSalesDateBasis,
  type SalesDateBasis,
} from '../utils/sales-report';
import {
  getRevenueGroupFormat,
  resolveRevenueGroupBy,
} from '../utils/revenue-aggregation';
import { getInvoiceAmount, getInvoiceCustomerName } from '../utils/invoice-gst';

type InvoiceDoc = {
  customerId?: { toString(): string } | string | null;
  status: string;
  createdAt: Date;
  issueDate?: Date | string | null;
  sentAt?: Date | string | null;
  paidAt?: Date | string | null;
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
  templateSnapshot?: import('@invogen/shared').TemplatePage[];
};

type SalesSummary = {
  totalSales: number;
  totalInvoices: number;
  actualRevenue: number;
  expectedRevenue: number;
  paidSales: number;
};

type CustomerRow = {
  customerKey: string;
  name: string;
  totalInvoices: number;
  totalSales: number;
  paidAmount: number;
  outstanding: number;
};

type CustomerAnalyticsRow = {
  customerKey: string;
  name: string;
  totalInvoices: number;
  totalSales: number;
  paidAmount: number;
  outstanding: number;
  avgInvoice: number;
  growthPercent: number | null;
};

const INVOICE_SELECT =
  'totals customerSnapshot status createdAt issueDate sentAt paidAt customerId templateSnapshot';

function periodKey(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (format === '%Y-%m') return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function asValidDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Invoice date shown on All Invoices (issue date / Date placeholder). */
function resolveInvoiceDate(invoice: InvoiceDoc): Date {
  const issue = asValidDate(invoice.issueDate);
  if (issue) return issue;
  const placeholder = invoice.customerSnapshot?.placeholders?.Date;
  if (typeof placeholder === 'string' && placeholder.trim()) {
    const parsed = asValidDate(placeholder);
    if (parsed) return parsed;
  }
  return new Date(invoice.createdAt);
}

/**
 * Graph date basis:
 * - invoice → issue date
 * - status → real time when Sent/Paid was clicked (sentAt / paidAt)
 */
function resolveTrendDate(invoice: InvoiceDoc, dateBasis: SalesDateBasis): Date {
  if (dateBasis === 'status') {
    if (invoice.status === InvoiceStatus.PAID) {
      return asValidDate(invoice.paidAt) || asValidDate(invoice.sentAt) || resolveInvoiceDate(invoice);
    }
    if (invoice.status === InvoiceStatus.SENT) {
      return asValidDate(invoice.sentAt) || resolveInvoiceDate(invoice);
    }
  }
  return resolveInvoiceDate(invoice);
}

function isDateInRange(date: Date, from: Date, to: Date): boolean {
  const t = date.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function filterInvoicesByDateBasis(
  invoices: InvoiceDoc[],
  from: Date,
  to: Date,
  dateBasis: SalesDateBasis
): InvoiceDoc[] {
  return invoices.filter((invoice) => isDateInRange(resolveTrendDate(invoice, dateBasis), from, to));
}

function resolveCustomerKey(invoice: InvoiceDoc): string {
  if (invoice.customerId) return String(invoice.customerId);
  return getInvoiceCustomerName(invoice);
}

function summarizeSales(invoices: InvoiceDoc[]): SalesSummary {
  let totalSales = 0;
  let actualRevenue = 0;
  let expectedRevenue = 0;

  for (const invoice of invoices) {
    const amount = getInvoiceAmount(invoice);
    totalSales += amount;
    if (invoice.status === InvoiceStatus.PAID) {
      actualRevenue += amount;
    }
    if (OUTSTANDING_STATUSES.includes(invoice.status as (typeof OUTSTANDING_STATUSES)[number])) {
      expectedRevenue += amount;
    }
  }

  return {
    totalSales,
    totalInvoices: invoices.length,
    actualRevenue,
    expectedRevenue,
    paidSales: actualRevenue,
  };
}

function buildCustomerSales(invoices: InvoiceDoc[]): CustomerRow[] {
  const rows = new Map<string, CustomerRow>();

  for (const invoice of invoices) {
    const customerKey = resolveCustomerKey(invoice);
    const amount = getInvoiceAmount(invoice);
    const existing = rows.get(customerKey) ?? {
      customerKey,
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

    rows.set(customerKey, existing);
  }

  return [...rows.values()];
}

function buildSalesTrend(
  invoices: InvoiceDoc[],
  groupFormat: string,
  dateBasis: SalesDateBasis
) {
  const buckets = new Map<
    string,
    { actualRevenue: number; expectedRevenue: number; invoiceCount: number }
  >();

  for (const invoice of invoices) {
    const period = periodKey(resolveTrendDate(invoice, dateBasis), groupFormat);
    const amount = getInvoiceAmount(invoice);
    const bucket = buckets.get(period) ?? {
      actualRevenue: 0,
      expectedRevenue: 0,
      invoiceCount: 0,
    };
    bucket.invoiceCount += 1;

    if (invoice.status === InvoiceStatus.PAID) {
      bucket.actualRevenue += amount;
    }
    if (OUTSTANDING_STATUSES.includes(invoice.status as (typeof OUTSTANDING_STATUSES)[number])) {
      bucket.expectedRevenue += amount;
    }

    buckets.set(period, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, bucket]) => ({
      period,
      actualRevenue: bucket.actualRevenue,
      expectedRevenue: bucket.expectedRevenue,
      invoiceCount: bucket.invoiceCount,
    }));
}

function sortCustomers(rows: CustomerAnalyticsRow[], sort: string) {
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

export const adminSalesReportService = {
  async getSalesReport(companyId: string, query: Record<string, unknown>) {
    const { from, to } = resolveReportDateRange(query);
    const { prevFrom, prevTo } = getPreviousPeriod(from, to);
    const dateBasis = resolveSalesDateBasis(query);
    const match = buildSalesInvoiceMatch(companyId, from, to, query);
    const prevMatch = buildSalesInvoiceMatch(companyId, prevFrom, prevTo, query);

    const groupBy = resolveRevenueGroupBy(query.groupBy, String(query.from || ''), String(query.to || ''));
    const groupFormat = getRevenueGroupFormat(groupBy);

    const [company, currentRaw, previousRaw] = await Promise.all([
      Company.findById(companyId).select('name'),
      Invoice.find(match).select(INVOICE_SELECT).lean<InvoiceDoc[]>(),
      Invoice.find(prevMatch).select(INVOICE_SELECT).lean<InvoiceDoc[]>(),
    ]);

    const currentInvoices = filterInvoicesByDateBasis(currentRaw, from, to, dateBasis);
    const previousInvoices = filterInvoicesByDateBasis(
      previousRaw,
      prevFrom,
      prevTo,
      dateBasis
    );

    const currentSummary = summarizeSales(currentInvoices);
    const previousSummary = summarizeSales(previousInvoices);
    const trend = buildSalesTrend(currentInvoices, groupFormat, dateBasis);
    const currentCustomers = buildCustomerSales(currentInvoices);
    const previousCustomers = buildCustomerSales(previousInvoices);

    const prevByCustomer = new Map(
      previousCustomers.map((row) => [row.customerKey, row.totalSales])
    );

    const search = String(query.search || '').trim().toLowerCase();
    let customers: CustomerAnalyticsRow[] = currentCustomers.map((row) => {
      const prevSales = prevByCustomer.get(row.customerKey) ?? 0;
      const growthPercent = percentChange(row.totalSales, prevSales);
      const avgInvoice = row.totalInvoices > 0 ? row.totalSales / row.totalInvoices : 0;
      return {
        customerKey: row.customerKey,
        name: row.name,
        totalInvoices: row.totalInvoices,
        totalSales: row.totalSales,
        paidAmount: row.paidAmount,
        outstanding: row.outstanding,
        avgInvoice,
        growthPercent,
      };
    });

    if (search) {
      customers = customers.filter((row) => row.name.toLowerCase().includes(search));
    }

    const sort = String(query.sort || 'sales');
    customers = sortCustomers(customers, sort);

    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const totalCustomers = customers.length;
    const pagedCustomers = customers.slice(skip, skip + limit);

    const averageInvoice =
      currentSummary.totalInvoices > 0
        ? currentSummary.totalSales / currentSummary.totalInvoices
        : 0;
    const previousAverage =
      previousSummary.totalInvoices > 0
        ? previousSummary.totalSales / previousSummary.totalInvoices
        : 0;

    return {
      companyName: company?.name ?? 'Your company',
      from: from.toISOString(),
      to: to.toISOString(),
      groupBy,
      dateBasis,
      summary: {
        totalSales: currentSummary.totalSales,
        totalSalesChange: percentChange(currentSummary.totalSales, previousSummary.totalSales),
        totalInvoices: currentSummary.totalInvoices,
        totalInvoicesChange: percentChange(
          currentSummary.totalInvoices,
          previousSummary.totalInvoices
        ),
        averageInvoice,
        averageInvoiceChange: percentChange(averageInvoice, previousAverage),
        actualRevenue: currentSummary.actualRevenue,
        actualRevenueChange: percentChange(
          currentSummary.actualRevenue,
          previousSummary.actualRevenue
        ),
        expectedRevenue: currentSummary.expectedRevenue,
        expectedRevenueChange: percentChange(
          currentSummary.expectedRevenue,
          previousSummary.expectedRevenue
        ),
        paidSales: currentSummary.paidSales,
      },
      trend,
      customers: pagedCustomers,
      customersMeta: buildMeta(page, limit, totalCustomers),
    };
  },
};
