export interface CashfreeCheckoutSession {
  planId: string;
  orderId: string;
  paymentSessionId: string;
  amount: number;
  currency?: string;
  appId?: string | null;
  environment?: 'sandbox' | 'production';
  discountCode?: string;
}

declare global {
  interface Window {
    Cashfree?: (config: { mode: 'sandbox' | 'production' }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget?: '_self' | '_blank' | '_top' | '_modal';
      }) => Promise<{ error?: { message?: string } }>;
    };
  }
}

const PENDING_CHECKOUT_KEY = 'invogen_cashfree_checkout';

let scriptPromise: Promise<void> | null = null;

function loadCashfreeScript(): Promise<void> {
  if (window.Cashfree) return Promise.resolve();

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Cashfree checkout'));
      document.body.appendChild(script);
    });
  }

  return scriptPromise;
}

export function storePendingCheckout(session: CashfreeCheckoutSession) {
  sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(session));
}

export function readPendingCheckout(orderId: string): CashfreeCheckoutSession | null {
  const raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as CashfreeCheckoutSession;
    if (data.orderId === orderId) return data;
  } catch {
    /* ignore */
  }
  return null;
}

export function clearPendingCheckout() {
  sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
}

export async function openCashfreeCheckout(session: CashfreeCheckoutSession): Promise<void> {
  await loadCashfreeScript();

  if (!window.Cashfree) {
    throw new Error('Cashfree checkout is unavailable');
  }

  const mode = session.environment === 'production' ? 'production' : 'sandbox';
  const cashfree = window.Cashfree({ mode });

  storePendingCheckout(session);

  const result = await cashfree.checkout({
    paymentSessionId: session.paymentSessionId,
    redirectTarget: '_self',
  });

  if (result?.error) {
    clearPendingCheckout();
    throw new Error(result.error.message || 'Cashfree checkout failed');
  }
}
