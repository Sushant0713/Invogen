import mongoose from 'mongoose';
import { InvoiceStatus } from '@invogen/shared';

export const EXCLUDE_PLATFORM_INVOICE_FILTER = {
  $or: [
    { 'customerSnapshot.platformInvoice': { $exists: false } },
    { 'customerSnapshot.platformInvoice': { $ne: true } },
  ],
};

export function toCompanyObjectId(companyId: string) {
  return new mongoose.Types.ObjectId(companyId);
}

export function parseReportDate(value: string, endOfDay = false): Date {
  const date = new Date(value);
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

export function resolveReportDateRange(query: Record<string, unknown>): { from: Date; to: Date } {
  const now = new Date();
  const to = query.to ? parseReportDate(String(query.to), true) : new Date(now);
  if (!query.to) {
    to.setHours(23, 59, 59, 999);
  }

  if (query.from) {
    return { from: parseReportDate(String(query.from)), to };
  }

  const preset = String(query.preset || 'this_month');
  const from = new Date(to);

  switch (preset) {
    case 'last_month': {
      from.setDate(1);
      from.setMonth(from.getMonth() - 1);
      from.setHours(0, 0, 0, 0);
      const lastDay = new Date(from.getFullYear(), from.getMonth() + 1, 0);
      lastDay.setHours(23, 59, 59, 999);
      return { from, to: lastDay };
    }
    case 'this_quarter': {
      const quarterMonth = Math.floor(from.getMonth() / 3) * 3;
      from.setMonth(quarterMonth, 1);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case 'this_year': {
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case 'last_6_months': {
      from.setMonth(from.getMonth() - 5, 1);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case 'this_month':
    default: {
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
  }
}

export function getPreviousPeriod(from: Date, to: Date) {
  const durationMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  prevFrom.setHours(0, 0, 0, 0);
  prevTo.setHours(23, 59, 59, 999);
  return { prevFrom, prevTo };
}

export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) {
    return current > 0 ? 100 : null;
  }
  return ((current - previous) / previous) * 100;
}

export function buildSalesInvoiceMatch(
  companyId: string,
  from: Date,
  to: Date,
  query: Record<string, unknown>
) {
  const match: Record<string, unknown> = {
    companyId: toCompanyObjectId(companyId),
    createdAt: { $gte: from, $lte: to },
    $and: [EXCLUDE_PLATFORM_INVOICE_FILTER],
  };

  const status = query.status ? String(query.status) : 'all';
  if (status !== 'all') {
    match.status = status;
  }

  const state = query.state ? String(query.state) : 'all';
  if (state !== 'all') {
    (match.$and as Record<string, unknown>[]).push({
      $or: [
        { 'customerSnapshot.state': state },
        { 'customerSnapshot.address.state': state },
        { 'customerSnapshot.placeholders.State': state },
      ],
    });
  }

  return match;
}

export const OUTSTANDING_STATUSES = [InvoiceStatus.SENT] as const;

export function customerGroupId() {
  return {
    $ifNull: [
      { $toString: '$customerId' },
      { $ifNull: ['$customerSnapshot.name', 'Unknown'] },
    ],
  };
}
