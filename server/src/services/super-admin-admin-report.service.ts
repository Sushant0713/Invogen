import mongoose from 'mongoose';
import { InvoiceStatus } from '@invogen/shared';
import { Company, Invoice } from '../models';
import { getPagination, buildMeta } from '../utils/response';
import {
  EXCLUDE_PLATFORM_INVOICE_FILTER,
  getPreviousPeriod,
  parseReportDate,
  percentChange,
  resolveReportDateRange,
} from '../utils/sales-report';
import {
  getRevenueGroupFormat,
  resolveRevenueGroupBy,
} from '../utils/revenue-aggregation';
import { getInvoiceAmount } from '../utils/invoice-gst';

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
    placeholders?: Record<string, unknown>;
  };
  templateSnapshot?: import('@invogen/shared').TemplatePage[];
};

type StatusBreakdown = {
  paidCount: number;
  sentCount: number;
  draftCount: number;
  cancelledCount: number;
  paidRevenue: number;
  sentValue: number;
  draftValue: number;
  totalInvoices: number;
};

type TrendPoint = {
  period: string;
  paidRevenue: number;
  paidCount: number;
  sentCount: number;
  draftCount: number;
  totalInvoices: number;
};

type ClientRow = {
  companyId: string;
  name: string;
  paidCount: number;
  sentCount: number;
  draftCount: number;
  cancelledCount: number;
  totalInvoices: number;
  paidRevenue: number;
  sentValue: number;
  draftValue: number;
};

const INVOICE_SELECT = 'companyId totals customerSnapshot status createdAt templateSnapshot';

function periodKey(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (format === '%Y-%m') return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function resolveDateRange(query: Record<string, unknown>) {
  if (query.from && query.to) {
    return {
      from: parseReportDate(String(query.from)),
      to: parseReportDate(String(query.to), true),
    };
  }
  return resolveReportDateRange(query);
}

function buildBaseMatch(from: Date, to: Date, query: Record<string, unknown>) {
  const match: Record<string, unknown> = {
    createdAt: { $gte: from, $lte: to },
    $and: [EXCLUDE_PLATFORM_INVOICE_FILTER],
  };

  const companyId =
    typeof query.companyId === 'string' && query.companyId.trim()
      ? query.companyId.trim()
      : null;
  if (companyId) {
    match.companyId = new mongoose.Types.ObjectId(companyId);
  }

  return match;
}

function applyStatusFilter(
  match: Record<string, unknown>,
  query: Record<string, unknown>
) {
  const status = query.status ? String(query.status) : 'all';
  if (status !== 'all') {
    return { ...match, status };
  }
  return match;
}

function summarizeByStatus(invoices: InvoiceDoc[]): StatusBreakdown {
  const summary: StatusBreakdown = {
    paidCount: 0,
    sentCount: 0,
    draftCount: 0,
    cancelledCount: 0,
    paidRevenue: 0,
    sentValue: 0,
    draftValue: 0,
    totalInvoices: invoices.length,
  };

  for (const invoice of invoices) {
    const amount = getInvoiceAmount(invoice);
    switch (invoice.status) {
      case InvoiceStatus.PAID:
        summary.paidCount += 1;
        summary.paidRevenue += amount;
        break;
      case InvoiceStatus.SENT:
        summary.sentCount += 1;
        summary.sentValue += amount;
        break;
      case InvoiceStatus.DRAFT:
        summary.draftCount += 1;
        summary.draftValue += amount;
        break;
      case InvoiceStatus.CANCELLED:
        summary.cancelledCount += 1;
        break;
      default:
        break;
    }
  }

  return summary;
}

function buildTrend(invoices: InvoiceDoc[], groupFormat: string): TrendPoint[] {
  const buckets = new Map<string, TrendPoint>();

  for (const invoice of invoices) {
    const period = periodKey(new Date(invoice.createdAt), groupFormat);
    const bucket = buckets.get(period) ?? {
      period,
      paidRevenue: 0,
      paidCount: 0,
      sentCount: 0,
      draftCount: 0,
      totalInvoices: 0,
    };

    bucket.totalInvoices += 1;
    const amount = getInvoiceAmount(invoice);

    if (invoice.status === InvoiceStatus.PAID) {
      bucket.paidCount += 1;
      bucket.paidRevenue += amount;
    } else if (invoice.status === InvoiceStatus.SENT) {
      bucket.sentCount += 1;
    } else if (invoice.status === InvoiceStatus.DRAFT) {
      bucket.draftCount += 1;
    }

    buckets.set(period, bucket);
  }

  return [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period));
}

