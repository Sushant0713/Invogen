import { InvoiceStatus } from '@invogen/shared';

export const PLATFORM_INVOICE_FILTER = {
  'customerSnapshot.platformInvoice': true,
} as const;

export function buildPlatformInvoiceMatch(
  from: Date,
  to: Date,
  query: Record<string, unknown>
) {
  const match: Record<string, unknown> = {
    ...PLATFORM_INVOICE_FILTER,
    createdAt: { $gte: from, $lte: to },
  };

  const status = query.status ? String(query.status) : 'all';
  if (status !== 'all') {
    match.status = status;
  }

  const state = query.state ? String(query.state) : 'all';
  if (state !== 'all') {
    match.$and = [
      {
        $or: [
          { 'customerSnapshot.state': state },
          { 'customerSnapshot.address.state': state },
          { 'customerSnapshot.placeholders.State': state },
        ],
      },
    ];
  }

  return match;
}

export function buildPlatformPaidInvoiceMatch(
  from: Date,
  to: Date,
  query: Record<string, unknown>
) {
  return buildPlatformInvoiceMatch(from, to, {
    ...query,
    status: InvoiceStatus.PAID,
    state: 'all',
  });
}

export function buildPaymentDateMatch(
  from: Date,
  to: Date,
  status?: string
) {
  const match: Record<string, unknown> = {
    createdAt: { $gte: from, $lte: to },
  };
  if (status && status !== 'all') {
    match.status = status;
  }
  return match;
}

export function getPlatformCustomerState(
  snap?: {
    state?: string;
    address?: { state?: string };
    placeholders?: Record<string, unknown>;
  } | null
) {
  const fromState = snap?.state?.trim();
  if (fromState) return fromState;
  const fromAddress = snap?.address?.state?.trim();
  if (fromAddress) return fromAddress;
  return String(snap?.placeholders?.State ?? '').trim();
}
