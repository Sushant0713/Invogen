import { InvoiceStatus } from '@invogen/shared';
import type { HydratedDocument } from 'mongoose';
import type { IInvoice } from '../models/Invoice.model';
import { notificationService } from '../services/notification.service';

export async function notifyInvoiceCreated(
  companyId: string,
  invoice: { _id: { toString(): string }; invoiceNumber: string }
) {
  await notificationService.notifyCompanyAdmins(
    companyId,
    {
      title: 'Invoice created',
      message: `Invoice ${invoice.invoiceNumber} was created successfully.`,
      type: 'success',
      link: `/admin/invoices/${invoice._id.toString()}`,
      metadata: { invoiceId: invoice._id.toString(), invoiceNumber: invoice.invoiceNumber },
    },
    'invoiceCreated'
  );
}

export async function notifyInvoicePaid(
  companyId: string,
  invoice: {
    _id: { toString(): string };
    invoiceNumber: string;
    totals?: { total?: number };
    customerSnapshot?: { name?: string };
  }
) {
  const customerName =
    (invoice.customerSnapshot as { name?: string } | undefined)?.name || 'Customer';
  const amount = invoice.totals?.total ?? 0;

  await notificationService.notifyCompanyAdmins(
    companyId,
    {
      title: 'Payment received',
      message: `Payment received for ${invoice.invoiceNumber} (${customerName}) — ₹${amount.toLocaleString('en-IN')}.`,
      type: 'success',
      link: `/admin/invoices/${invoice._id.toString()}`,
      metadata: { invoiceId: invoice._id.toString(), invoiceNumber: invoice.invoiceNumber },
    },
    'paymentReceived'
  );
}

export async function notifySubscriptionRenewed(
  companyId: string,
  planName: string,
  amount?: number
) {
  const amountLabel = amount != null ? ` — ₹${amount.toLocaleString('en-IN')}` : '';
  await notificationService.notifyCompanyAdmins(
    companyId,
    {
      title: 'Subscription renewed',
      message: `Your ${planName} subscription is now active${amountLabel}.`,
      type: 'success',
      link: '/admin/subscription',
      metadata: { planName },
    },
    'subscriptionRenewal'
  );
}

export async function notifySubscriptionExpired(companyId: string, planName?: string) {
  await notificationService.notifyCompanyAdmins(
    companyId,
    {
      title: 'Subscription expired',
      message: planName
        ? `Your ${planName} subscription has expired. Renew to continue using Invogen.`
        : 'Your subscription has expired. Renew to continue using Invogen.',
      type: 'warning',
      link: '/admin/subscription',
    },
    'subscriptionExpired'
  );
}

export async function notifySubscriptionExpiringSoon(params: {
  companyId: string;
  companyName: string;
  planName: string;
  daysRemaining: number;
  reminderDate: string;
}) {
  const { companyId, companyName, planName, daysRemaining, reminderDate } = params;
  const dayLabel =
    daysRemaining > 0
      ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`
      : daysRemaining === 0
        ? 'ends today'
        : `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} overdue`;

  await notificationService.notifyCompanyAdmins(
    companyId,
    {
      title: 'Plan ending soon',
      message:
        daysRemaining >= 0
          ? `Your ${planName} plan has ${dayLabel}. Renew to keep uninterrupted access.`
          : `Your ${planName} plan ${dayLabel}. Renew to continue using Invogen.`,
      type: 'warning',
      link: '/admin/subscription',
      metadata: {
        kind: 'subscriptionExpiringSoon',
        companyId,
        reminderDate,
        daysRemaining,
        planName,
      },
    },
    'subscriptionExpiringSoon'
  );

  await notificationService.notifySuperAdmins({
    title: 'Client plan ending soon',
    message: `${companyName}'s ${planName} plan has ${dayLabel}.`,
    type: 'warning',
    link: '/super-admin/clients',
    metadata: {
      kind: 'subscriptionExpiringSoon',
      companyId,
      reminderDate,
      daysRemaining,
      planName,
      companyName,
    },
  });
}

export async function notifySupportTicketUpdated(params: {
  userId: string;
  companyId?: string | null;
  ticketId: string;
  subject: string;
  status: string;
}) {
  await notificationService.notifyUser(
    params.userId,
    {
      title: 'Support ticket updated',
      message: `"${params.subject}" is now ${params.status.replace(/_/g, ' ')}.`,
      type: 'info',
      link: '/admin/settings',
      metadata: { ticketId: params.ticketId, status: params.status },
    },
    { companyId: params.companyId, settingKey: 'supportTicketUpdates' }
  );
}

export async function notifyNewClientRegistered(params: {
  companyName: string;
  email: string;
  clientUserId: string;
}) {
  await notificationService.notifySuperAdmins({
    title: 'New client registered',
    message: `${params.companyName} (${params.email}) joined the platform.`,
    type: 'info',
    link: '/super-admin/clients',
    metadata: { clientUserId: params.clientUserId, email: params.email },
  });
}

export async function notifyInvoiceStatusIfPaid(
  companyId: string,
  invoice: HydratedDocument<IInvoice>,
  previousStatus: InvoiceStatus,
  nextStatus: InvoiceStatus
) {
  if (nextStatus !== InvoiceStatus.PAID || previousStatus === InvoiceStatus.PAID) {
    return;
  }
  await notifyInvoicePaid(companyId, invoice);
}
