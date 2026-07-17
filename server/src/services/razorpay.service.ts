import crypto from 'crypto';
import Razorpay from 'razorpay';
import { Subscription, Payment } from '../models';
import { SubscriptionStatus } from '@invogen/shared';
import { buildRazorpayReceipt, readRazorpayCredentials } from '../config/razorpay';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

let client: Razorpay | null = null;

function getClient(): Razorpay {
  const { keyId, keySecret } = readRazorpayCredentials();
  if (!keyId || !keySecret) {
    throw new AppError(
      'Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env',
      503
    );
  }
  if (!client) {
    client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return client;
}

export const razorpayService = {
  isConfigured(): boolean {
    const { keyId, keySecret } = readRazorpayCredentials();
    return Boolean(keyId && keySecret);
  },

  getPublicConfig() {
    const { keyId, environment } = readRazorpayCredentials();
    return {
      razorpayEnabled: this.isConfigured(),
      keyId: keyId || null,
      environment,
    };
  },

  async getConnectionStatus() {
    const { keyId, keySecret, environment } = readRazorpayCredentials();
    if (!keyId || !keySecret) {
      return {
        configured: false,
        connected: false,
        keyIdPrefix: null,
        environment: null,
        message: 'Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env',
      };
    }

    try {
      const rzp = getClient();
      await rzp.orders.all({ count: 1 });
      return {
        configured: true,
        connected: true,
        keyIdPrefix: keyId.slice(0, 12),
        environment,
        message: 'Razorpay connected',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cannot connect to Razorpay';
      return {
        configured: true,
        connected: false,
        keyIdPrefix: keyId.slice(0, 12),
        environment,
        message,
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
    const amountPaise = Math.round(params.amount * 100);
    if (amountPaise < 100) {
      throw new AppError('Plan amount must be at least ₹1 for checkout', 400);
    }

    const rzp = getClient();
    const order = await rzp.orders.create({
      amount: amountPaise,
      currency: params.currency || 'INR',
      receipt: buildRazorpayReceipt('inv'),
      notes: {
        planId: params.planId,
        companyId: params.companyId,
        billingCycle: params.billingCycle,
        discountCode: params.discountCode || '',
        customerId: params.customer.id,
        customerEmail: params.customer.email,
      },
    });

    const { keyId, environment } = readRazorpayCredentials();
    return {
      planId: params.planId,
      checkoutType: 'order' as const,
      orderId: order.id,
      amount: amountPaise,
      amountInr: params.amount,
      currency: params.currency || 'INR',
      keyId,
      environment,
      discountCode: params.discountCode,
      customer: {
        name: params.customer.name,
        email: params.customer.email,
        contact: params.customer.phone,
      },
    };
  },

  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const { keySecret } = readRazorpayCredentials();
    if (!keySecret) return false;
    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return expected === signature;
  },

  async confirmOrderPayment(orderId: string, expectedAmountInr: number) {
    const rzp = getClient();
    const order = await rzp.orders.fetch(orderId);

    if (order.status !== 'paid') {
      throw new AppError(`Payment not completed. Order status: ${order.status}`, 400);
    }

    const paidPaise = Number(order.amount);
    const expectedPaise = Math.round(expectedAmountInr * 100);
    if (Math.abs(paidPaise - expectedPaise) > 1) {
      throw new AppError('Payment amount does not match plan price', 400);
    }

    return order;
  },

  verifyWebhookSignature(body: string, signature: string): boolean {
    if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');
    return expected === signature;
  },

  async handleWebhook(event: string, payload: Record<string, unknown>) {
    if (event === 'payment.captured') {
      const paymentEntity = (payload.payment as { entity?: Record<string, unknown> } | undefined)
        ?.entity;
      if (paymentEntity) {
        const orderId = paymentEntity.order_id as string | undefined;
        const paymentId = paymentEntity.id as string | undefined;
        if (orderId && paymentId) {
          await Payment.findOneAndUpdate(
            { razorpayOrderId: orderId },
            { status: 'captured', razorpayPaymentId: paymentId }
          );
        }
      }
    }

    if (event === 'subscription.activated' || event === 'subscription.charged') {
      const subEntity = (payload.subscription as { entity?: Record<string, unknown> } | undefined)
        ?.entity;
      const subscriptionId = subEntity?.id as string | undefined;
      if (subscriptionId) {
        const sub = await Subscription.findOneAndUpdate(
          { razorpaySubscriptionId: subscriptionId },
          { status: SubscriptionStatus.ACTIVE },
          { new: true }
        ).populate('planId');
        
        if (sub) {
          const maxUsers = (sub.planId as any)?.maxUsers;
          const { subscriptionService } = await import('./subscription.service');
          await subscriptionService.syncEmployeeStatusesWithPlanLimit(sub.companyId.toString(), maxUsers);
        }
      }
    }
  },
};
