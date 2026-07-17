import { InvoiceStatus, UserRole } from '@invogen/shared';
import { Invoice, Payment, User } from '../models';
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
import { getInvoiceAmount } from '../utils/invoice-gst';
import {
  buildPlatformInvoiceMatch,
  PLATFORM_INVOICE_FILTER,
} from '../utils/platform-sales-report';

type InvoiceDoc = {
  companyId?: { toString(): string } | string | null;
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
    name?: string;
    email?: string;
    placeholders?: Record<string, unknown>;
  };
};

type LedgerRow = {
  clientKey: string;
  clientId: string | null;
  name: string;
  email: string;
  totalInvoices: number;
  totalBilled: number;
  revenueCollected: number;
  outstanding: number;
  lastInvoiceDate: Date | null;
  allTimeCollected: number;
};

function periodKey(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (format === '%Y-%m') return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function resolveClientKey(invoice: InvoiceDoc): string {
  if (invoice.companyId) return String(invoice.companyId);
  return String(invoice.customerSnapshot?.name ?? 'unknown');
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
  clients: Array<{
    _id: { toString(): string };
    email: string;
    companyId?: { _id?: { toString(): string }; name?: string; email?: string } | null;
  }>,
  periodInvoices: InvoiceDoc[],
  allTimePaidByClient: Map<string, number>
) {
  const ledger = new Map<string, LedgerRow>();

  for (const client of clients) {
    const companyRef = client.companyId as { _id?: { toString(): string }; name?: string; email?: string } | null;
    const companyId = companyRef?._id?.toString() ?? null;
    const key = companyId ?? client._id.toString();
    ledger.set(key, {
      clientKey: key,
      clientId: client._id.toString(),
      name: companyRef?.name ?? `${client.email}`,
      email: companyRef?.email ?? client.email,
      totalInvoices: 0,
      totalBilled: 0,
      revenueCollected: 0,
      outstanding: 0,
      lastInvoiceDate: null,
      allTimeCollected: allTimePaidByClient.get(key) ?? 0,
    });
  }

  for (const invoice of periodInvoices) {
    const key = resolveClientKey(invoice);
    const amount = getInvoiceAmount(invoice);
    const existing =
      ledger.get(key)
      ?? {
        clientKey: key,
        clientId: null,
        name: String(invoice.customerSnapshot?.name ?? 'Unknown client'),
        email: String(invoice.customerSnapshot?.email ?? ''),
        totalInvoices: 0,
        totalBilled: 0,
        revenueCollected: 0,
        outstanding: 0,
        lastInvoiceDate: null,
        allTimeCollected: allTimePaidByClient.get(key) ?? 0,
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

  return [...ledger.values()].filter((row) => row.totalInvoices > 0 || row.clientId !== null);
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

export const superAdminClientsReportService = {
  async getClientsReport(query: Record<string, unknown>) {
    const { from, to } = resolveReportDateRange(query);
    const { prevFrom, prevTo } = getPreviousPeriod(from, to);
    const periodMatch = buildPlatformInvoiceMatch(from, to, { status: 'all', state: 'all' });
    const prevMatch = buildPlatformInvoiceMatch(prevFrom, prevTo, { status: 'all', state: 'all' });
    const groupBy = resolveRevenueGroupBy(
      query.groupBy,
      String(query.from || ''),
      String(query.to || '')
    );
    const groupFormat = getRevenueGroupFormat(groupBy);

    const invoiceProjection = 'companyId invoiceNumber status createdAt totals customerSnapshot';

    const outstandingFilter: Record<string, unknown> = {
      status: { $in: OUTSTANDING_STATUSES },
      ...PLATFORM_INVOICE_FILTER,
    };

    const [
      totalClients,
      newClientsInPeriod,
      clients,
      periodInvoices,
      previousInvoices,
      allTimePaid,
      currentOutstandingInvoices,
      previousOutstandingInvoices,
      pendingPayments,
      previousPendingPayments,
    ] = await Promise.all([
      User.countDocuments({ role: UserRole.ADMIN }),
      User.countDocuments({
        role: UserRole.ADMIN,
        createdAt: { $gte: from, $lte: to },
      }),
      User.find({ role: UserRole.ADMIN })
        .select('email companyId')
        .populate('companyId', 'name email')
        .sort({ createdAt: -1 })
        .lean(),
      Invoice.find(periodMatch).select(invoiceProjection).lean<InvoiceDoc[]>(),
      Invoice.find(prevMatch).select(invoiceProjection).lean<InvoiceDoc[]>(),
      Invoice.find({
        status: InvoiceStatus.PAID,
        ...PLATFORM_INVOICE_FILTER,
      } as Record<string, unknown>)
        .select('companyId totals customerSnapshot status')
        .lean<InvoiceDoc[]>(),
      Invoice.find(outstandingFilter).select('totals customerSnapshot status companyId').lean<InvoiceDoc[]>(),
      Invoice.find({
        ...outstandingFilter,
        createdAt: { $lte: prevTo },
      })
        .select('totals customerSnapshot status companyId')
        .lean<InvoiceDoc[]>(),
      Payment.find({ status: 'pending' }).select('amount companyId').lean(),
      Payment.find({ status: 'pending', createdAt: { $lte: prevTo } }).select('amount companyId').lean(),
    ]);

    const allTimePaidByClient = new Map<string, number>();
    for (const invoice of allTimePaid) {
      const key = resolveClientKey(invoice);
      allTimePaidByClient.set(
        key,
        (allTimePaidByClient.get(key) ?? 0) + getInvoiceAmount(invoice)
      );
    }

    const currentPeriod = summarizeInvoices(periodInvoices);
    const previousPeriod = summarizeInvoices(previousInvoices);

    const outstandingFromInvoices = currentOutstandingInvoices.reduce(
      (sum, invoice) => sum + getInvoiceAmount(invoice),
      0
    );
    const pendingOutstanding = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
    const outstandingTotal = outstandingFromInvoices + pendingOutstanding;

    const previousOutstandingFromInvoices = previousOutstandingInvoices.reduce(
      (sum, invoice) => sum + getInvoiceAmount(invoice),
      0
    );
    const previousPendingOutstanding = previousPendingPayments.reduce((sum, p) => sum + p.amount, 0);
    const previousOutstandingTotal = previousOutstandingFromInvoices + previousPendingOutstanding;

    let ledger = buildLedger(clients, periodInvoices, allTimePaidByClient);

    const search = String(query.search || '').trim().toLowerCase();
    if (search) {
      ledger = ledger.filter(
        (row) =>
          row.name.toLowerCase().includes(search)
          || row.email.toLowerCase().includes(search)
          || row.clientKey.toLowerCase().includes(search)
          || (row.clientId ?? '').toLowerCase().includes(search)
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
        totalClients,
        newClientsInPeriod,
        totalInvoices: currentPeriod.totalInvoices,
        totalInvoicesChange: percentChange(currentPeriod.totalInvoices, previousPeriod.totalInvoices),
        revenueCollected: currentPeriod.revenueCollected,
        revenueCollectedChange: percentChange(
          currentPeriod.revenueCollected,
          previousPeriod.revenueCollected
        ),
        outstanding: outstandingTotal,
        outstandingChange: percentChange(outstandingTotal, previousOutstandingTotal),
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
