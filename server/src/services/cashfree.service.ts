import crypto from 'crypto';
import { Subscription, Payment } from '../models';
import { SubscriptionStatus } from '@invogen/shared';
import {
  buildCashfreeOrderId,
  getCashfreeBaseUrl,
  readCashfreeCredentials,
  type CashfreeEnvironment,
} from '../config/cashfree';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

const API_VERSION = '2025-01-01';

type CashfreeOrderEntity = {
  order_id: string;
  cf_order_id?: string;
  order_amount: number;
  order_currency: string;
  order_status: string;
  payment_session_id?: string;
};

async function cashfreeRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const { appId, secretKey, environment } = readCashfreeCredentials();
  if (!appId || !secretKey) {
    throw new AppError('Cashfree is not configured. Add CASHFREE_APP_ID and CASHFREE_SECRET_KEY to .env', 503);
  }

  const res = await fetch(`${getCashfreeBaseUrl(environment)}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': appId,
      'x-client-secret': secretKey,
      'x-api-version': API_VERSION,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new AppError(text || 'Cashfree request failed', res.status >= 500 ? 502 : res.status);
  }

  if (!res.ok) {
    const message =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.code === 'string' && data.code) ||
      `Cashfree API error (${res.status})`;
    throw new AppError(message, res.status >= 500 ? 502 : 400);
  }

  return data as T;
}

export const cashfreeService = {
  isConfigured(): boolean {
    const { appId, secretKey } = readCashfreeCredentials();
    return Boolean(appId && secretKey);
  },

  getPublicConfig() {
    const { appId, environment } = readCashfreeCredentials();
    return {
      cashfreeEnabled: this.isConfigured(),
      appId: appId || null,
      environment,
    };
  },

  async getConnectionStatus() {
    const { appId, secretKey, environment } = readCashfreeCredentials();
    if (!appId || !secretKey) {
      return {
        configured: false,
        connected: false,
        appIdPrefix: null,
        environment: null,
        message: 'Add CASHFREE_APP_ID and CASHFREE_SECRET_KEY to .env',
      };
    }

    try {
      await cashfreeRequest<CashfreeOrderEntity>('GET', `/orders/${encodeURIComponent('__ping__')}`);
      return {
        configured: true,
        connected: true,
        appIdPrefix: appId.slice(0, 12),
        environment,
        message: 'Cashfree connected',
      };
    } catch (err) {
      const message = err instanceof AppError ? err.message : 'Cannot connect to Cashfree';
      const connected = !message.includes('does not exist') && !message.includes('order_id');
      return {
        configured: true,
        connected: connected || message.includes('order_id'),
        appIdPrefix: appId.slice(0, 12),
        environment,
        message:
          message.includes('order_id') || message.includes('does not exist')
            ? 'Cashfree API credentials are valid'
            : message,
      };
    }
  },

  async createOrder(params: {
    companyId: string;
    planId: string;
    billingCycle: string;
    amount: number;
    currency: string;
    customer: { id: string; email: string; name: string; phone?: string };
    discountCode?: string;
  }) {
    const orderId = buildCashfreeOrderId('inv');
    const returnUrl = `${env.CLIENT_URL}/admin/subscription/payment?order_id={order_id}`;

    const order = await cashfreeRequest<CashfreeOrderEntity>('POST', '/orders', {
      order_id: orderId,
      order_amount: params.amount,
      order_currency: params.currency || 'INR',
      customer_details: {
        customer_id: params.customer.id.slice(0, 50),
        customer_email: params.customer.email,
        customer_name: params.customer.name || 'Customer',
        customer_phone: params.customer.phone || '9999999999',
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: `${env.API_PUBLIC_URL.replace(/\/api\/v1$/, '')}/api/v1/webhooks/cashfree`,
      },
      order_note: JSON.stringify({
        planId: params.planId,
        companyId: params.companyId,
        billingCycle: params.billingCycle,
        discountCode: params.discountCode,
      }).slice(0, 250),
    });

    if (!order.payment_session_id) {
      throw new AppError('Cashfree did not return a payment session', 502);
    }

    const { appId, environment } = readCashfreeCredentials();
    return {
      planId: params.planId,
      checkoutType: 'order' as const,
      orderId: order.order_id,
      paymentSessionId: order.payment_session_id,
      amount: params.amount,
      currency: params.currency || 'INR',
      appId,
      environment,
      discountCode: params.discountCode,
    };
  },

  async confirmOrderPayment(orderId: string, expectedAmountInr: number) {
    const order = await cashfreeRequest<CashfreeOrderEntity>(
      'GET',
      `/orders/${encodeURIComponent(orderId)}`
    );

    const status = order.order_status?.toUpperCase();
    if (status !== 'PAID') {
      throw new AppError(`Payment not completed. Order status: ${order.order_status}`, 400);
    }

    const paidAmount = Number(order.order_amount);
    if (Math.abs(paidAmount - expectedAmountInr) > 0.01) {
      throw new AppError('Payment amount does not match plan price', 400);
    }

    return order;
  },

  verifyWebhookSignature(body: string, signature: string, timestamp: string): boolean {
    if (!env.CASHFREE_WEBHOOK_SECRET) return false;
    const payload = timestamp + body;
    const expected = crypto
      .createHmac('sha256', env.CASHFREE_WEBHOOK_SECRET)
      .update(payload)
      .digest('base64');
    return expected === signature;
  },

  async handleWebhook(event: string, data: Record<string, unknown>) {
    if (event === 'PAYMENT_SUCCESS_WEBHOOK' || event === 'PAYMENT_CHARGES_WEBHOOK') {
      const order = data.order as { order_id?: string } | undefined;
      const payment = data.payment as { cf_payment_id?: string; payment_status?: string } | undefined;
      if (order?.order_id && payment?.cf_payment_id) {
        await Payment.findOneAndUpdate(
          { razorpayOrderId: order.order_id },
          { status: 'captured', razorpayPaymentId: payment.cf_payment_id }
        );
      }
    }

    if (event === 'SUBSCRIPTION_PAYMENT_SUCCESS') {
      const sub = data.subscription as { subscription_id?: string } | undefined;
      if (sub?.subscription_id) {
        await Subscription.findOneAndUpdate(
          { razorpaySubscriptionId: sub.subscription_id },
          { status: SubscriptionStatus.ACTIVE }
        );
      }
    }
  },
};
