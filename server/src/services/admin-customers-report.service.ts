import { InvoiceStatus } from '@invogen/shared';
import { Customer, Invoice } from '../models';
import { getPagination, buildMeta } from '../utils/response';
import {
  buildSalesInvoiceMatch,
  EXCLUDE_PLATFORM_INVOICE_FILTER,
  getPreviousPeriod,
  OUTSTANDING_STATUSES,
  percentChange,
  resolveReportDateRange,
  toCompanyObjectId,
} from '../utils/sales-report';
import {
  getRevenueGroupFormat,
  resolveRevenueGroupBy,
} from '../utils/revenue-aggregation';
import { getInvoiceAmount, getInvoiceCustomerName } from '../utils/invoice-gst';

type InvoiceDoc = {
  _id: { toString(): string };
  customerId?: { toString(): string } | string | null;
  invoiceNumber: string;
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
    email?: string;
    placeholders?: Record<string, unknown>;
  };
};

type LedgerRow = {
  customerKey: string;
  customerId: string | null;
  name: string;
  email: string;
  totalInvoices: number;
  totalBilled: number;
  revenueCollected: number;
  outstanding: number;
  lastInvoiceDate: Date | null;
  lifetimeCollected: number;
};

function periodKey(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (format === '%Y-%m') return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function resolveCustomerKey(invoice: InvoiceDoc): string {
  if (invoice.customerId) {
    return String(invoice.customerId);
  }
  return getInvoiceCustomerName(invoice);
}

function summarizeInvoices(invoices: InvoiceDoc[]) {
  let totalBilled = 0;
  let revenueCollected = 0;
  let outstanding = 0;

  for (const invoice of invoices) {
    const amount = getInvoiceAmount(invoice);
    totalBilled += amount;
    if (invoice.status === InvoiceStatus.PAID) {
      revenueCollected += amount;
    }
    if (OUTSTANDING_STATUSES.includes(invoice.status as (typeof OUTSTANDING_STATUSES)[number])) {
      outstanding += amount;
    }
  }

  return {
    totalInvoices: invoices.length,
    totalBilled,
    revenueCollected,
    outstanding,
  };
}

function buildRevenueTrend(invoices: InvoiceDoc[], groupFormat: string) {
  const totals = new Map<string, number>();

  for (const invoice of invoices) {
    if (invoice.status !== InvoiceStatus.PAID) continue;
    const key = periodKey(new Date(invoice.createdAt), groupFormat);
    totals.set(key, (totals.get(key) ?? 0) + getInvoiceAmount(invoice));
  }

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, revenueCollected]) => ({ period, revenueCollected }));
}

function buildLedger(
  customers: Array<{ _id: { toString(): string }; name: string; email?: string }>,
  periodInvoices: InvoiceDoc[],
  lifetimePaidByCustomer: Map<string, number>
) {
  const ledger = new Map<string, LedgerRow>();

  for (const customer of customers) {
    const key = customer._id.toString();
    ledger.set(key, {
      customerKey: key,
      customerId: key,
      name: customer.name,
      email: customer.email ?? '',
      totalInvoices: 0,
      totalBilled: 0,
      revenueCollected: 0,
      outstanding: 0,
      lastInvoiceDate: null,
      lifetimeCollected: lifetimePaidByCustomer.get(key) ?? 0,
    });
  }

  for (const invoice of periodInvoices) {
    const key = resolveCustomerKey(invoice);
    const amount = getInvoiceAmount(invoice);
    const existing =
      ledger.get(key)
      ?? {
        customerKey: key,
        customerId: invoice.customerId ? String(invoice.customerId) : null,
        name: getInvoiceCustomerName(invoice),
        email: String(invoice.customerSnapshot?.email ?? invoice.customerSnapshot?.placeholders?.Email ?? ''),
        totalInvoices: 0,
        totalBilled: 0,
        revenueCollected: 0,
        outstanding: 0,
        lastInvoiceDate: null,
        lifetimeCollected: lifetimePaidByCustomer.get(key) ?? 0,
      };

    existing.totalInvoices += 1;
    existing.totalBilled += amount;
    if (invoice.status === InvoiceStatus.PAID) {
      existing.revenueCollected += amount;
    }
    if (OUTSTANDING_STATUSES.includes(invoice.status as (typeof OUTSTANDING_STATUSES)[number])) {
      existing.outstanding += amount;
    }
    const createdAt = new Date(invoice.createdAt);
    if (!existing.lastInvoiceDate || createdAt > existing.lastInvoiceDate) {
      existing.lastInvoiceDate = createdAt;
    }

    ledger.set(key, existing);
  }

  return [...ledger.values()].filter(
    (row) => row.totalInvoices > 0 || row.customerId !== null
  );
}

function buildDistribution(ledger: LedgerRow[]) {
  const ranked = [...ledger]
    .filter((row) => row.revenueCollected > 0)
    .sort((a, b) => b.revenueCollected - a.revenueCollected);

  const total = ranked.reduce((sum, row) => sum + row.revenueCollected, 0);
  const top5 = ranked.slice(0, 5).reduce((sum, row) => sum + row.revenueCollected, 0);
  const next10 = ranked.slice(5, 15).reduce((sum, row) => sum + row.revenueCollected, 0);
  const others = Math.max(0, total - top5 - next10);

  return {
    top5,
    next10,
    others,
    total,
    top5Percent: total > 0 ? (top5 / total) * 100 : 0,
  };
}

