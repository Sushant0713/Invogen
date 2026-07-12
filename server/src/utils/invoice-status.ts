import { InvoiceStatus } from '@invogen/shared';
import type { HydratedDocument } from 'mongoose';
import type { IInvoice } from '../models/Invoice.model';
import { AppError } from './AppError';

const TOGGLE_STATUSES = [InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.PAID] as const;

const STATUS_RANK: Partial<Record<InvoiceStatus, number>> = {
  [InvoiceStatus.DRAFT]: 0,
  [InvoiceStatus.SENT]: 1,
  [InvoiceStatus.PAID]: 2,
};

export function assertForwardInvoiceStatusChange(
  current: InvoiceStatus,
  next: InvoiceStatus
): void {
  if (!TOGGLE_STATUSES.includes(next as (typeof TOGGLE_STATUSES)[number])) {
    throw new AppError('Status must be draft, sent, or paid', 400);
  }

  const currentRank = STATUS_RANK[current];
  const nextRank = STATUS_RANK[next];

  if (current === InvoiceStatus.PAID && next !== InvoiceStatus.PAID) {
    throw new AppError('Paid invoices cannot be changed', 400);
  }

  if (
    currentRank !== undefined &&
    nextRank !== undefined &&
    nextRank < currentRank
  ) {
    throw new AppError('Invoice status cannot be moved backward', 400);
  }
}

export async function applyForwardInvoiceStatus(
  invoice: HydratedDocument<IInvoice>,
  status: InvoiceStatus
): Promise<HydratedDocument<IInvoice>> {
  assertForwardInvoiceStatusChange(invoice.status as InvoiceStatus, status);

  if (invoice.status === status) {
    return invoice;
  }

  invoice.status = status;
  if (status === InvoiceStatus.SENT && !invoice.sentAt) {
    invoice.sentAt = new Date();
  }
  if (status === InvoiceStatus.PAID) {
    invoice.paidAt = new Date();
  }

  await invoice.save();
  return invoice;
}
