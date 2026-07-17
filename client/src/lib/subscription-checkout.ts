const CHECKOUT_CART_KEY = 'invogen_checkout_cart';

export interface CheckoutCart {
  planId: string;
  discountCode?: string;
}

export interface CheckoutBillingOption {
  _id: string;
  price: number;
}

export interface CheckoutQuote {
  plan: {
    _id: string;
    name: string;
    description?: string;
    billingCycle: string;
    price: number;
    currency: string;
    planTypeName?: string;
  };
  features: string[];
  billingOptions?: {
    monthly?: CheckoutBillingOption;
    yearly?: CheckoutBillingOption;
  };
  annualSavings?: number;
  pricing: {
    subtotal: number;
    discount: {
      code: string;
      name: string;
      discountType: string;
      value: number;
      discountAmount: number;
    } | null;
    taxableAmount: number;
    gst: {
      cgstRate: number;
      sgstRate: number;
      cgstAmount: number;
      sgstAmount: number;
      totalGst: number;
    };
    total: number;
    currency: string;
  };
}

export function storeCheckoutCart(cart: CheckoutCart) {
  sessionStorage.setItem(CHECKOUT_CART_KEY, JSON.stringify(cart));
}

export function readCheckoutCart(): CheckoutCart | null {
  const raw = sessionStorage.getItem(CHECKOUT_CART_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CheckoutCart;
  } catch {
    return null;
  }
}

export function clearCheckoutCart() {
  sessionStorage.removeItem(CHECKOUT_CART_KEY);
}

/** Cart path used after login/register when a plan was chosen on the public plans page. */
export function checkoutPathForPlan(planId: string, discountCode?: string) {
  const params = new URLSearchParams({ planId });
  if (discountCode) params.set('discountCode', discountCode);
  return `/admin/subscription/cart?${params.toString()}`;
}

/** Prefer planId from URL, then session cart (set when choosing a plan while logged out). */
export function resolvePendingPlanId(search?: string | URLSearchParams | null): string | null {
  const params =
    typeof search === 'string'
      ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
      : search instanceof URLSearchParams
        ? search
        : null;
  const fromUrl = params?.get('planId')?.trim();
  if (fromUrl) return fromUrl;
  return readCheckoutCart()?.planId ?? null;
}

export function billingCycleLabel(cycle: string) {
  if (cycle === 'monthly') return 'Monthly';
  if (cycle === 'yearly') return 'Yearly';
  return cycle;
}

export function billingCycleSuffix(cycle: string) {
  if (cycle === 'monthly') return '/mo';
  if (cycle === 'yearly') return '/yr';
  return '';
}

export function canSwitchBillingCycle(quote: CheckoutQuote) {
  return Boolean(quote.billingOptions?.monthly && quote.billingOptions?.yearly);
}

export function selectedBillingCycle(quote: CheckoutQuote): 'monthly' | 'yearly' {
  return quote.plan.billingCycle === 'monthly' ? 'monthly' : 'yearly';
}