function sortLedger(rows: LedgerRow[], sort: string) {
  const sorted = [...rows];
  switch (sort) {
    case 'invoices':
      sorted.sort((a, b) => b.totalInvoices - a.totalInvoices);
      break;
    case 'billed':
      sorted.sort((a, b) => b.totalBilled - a.totalBilled);
      break;
    case 'outstanding':
      sorted.sort((a, b) => b.outstanding - a.outstanding);
      break;
    case 'lastInvoice':
      sorted.sort((a, b) => {
        const aTime = a.lastInvoiceDate?.getTime() ?? 0;
        const bTime = b.lastInvoiceDate?.getTime() ?? 0;
        return bTime - aTime;
      });
      break;
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'collected':
    default:
      sorted.sort((a, b) => b.revenueCollected - a.revenueCollected);
      break;
  }
  return sorted;
}

export const adminCustomersReportService = {
  async getCustomersReport(companyId: string, query: Record<string, unknown>) {
    const { from, to } = resolveReportDateRange(query);
    const { prevFrom, prevTo } = getPreviousPeriod(from, to);
    const periodMatch = buildSalesInvoiceMatch(companyId, from, to, { status: 'all', state: 'all' });
    const prevMatch = buildSalesInvoiceMatch(companyId, prevFrom, prevTo, { status: 'all', state: 'all' });
    const groupBy = resolveRevenueGroupBy(query.groupBy, String(query.from || ''), String(query.to || ''));
    const groupFormat = getRevenueGroupFormat(groupBy);
    const companyObjectId = toCompanyObjectId(companyId);

    const invoiceProjection =
      'customerId invoiceNumber status createdAt totals customerSnapshot';

    const outstandingFilter: Record<string, unknown> = {
      companyId: companyObjectId,
      status: { $in: OUTSTANDING_STATUSES },
      ...EXCLUDE_PLATFORM_INVOICE_FILTER,
    };

    const [
      totalCustomers,
      newCustomersInPeriod,
      customers,
      periodInvoices,
      previousInvoices,
      lifetimePaid,
      currentOutstandingInvoices,
      previousOutstandingInvoices,
    ] = await Promise.all([
      Customer.countDocuments({ companyId: companyObjectId, isActive: { $ne: false } }),
      Customer.countDocuments({
        companyId: companyObjectId,
        createdAt: { $gte: from, $lte: to },
      }),
      Customer.find({ companyId: companyObjectId })
        .select('name email')
        .sort({ name: 1 })
        .lean(),
      Invoice.find(periodMatch).select(invoiceProjection).lean<InvoiceDoc[]>(),
      Invoice.find(prevMatch).select(invoiceProjection).lean<InvoiceDoc[]>(),
      Invoice.find({
        companyId: companyObjectId,
        status: InvoiceStatus.PAID,
        ...EXCLUDE_PLATFORM_INVOICE_FILTER,
      } as Record<string, unknown>)
        .select('customerId totals customerSnapshot status')
        .lean<InvoiceDoc[]>(),
      Invoice.find(outstandingFilter).select('totals customerSnapshot status').lean<InvoiceDoc[]>(),
      Invoice.find({
        ...outstandingFilter,
        createdAt: { $lte: prevTo },
      })
        .select('totals customerSnapshot status')
        .lean<InvoiceDoc[]>(),
    ]);

    const lifetimePaidByCustomer = new Map<string, number>();
    for (const invoice of lifetimePaid) {
      const key = resolveCustomerKey(invoice);
      lifetimePaidByCustomer.set(
        key,
        (lifetimePaidByCustomer.get(key) ?? 0) + getInvoiceAmount(invoice)
      );
    }

    const lifetimeRevenue = [...lifetimePaidByCustomer.values()].reduce((sum, value) => sum + value, 0);
    const avgRevenuePerCustomer = totalCustomers > 0 ? lifetimeRevenue / totalCustomers : 0;

    const currentPeriod = summarizeInvoices(periodInvoices);
    const previousPeriod = summarizeInvoices(previousInvoices);

    const outstandingTotal = currentOutstandingInvoices.reduce(
      (sum, invoice) => sum + getInvoiceAmount(invoice),
      0
    );
    const previousOutstandingTotal = previousOutstandingInvoices.reduce(
      (sum, invoice) => sum + getInvoiceAmount(invoice),
      0
    );

    let ledger = buildLedger(customers, periodInvoices, lifetimePaidByCustomer);

    const search = String(query.search || '').trim().toLowerCase();
    if (search) {
      ledger = ledger.filter(
        (row) =>
          row.name.toLowerCase().includes(search)
          || row.email.toLowerCase().includes(search)
          || row.customerKey.toLowerCase().includes(search)
          || (row.customerId ?? '').toLowerCase().includes(search)
      );
    }

    const distribution = buildDistribution(ledger);
    const sort = String(query.sort || 'collected');
    ledger = sortLedger(ledger, sort);

    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const totalLedger = ledger.length;
    const pagedLedger = ledger.slice(skip, skip + limit);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      groupBy,
      summary: {
        totalCustomers,
        newCustomersInPeriod,
        totalInvoices: currentPeriod.totalInvoices,
        totalInvoicesChange: percentChange(currentPeriod.totalInvoices, previousPeriod.totalInvoices),
        revenueCollected: currentPeriod.revenueCollected,
        revenueCollectedChange: percentChange(
          currentPeriod.revenueCollected,
          previousPeriod.revenueCollected
        ),
        outstanding: outstandingTotal,
        outstandingChange: percentChange(outstandingTotal, previousOutstandingTotal),
        avgRevenuePerCustomer,
      },
      trend: buildRevenueTrend(periodInvoices, groupFormat),
      distribution,
      ledger: pagedLedger.map((row) => ({
        ...row,
        lastInvoiceDate: row.lastInvoiceDate?.toISOString() ?? null,
      })),
      ledgerMeta: buildMeta(page, limit, totalLedger),
    };
  },
};