function buildClientRows(
  invoices: InvoiceDoc[],
  companyNames: Map<string, string>
): ClientRow[] {
  const rows = new Map<string, ClientRow>();

  for (const invoice of invoices) {
    const companyId = invoice.companyId ? String(invoice.companyId) : 'unknown';
    const amount = getInvoiceAmount(invoice);
    const existing = rows.get(companyId) ?? {
      companyId,
      name: companyNames.get(companyId) ?? 'Unknown client',
      paidCount: 0,
      sentCount: 0,
      draftCount: 0,
      cancelledCount: 0,
      totalInvoices: 0,
      paidRevenue: 0,
      sentValue: 0,
      draftValue: 0,
    };

    existing.totalInvoices += 1;

    if (invoice.status === InvoiceStatus.PAID) {
      existing.paidCount += 1;
      existing.paidRevenue += amount;
    } else if (invoice.status === InvoiceStatus.SENT) {
      existing.sentCount += 1;
      existing.sentValue += amount;
    } else if (invoice.status === InvoiceStatus.DRAFT) {
      existing.draftCount += 1;
      existing.draftValue += amount;
    } else if (invoice.status === InvoiceStatus.CANCELLED) {
      existing.cancelledCount += 1;
    }

    rows.set(companyId, existing);
  }

  return [...rows.values()].sort((a, b) => b.paidRevenue - a.paidRevenue);
}

function sortClients(rows: ClientRow[], sort: string) {
  const sorted = [...rows];
  switch (sort) {
    case 'paidCount':
      sorted.sort((a, b) => b.paidCount - a.paidCount);
      break;
    case 'sentCount':
      sorted.sort((a, b) => b.sentCount - a.sentCount);
      break;
    case 'draftCount':
      sorted.sort((a, b) => b.draftCount - a.draftCount);
      break;
    case 'invoices':
      sorted.sort((a, b) => b.totalInvoices - a.totalInvoices);
      break;
    case 'paidRevenue':
    default:
      sorted.sort((a, b) => b.paidRevenue - a.paidRevenue);
      break;
  }
  return sorted;
}

export const superAdminAdminReportService = {
  async getAdminInvoicesReport(query: Record<string, unknown>) {
    const { from, to } = resolveDateRange(query);
    const { prevFrom, prevTo } = getPreviousPeriod(from, to);

    const baseMatch = buildBaseMatch(from, to, query);
    const prevBaseMatch = buildBaseMatch(prevFrom, prevTo, query);
    const displayMatch = applyStatusFilter(baseMatch, query);

    const groupBy = resolveRevenueGroupBy(
      query.groupBy,
      String(query.from || ''),
      String(query.to || '')
    );
    const groupFormat = getRevenueGroupFormat(groupBy);

    const [breakdownInvoices, displayInvoices, prevBreakdownInvoices, companies] =
      await Promise.all([
        Invoice.find(baseMatch).select(INVOICE_SELECT).lean<InvoiceDoc[]>(),
        Invoice.find(displayMatch).select(INVOICE_SELECT).lean<InvoiceDoc[]>(),
        Invoice.find(prevBaseMatch).select(INVOICE_SELECT).lean<InvoiceDoc[]>(),
        Company.find().select('name').sort({ name: 1 }).lean(),
      ]);

    const companyNames = new Map(companies.map((c) => [String(c._id), c.name]));

    const summary = summarizeByStatus(breakdownInvoices);
    const previousSummary = summarizeByStatus(prevBreakdownInvoices);
    const trend = buildTrend(displayInvoices, groupFormat);

    const search = String(query.search || '').trim().toLowerCase();
    const statusFilter = query.status ? String(query.status) : 'all';
    const clientSourceInvoices = statusFilter !== 'all' ? displayInvoices : breakdownInvoices;
    let clients = buildClientRows(clientSourceInvoices, companyNames);

    if (search) {
      clients = clients.filter((row) => row.name.toLowerCase().includes(search));
    }

    clients = sortClients(clients, String(query.sort || 'paidRevenue'));

    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const totalClients = clients.length;
    const pagedClients = clients.slice(skip, skip + limit);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      groupBy,
      summary: {
        ...summary,
        paidRevenueChange: percentChange(summary.paidRevenue, previousSummary.paidRevenue),
        paidCountChange: percentChange(summary.paidCount, previousSummary.paidCount),
        sentCountChange: percentChange(summary.sentCount, previousSummary.sentCount),
        draftCountChange: percentChange(summary.draftCount, previousSummary.draftCount),
        totalInvoicesChange: percentChange(summary.totalInvoices, previousSummary.totalInvoices),
      },
      trend,
      clients: pagedClients,
      clientsMeta: buildMeta(page, limit, totalClients),
      companies: companies.map((c) => ({ _id: String(c._id), name: c.name })),
    };
  },
};
