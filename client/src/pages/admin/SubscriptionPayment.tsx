import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '@/api/client';
import { useAppSelector } from '@/hooks/useAppDispatch';
import { cn, formatCurrency } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  billingCycleLabel,
  canSwitchBillingCycle,
  clearCheckoutCart,
  readCheckoutCart,
  selectedBillingCycle,
  storeCheckoutCart,
  type CheckoutQuote,
} from '@/lib/subscription-checkout';
import { BillingCycleToggle } from '@/components/subscription/BillingCycleToggle';
import {
  openCashfreeCheckout,
  readPendingCheckout,
  clearPendingCheckout,
  type CashfreeCheckoutSession,
} from '@/lib/cashfree';

export default function SubscriptionPayment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const authUser = useAppSelector((s) => s.auth.user);

  const planId = searchParams.get('planId');
  const discountCode = searchParams.get('discountCode') || undefined;
  const orderIdFromReturn = searchParams.get('order_id');

  const [paying, setPaying] = useState(false);
  const verifyingReturnRef = useRef(false);

  useEffect(() => {
    if (planId) {
      storeCheckoutCart({ planId, discountCode });
    }
  }, [planId, discountCode]);

  const { data: paymentConfig, isLoading: configLoading } = useQuery({
    queryKey: ['admin-payment-config'],
    queryFn: async () => (await api.get('/admin/subscription/payment-config')).data.data as {
      cashfreeEnabled: boolean;
    },
    staleTime: 0,
  });

  const cart = planId ? { planId, discountCode } : readCheckoutCart();

  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ['checkout-quote', cart?.planId, cart?.discountCode],
    queryFn: async () => {
      const params = new URLSearchParams({ planId: cart!.planId });
      if (cart?.discountCode) params.set('discountCode', cart.discountCode);
      const res = await api.get<{ data: CheckoutQuote }>(`/admin/subscription/quote?${params}`);
      return res.data.data;
    },
    enabled: !!cart?.planId,
    staleTime: 0,
    retry: false,
  });

  const cashfreeEnabled = paymentConfig?.cashfreeEnabled ?? false;

  const invalidateSubscription = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-subscription-status'] });
    queryClient.invalidateQueries({ queryKey: ['admin-subscription'] });
    queryClient.invalidateQueries({ queryKey: ['admin-subscription-billing-summary'] });
    queryClient.invalidateQueries({ queryKey: ['admin-subscription-history'] });
    queryClient.invalidateQueries({ queryKey: ['admin-subscription-payments'] });
  };

  const verifyMutation = useMutation({
    mutationFn: (payload: { planId: string; orderId: string; discountCode?: string }) =>
      api.post('/admin/subscription/verify', payload),
    onSuccess: () => {
      clearPendingCheckout();
      clearCheckoutCart();
      invalidateSubscription();
      toast.success('Payment successful — welcome to Invogen!');
      navigate('/admin/dashboard');
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Payment verification failed');
    },
    onSettled: () => setPaying(false),
  });

  const selectPlanMutation = useMutation({
    mutationFn: (id: string) => api.post('/admin/subscription/select', { planId: id }),
    onSuccess: () => {
      clearCheckoutCart();
      invalidateSubscription();
      toast.success('Your plan is now active');
      navigate('/admin/dashboard');
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not activate plan');
    },
    onSettled: () => setPaying(false),
  });

  useEffect(() => {
    if (!orderIdFromReturn || verifyingReturnRef.current || verifyMutation.isPending) return;
    const pending = readPendingCheckout(orderIdFromReturn);
    const resolvedPlanId = pending?.planId || cart?.planId;
    if (!resolvedPlanId) return;
    verifyingReturnRef.current = true;
    verifyMutation.mutate({
      planId: resolvedPlanId,
      orderId: orderIdFromReturn,
      discountCode: pending?.discountCode || cart?.discountCode,
    });
    setSearchParams({}, { replace: true });
  }, [orderIdFromReturn, cart?.planId, cart?.discountCode, setSearchParams, verifyMutation.isPending]);

  const handlePay = async () => {
    if (!cart?.planId || !authUser) return;

    if (!cashfreeEnabled) {
      setPaying(true);
      selectPlanMutation.mutate(cart.planId);
      return;
    }

    setPaying(true);
    try {
      const res = await api.post('/admin/subscription/checkout', {
        planId: cart.planId,
        discountCode: cart.discountCode,
      });
      await openCashfreeCheckout(res.data.data as CashfreeCheckoutSession);
    } catch (err: unknown) {
      clearPendingCheckout();
      setPaying(false);
      const statusCode = (err as { response?: { status?: number } })?.response?.status;
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (statusCode === 401) toast.error(message || 'Session expired');
      else if (statusCode === 502) toast.error(message || 'Payment gateway error');
      else toast.error(message || 'Checkout failed');
    }
  };

  useEffect(() => {
    if (!cart?.planId && !orderIdFromReturn) {
      navigate('/admin/subscription/plans', { replace: true });
    }
  }, [cart?.planId, orderIdFromReturn, navigate]);

  const switchBillingCycle = async (cycle: 'monthly' | 'yearly') => {
    if (!quote?.billingOptions || !cart?.planId) return;
    const option = quote.billingOptions[cycle];
    if (!option || option._id === cart.planId) return;

    const preservedCode = cart.discountCode || quote.pricing.discount?.code;
    let discountCode = preservedCode;

    if (preservedCode) {
      try {
        const params = new URLSearchParams({ planId: option._id, discountCode: preservedCode });
        await api.get<{ data: CheckoutQuote }>(`/admin/subscription/quote?${params}`);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 400 || status === 404) {
          discountCode = undefined;
          toast.message('Coupon is not valid for this billing cycle');
        } else {
          toast.error('Could not switch billing cycle');
          return;
        }
      }
    }

    const params = new URLSearchParams({ planId: option._id });
    if (discountCode) params.set('discountCode', discountCode);
    navigate(`/admin/subscription/payment?${params}`, { replace: true });
  };

  if (configLoading || quoteLoading || !cart?.planId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <p className="text-gray-600">Unable to load payment details.</p>
        <Link to="/admin/subscription/cart" className="mt-4 text-sm text-primary hover:underline">
          Return to cart
        </Link>
      </div>
    );
  }

  const currency = quote.pricing.currency;

  return (
    <div className="relative min-h-full overflow-hidden bg-white">
      {(verifyMutation.isPending || paying) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border border-gray-100 bg-white px-10 py-8 text-center shadow-xl"
          >
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-lg font-medium text-gray-900">
              {verifyMutation.isPending ? 'Confirming payment…' : 'Redirecting to payment…'}
            </p>
            <p className="mt-1 text-sm text-gray-500">Please do not close this window</p>
          </motion.div>
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-12">
        <nav className="mb-8 flex items-center gap-2 text-sm text-gray-400">
          <Link to="/admin/subscription/plans" className="transition-colors hover:text-primary">
            Plans
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            to={`/admin/subscription/cart?planId=${cart.planId}${cart.discountCode ? `&discountCode=${cart.discountCode}` : ''}`}
            className="transition-colors hover:text-primary"
          >
            Cart
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-gray-900">Payment</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Complete payment</h1>
          <p className="mt-2 text-sm text-gray-500">
            Review your order and pay securely{cashfreeEnabled ? ' via Cashfree' : ''}.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Payment panel */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="flex items-center gap-3 border-b border-gray-100 pb-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </span>
              <div>
                <h2 className="font-semibold text-gray-900">Payment method</h2>
                <p className="text-sm text-gray-500">
                  {cashfreeEnabled
                    ? 'UPI, cards, net banking & wallets'
                    : 'Development mode — instant activation'}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Billing to</p>
                <p className="mt-2 text-sm font-medium text-gray-900">
                  {authUser?.firstName} {authUser?.lastName}
                </p>
                <p className="text-sm text-gray-500">{authUser?.email}</p>
              </div>

              {cashfreeEnabled ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {['UPI', 'Cards', 'Net Banking'].map((method) => (
                    <div
                      key={method}
                      className="flex items-center justify-center rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600"
                    >
                      {method}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                  Payment gateway is not configured. Your plan will activate immediately for testing.
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to={`/admin/subscription/cart?planId=${cart.planId}${cart.discountCode ? `&discountCode=${cart.discountCode}` : ''}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to cart
              </Link>
              <button
                type="button"
                disabled={paying || verifyMutation.isPending}
                onClick={handlePay}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600',
                  'disabled:cursor-not-allowed disabled:opacity-60'
                )}
              >
                {paying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : cashfreeEnabled ? (
                  <>
                    <Lock className="h-4 w-4" />
                    Pay {formatCurrency(quote.pricing.total, currency)}
                  </>
                ) : (
                  'Activate plan now'
                )}
              </button>
            </div>

            {cashfreeEnabled && (
              <p className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                256-bit SSL · PCI DSS compliant · Cashfree Secure
              </p>
            )}
          </motion.div>

          {/* Order recap */}
          <motion.aside
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="h-fit rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:sticky lg:top-24"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Order recap</h3>

            <div className="mt-5 border-b border-gray-100 pb-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{quote.plan.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {billingCycleLabel(quote.plan.billingCycle)} plan
                  </p>
                </div>
                {canSwitchBillingCycle(quote) && (
                  <BillingCycleToggle
                    value={selectedBillingCycle(quote)}
                    onChange={switchBillingCycle}
                  />
                )}
              </div>
              {quote.annualSavings != null && quote.annualSavings > 0 && quote.plan.billingCycle === 'yearly' && (
                <p className="mt-2 text-xs font-medium text-emerald-600">
                  Save {formatCurrency(quote.annualSavings, currency)} annually
                </p>
              )}
            </div>

            <ul className="mt-4 max-h-40 space-y-2 overflow-y-auto">
              {quote.features.slice(0, 5).map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                  <Check className="h-3 w-3 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
              {quote.features.length > 5 && (
                <li className="text-xs text-gray-400">+{quote.features.length - 5} more features</li>
              )}
            </ul>

            <div className="mt-5 space-y-2 border-t border-gray-100 pt-5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCurrency(quote.pricing.subtotal, currency)}</span>
              </div>
              {quote.pricing.discount && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span className="tabular-nums">
                    −{formatCurrency(quote.pricing.discount.discountAmount, currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-gray-500">
                <span>GST ({quote.pricing.gst.cgstRate + quote.pricing.gst.sgstRate}%)</span>
                <span className="tabular-nums">{formatCurrency(quote.pricing.gst.totalGst, currency)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-3 text-base font-semibold text-gray-900">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(quote.pricing.total, currency)}</span>
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
