export interface RazorpayCheckoutSession {
  planId: string;
  orderId: string;
  amount: number;
  amountInr?: number;
  currency?: string;
  keyId: string;
  environment?: 'test' | 'live';
  discountCode?: string;
  customer?: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

export interface RazorpayPaymentResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

const PENDING_CHECKOUT_KEY = 'invogen_razorpay_checkout';

let scriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
      document.body.appendChild(script);
    });
  }

  return scriptPromise;
}

export function storePendingCheckout(session: RazorpayCheckoutSession) {
  sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(session));
}

export function readPendingCheckout(orderId: string): RazorpayCheckoutSession | null {
  const raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as RazorpayCheckoutSession;
    if (data.orderId === orderId) return data;
  } catch {
    /* ignore */
  }
  return null;
}

export function clearPendingCheckout() {
  sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
}

export async function openRazorpayCheckout(
  session: RazorpayCheckoutSession
): Promise<RazorpayPaymentResult> {
  await loadRazorpayScript();

  if (!window.Razorpay) {
    throw new Error('Razorpay checkout is unavailable');
  }

  storePendingCheckout(session);

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: session.keyId,
      amount: session.amount,
      currency: session.currency || 'INR',
      name: 'Invogen',
      description: 'Subscription payment',
      order_id: session.orderId,
      prefill: {
        name: session.customer?.name || '',
        email: session.customer?.email || '',
        contact: session.customer?.contact || '',
      },
      theme: { color: '#2563eb' },
      handler: (response: RazorpayPaymentResult) => {
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          clearPendingCheckout();
          reject(new Error('Payment cancelled'));
        },
      },
    });

    rzp.on('payment.failed', (response: unknown) => {
      clearPendingCheckout();
      const err = response as { error?: { description?: string } };
      reject(new Error(err.error?.description || 'Payment failed'));
    });

    rzp.open();
  });
}
