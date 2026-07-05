import { InvoiceStatus, InvoiceType } from '@invogen/shared';
import { Company, Invoice, Payment, Plan, Setting, User } from '../models';
import { sendEmail } from '../config/mail';
import { env } from '../config/env';
import { mediaService } from './media.service';
import { buildSubscriptionInvoicePdf } from './platform-invoice-pdf.service';

interface PlatformInvoiceSettings {
  prefix: string;
  numberFormat: string;
  nextNumber: number;
  currency: string;
  invoiceTitle: string;
  seller: {
    name: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    gstin?: string;
    email?: string;
    phone?: string;
    website?: string;
  };
  termsAndConditions?: string;
  thankYouNote?: string;
  subscriptionNote?: string;
  billingSupportEmail?: string;
}

interface PaymentPricingMeta {
  subtotal?: number;
  taxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  totalGst?: number;
  discountAmount?: number;
  discountCode?: string;
  originalAmount?: number;
}

const formatInr = (amount: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatLongDate = (date: Date) =>
  date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

const financialYearLabel = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

const formatInvoiceNumber = (settings: PlatformInvoiceSettings, sequence: number) => {
  const year = new Date().getFullYear();
  const padded = String(sequence).padStart(5, '0');
  return settings.numberFormat
    .replace('{PREFIX}', settings.prefix)
    .replace('{YYYY}', String(year))
    .replace('{NNNNN}', padded)
    .replace('{NNNN}', padded.slice(-4));
};

async function loadPlatformInvoiceSettings(): Promise<PlatformInvoiceSettings> {
  const setting = await Setting.findOne({ key: 'invoice_settings', scope: 'system' });
  const value = (setting?.value || {}) as PlatformInvoiceSettings;
  return {
    prefix: value.prefix || 'INV',
    numberFormat: value.numberFormat || '{PREFIX}-{YYYY}-{NNNNN}',
    nextNumber: value.nextNumber || 1,
    currency: value.currency || 'INR',
    invoiceTitle: value.invoiceTitle || 'INVOICE',
    seller: value.seller || { name: 'Invogen' },
    termsAndConditions: value.termsAndConditions,
    thankYouNote: value.thankYouNote || 'Thank you for your business',
    subscriptionNote: value.subscriptionNote,
    billingSupportEmail: value.billingSupportEmail,
  };
}

async function reserveInvoiceNumber(): Promise<{ invoiceNumber: string; settings: PlatformInvoiceSettings }> {
  const updated = await Setting.findOneAndUpdate(
    { key: 'invoice_settings', scope: 'system' },
    { $inc: { 'value.nextNumber': 1 } },
    { new: false }
  );

  const settings = await loadPlatformInvoiceSettings();
  const sequence =
    updated?.value && typeof updated.value === 'object' && 'nextNumber' in updated.value
      ? Number((updated.value as PlatformInvoiceSettings).nextNumber)
      : settings.nextNumber;

  return {
    invoiceNumber: formatInvoiceNumber(settings, sequence),
    settings,
  };
}

function buildInvoiceEmailHtml(params: {
  invoiceNumber: string;
  issueDate: Date;
  seller: PlatformInvoiceSettings['seller'];
  recipientName: string;
  buyerName: string;
  planName: string;
  billingCycle: string;
  pricing: PaymentPricingMeta;
  total: number;
  currency: string;
  pdfFilename: string;
  paymentsUrl: string;
  billingSupportEmail?: string;
  subscriptionNote?: string;
}) {
  const {
    invoiceNumber,
    issueDate,
    seller,
    recipientName,
    buyerName,
    planName,
    billingCycle,
    pricing,
    total,
    currency,
    pdfFilename,
    paymentsUrl,
    billingSupportEmail,
    subscriptionNote,
  } = params;

  const sellerName = escapeHtml(seller.name || 'Invogen');
  const greetingName = escapeHtml(recipientName || buyerName || 'Customer');
  const safeInvoiceNumber = escapeHtml(invoiceNumber);
  const safePlanName = escapeHtml(planName);
  const safeBillingCycle = escapeHtml(billingCycle);
  const issueDateLabel = formatLongDate(issueDate);
  const fyLabel = financialYearLabel(issueDate);
  const supportEmail = escapeHtml(billingSupportEmail || seller.email || '');
  const supportPhone = seller.phone ? escapeHtml(seller.phone) : '';
  const safePdfFilename = escapeHtml(pdfFilename);

  const discount = pricing.discountAmount ?? 0;
  const cgst = pricing.cgstAmount ?? 0;
  const sgst = pricing.sgstAmount ?? 0;
  const tax = pricing.totalGst ?? cgst + sgst;

  const taxDetail =
    cgst > 0 || sgst > 0
      ? ` (including CGST ${formatInr(cgst, currency)} and SGST ${formatInr(sgst, currency)})`
      : tax > 0
        ? ` (including tax of ${formatInr(tax, currency)})`
        : '';

  const discountDetail =
    discount > 0
      ? ` A discount of ${formatInr(discount, currency)}${pricing.discountCode ? ` (${escapeHtml(pricing.discountCode)})` : ''} was applied.`
      : '';

  const supportParts = [
    supportEmail ? `email us at ${supportEmail}` : '',
    supportPhone ? `call ${supportPhone}` : '',
  ].filter(Boolean);

  const supportText =
    supportParts.length > 0
      ? `please ${supportParts.join(' or ')}.`
      : 'please reach out to our support team.';

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333333;">
  <p style="margin:0 0 16px;">Dear ${greetingName},</p>

  <p style="margin:0 0 16px;">
    Please find attached your subscription tax invoice (Invoice No. ${safeInvoiceNumber}) dated ${issueDateLabel}
    for Financial Year ${fyLabel}, issued to ${escapeHtml(buyerName)} for the ${safePlanName} plan (${safeBillingCycle} billing).
  </p>

  <p style="margin:0 0 16px;">
    We confirm receipt of ${formatInr(total, currency)}${taxDetail} against the above invoice.${discountDetail}
    The invoice is attached to this email as ${safePdfFilename}. Please use a PDF reader to open the attachment.
  </p>

  ${subscriptionNote ? `<p style="margin:0 0 16px;">${escapeHtml(subscriptionNote)}</p>` : ''}

  <p style="margin:0 0 16px;">
    You may also view your payment history online at
    <a href="${paymentsUrl}">${paymentsUrl}</a>.
  </p>

  <p style="margin:0 0 16px;">
    For billing queries or subscription support, ${supportText}
  </p>

  <p style="margin:0 0 4px;">With best regards,</p>
  <p style="margin:0 0 24px;">Team ${sellerName}</p>

  <p style="margin:0;font-size:12px;color:#666666;">
    Please note: This is a computer-generated email. Please do not reply to this message.
    ${seller.gstin ? ` ${sellerName} · GSTIN ${escapeHtml(seller.gstin)}` : ''}
  </p>
</body>
</html>`;
}

export const platformInvoiceService = {
  async issueAndEmailSubscriptionInvoice(params: {
    companyId: string;
    userId: string;
    paymentId: string;
    subscriptionId: string;
    planId: string;
    orderId?: string;
    pricing?: PaymentPricingMeta;
  }) {
    const payment = await Payment.findById(params.paymentId);
    if (!payment) return null;

    const existingMeta = payment.metadata as PaymentPricingMeta & { platformInvoiceId?: string } | undefined;
    if (existingMeta?.platformInvoiceId) {
      const existing = await Invoice.findById(existingMeta.platformInvoiceId);
      if (existing) return existing;
    }

    const [company, user, plan, { invoiceNumber, settings }] = await Promise.all([
      Company.findById(params.companyId),
      User.findById(params.userId),
      Plan.findById(params.planId),
      reserveInvoiceNumber(),
    ]);

    if (!company || !user || !plan) return null;

    const pricing = { ...(params.pricing || {}), ...(payment.metadata as PaymentPricingMeta) };
    const total = payment.amount;
    const subtotal = pricing.subtotal ?? pricing.originalAmount ?? total;
    const cgst = pricing.cgstAmount ?? 0;
    const sgst = pricing.sgstAmount ?? 0;
    const tax = pricing.totalGst ?? cgst + sgst;
    const discount = pricing.discountAmount ?? 0;
    const taxable = pricing.taxableAmount ?? subtotal - discount;

    const issueDate = new Date();
    const buyerName = company.name;
    const buyerEmail = company.email || user.email;

    const invoice = await Invoice.create({
      companyId: company._id,
      invoiceNumber,
      type: InvoiceType.TAX,
      status: InvoiceStatus.PAID,
      customerSnapshot: {
        name: buyerName,
        email: buyerEmail,
        phone: company.phone,
        gst: company.gst,
        pan: company.pan,
        address: company.address,
        platformInvoice: true,
      },
      lineItems: [
        {
          name: plan.name,
          description: `${plan.billingCycle} subscription · Order ${params.orderId || payment.razorpayOrderId || ''}`.trim(),
          quantity: 1,
          unit: 'plan',
          price: taxable,
          discount: 0,
          tax,
          total,
        },
      ],
      totals: {
        subtotal,
        discount,
        tax,
        total,
      },
      issueDate,
      dueDate: issueDate,
      paidAt: issueDate,
      sentAt: issueDate,
      notes: 'Invogen platform subscription invoice',
      terms: settings.termsAndConditions,
      createdBy: user._id,
    });

    payment.metadata = {
      ...(payment.metadata as Record<string, unknown>),
      platformInvoiceId: invoice._id.toString(),
      platformInvoiceNumber: invoiceNumber,
    };
    await payment.save();

    const pdfBuffer = await buildSubscriptionInvoicePdf({
      invoiceNumber,
      invoiceTitle: settings.invoiceTitle || 'INVOICE',
      issueDate,
      seller: settings.seller,
      buyer: {
        name: buyerName,
        email: buyerEmail,
        phone: company.phone,
        gst: company.gst,
        pan: company.pan,
        address: company.address,
      },
      planName: plan.name,
      billingCycle: plan.billingCycle,
      orderId: params.orderId || payment.razorpayOrderId,
      currency: payment.currency || settings.currency,
      subtotal,
      discount,
      discountCode: pricing.discountCode,
      cgst,
      sgst,
      tax,
      total,
      terms: settings.termsAndConditions,
      thankYouNote: settings.thankYouNote,
      subscriptionNote: settings.subscriptionNote,
    });

    const pdfFilename = `${invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    const media = await mediaService.saveFile({
      buffer: pdfBuffer,
      mimetype: 'application/pdf',
      originalname: pdfFilename,
      size: pdfBuffer.length,
      uploadedBy: user._id.toString(),
      companyId: company._id.toString(),
    });

    const pdfUrl = `/api/v1/uploads/${media._id.toString()}`;
    invoice.pdfUrl = pdfUrl;
    await invoice.save();

    const recipient = buyerEmail;
    if (recipient) {
      const paymentsUrl = `${env.CLIENT_URL}/admin/subscription/payments`;
      const recipientName = `${user.firstName} ${user.lastName}`.trim();
      const html = buildInvoiceEmailHtml({
        invoiceNumber,
        issueDate,
        seller: settings.seller,
        recipientName,
        buyerName,
        planName: plan.name,
        billingCycle: plan.billingCycle,
        pricing,
        total,
        currency: payment.currency || settings.currency,
        pdfFilename,
        paymentsUrl,
        billingSupportEmail: settings.billingSupportEmail,
        subscriptionNote: settings.subscriptionNote,
      });

      try {
        await sendEmail({
          to: recipient,
          subject: `Tax Invoice ${invoiceNumber} — ${settings.seller.name || 'Invogen'}`,
          html,
          attachments: [
            {
              filename: pdfFilename,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ],
        });
      } catch (error) {
        console.warn('[platform-invoice] Failed to email invoice:', error);
      }
    }

    return invoice;
  },
};
