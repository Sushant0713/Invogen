import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '@/api/client';
import { cn, formatCurrency } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Loader2,
  Shield,
  ShoppingCart,
  Tag,
  X,
} from 'lucide-react';
import {
  billingCycleLabel,
  billingCycleSuffix,
  canSwitchBillingCycle,
  clearCheckoutCart,
  readCheckoutCart,
  selectedBillingCycle,
  storeCheckoutCart,
  type CheckoutCart,
  type CheckoutQuote,
} from '@/lib/subscription-checkout';
import { BillingCycleToggle } from '@/components/subscription/BillingCycleToggle';

function PriceRow({
  label,
  value,
  muted,
  highlight,
  negative,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className={cn(muted ? 'text-gray-500' : 'text-gray-700')}>{label}</span>
      <span
        className={cn(
          'font-medium tabular-nums',
          highlight && 'text-base font-semibold text-gray-900',
          negative && 'text-emerald-600',
          !highlight && !negative && 'text-gray-900'
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default function SubscriptionCart() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planIdFromUrl = searchParams.get('planId');

  const [cart, setCart] = useState<CheckoutCart | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | undefined>();

  useEffect(() => {
    const stored = readCheckoutCart();
    const planId = planIdFromUrl || stored?.planId;
    if (!planId) {
      navigate('/admin/subscription/plans', { replace: true });
      return;
    }
    const discountFromUrl = searchParams.get('discountCode') ?? undefined;
    const next: CheckoutCart = {
      planId,
      discountCode: discountFromUrl ?? stored?.discountCode,
    };
    setCart(next);
    setAppliedCode(next.discountCode);
    if (next.discountCode) setPromoInput(next.discountCode);
    storeCheckoutCart(next);
  }, [planIdFromUrl, searchParams, navigate]);

  const { data: quote, isLoading, isError, refetch } = useQuery({
    queryKey: ['checkout-quote', cart?.planId, appliedCode],
    queryFn: async () => {
      const params = new URLSearchParams({ planId: cart!.planId });
      if (appliedCode) params.set('discountCode', appliedCode);
      try {
        const res = await api.get<{ data: CheckoutQuote }>(`/admin/subscription/quote?${params}`);
        return res.data.data;
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (appliedCode && (status === 400 || status === 404)) {
          setAppliedCode(undefined);
          setPromoInput('');
          const cleared: CheckoutCart = { planId: cart!.planId };
          setCart(cleared);
          storeCheckoutCart(cleared);
          toast.message('Coupon is not valid for this plan');
          const fallback = await api.get<{ data: CheckoutQuote }>(
            `/admin/subscription/quote?planId=${cart!.planId}`
          );
          return fallback.data.data;
        }
        throw err;
      }
    },
    enabled: !!cart?.planId,
    staleTime: 0,
  });

  const applyMutation = useMutation({
    mutationFn: async (code: string) => {
      const params = new URLSearchParams({ planId: cart!.planId, discountCode: code });
      const res = await api.get<{ data: CheckoutQuote }>(`/admin/subscription/quote?${params}`);
      return res.data.data;
    },
    onSuccess: (data, code) => {
      setAppliedCode(code);
      const next = { planId: cart!.planId, discountCode: code };
      setCart(next);
      storeCheckoutCart(next);
      toast.success('Coupon applied');
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Invalid coupon code');
    },
  });

  const removeCoupon = () => {
    setAppliedCode(undefined);
    setPromoInput('');
    const next = { planId: cart!.planId };
    setCart(next);
    storeCheckoutCart(next);
    refetch();
  };

  const proceedToPayment = () => {
    if (!cart?.planId) return;
    const params = new URLSearchParams({ planId: cart.planId });
    const code = appliedCode || cart.discountCode;
    if (code) params.set('discountCode', code);
    navigate(`/admin/subscription/payment?${params}`);
  };

  const switchBillingCycle = async (cycle: 'monthly' | 'yearly') => {
    if (!quote?.billingOptions || !cart) return;
    const option = quote.billingOptions[cycle];
    if (!option || option._id === cart.planId) return;

    const preservedCode = appliedCode || cart.discountCode;
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

    const next: CheckoutCart = { planId: option._id, discountCode };
    setCart(next);
    setAppliedCode(discountCode);
    setPromoInput(discountCode || '');
    storeCheckoutCart(next);

    const urlParams = new URLSearchParams({ planId: option._id });
    if (discountCode) urlParams.set('discountCode', discountCode);
    navigate(`/admin/subscription/cart?${urlParams}`, { replace: true });
  };

  if (!cart || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (isError || !quote) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <p className="text-gray-600">Could not load your cart. The plan may no longer be available.</p>
        <Link
          to="/admin/subscription/plans"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to plans
        </Link>
      </div>
    );
  }

  const currency = quote.pricing.currency;

  return (
    <div className="relative min-h-full overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-12">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-gray-400">
          <Link to="/admin/subscription/plans" className="transition-colors hover:text-primary">
            Plans
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-gray-900">Cart</span>
        </nav>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <ShoppingCart className="h-3.5 w-3.5" />
              Your cart
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Review your subscription
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Confirm plan details, apply a coupon, and review GST before payment.
            </p>
          </div>
          <Link
            to="/admin/subscription/plans"
            className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Change plan
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Plan details */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-6">
              <div className="min-w-0 flex-1">
                {quote.plan.planTypeName && (
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {quote.plan.planTypeName}
                  </p>
                )}
                <h2 className="mt-1 text-xl font-bold text-gray-900">{quote.plan.name}</h2>
                {quote.plan.description && (
                  <p className="mt-1.5 text-sm text-gray-500">{quote.plan.description}</p>
                )}
                {quote.annualSavings != null && quote.annualSavings > 0 && quote.plan.billingCycle === 'yearly' && (
                  <p className="mt-2 text-sm font-medium text-emerald-600">
                    Save {formatCurrency(quote.annualSavings, currency)} with yearly billing
                  </p>
                )}
              </div>
              {canSwitchBillingCycle(quote) ? (
                <BillingCycleToggle
                  value={selectedBillingCycle(quote)}
                  onChange={switchBillingCycle}
                />
              ) : (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  {billingCycleLabel(quote.plan.billingCycle)}
                </span>
              )}
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Included features
              </p>
              <ul className="mt-4 space-y-2.5">
                {quote.features.length > 0 ? (
                  quote.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Check className="h-3 w-3 text-primary" strokeWidth={2.5} />
                      </span>
                      {feature}
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-gray-400">Full platform access included</li>
                )}
              </ul>
            </div>

            <div className="mt-8 flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-500">
              <Shield className="h-4 w-4 shrink-0 text-primary" />
              Secure checkout · GST-compliant invoice after payment
            </div>
          </motion.div>

          {/* Order summary */}
          <motion.aside
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="h-fit rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:sticky lg:top-24"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              Order summary
            </h3>

            {canSwitchBillingCycle(quote) && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                <span className="text-xs font-medium text-gray-600">Billing cycle</span>
                <BillingCycleToggle
                  value={selectedBillingCycle(quote)}
                  onChange={switchBillingCycle}
                />
              </div>
            )}

            {/* Coupon */}
            <div className={cn(canSwitchBillingCycle(quote) ? 'mt-4' : 'mt-5')}>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <Tag className="h-3.5 w-3.5" />
                Coupon code
              </label>
              {quote.pricing.discount ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">{quote.pricing.discount.code}</p>
                    <p className="text-xs text-emerald-600">{quote.pricing.discount.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"
                    aria-label="Remove coupon"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    disabled={!promoInput.trim() || applyMutation.isPending}
                    onClick={() => applyMutation.mutate(promoInput.trim().toUpperCase())}
                    className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {applyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </button>
                </div>
              )}
            </div>

            {/* Pricing breakdown */}
            <div className="mt-6 space-y-3 border-t border-gray-100 pt-6">
              <PriceRow
                label={`Plan price${billingCycleSuffix(quote.plan.billingCycle)}`}
                value={formatCurrency(quote.pricing.subtotal, currency)}
              />
              {quote.pricing.discount && (
                <PriceRow
                  label={`Discount (${quote.pricing.discount.code})`}
                  value={`−${formatCurrency(quote.pricing.discount.discountAmount, currency)}`}
                  negative
                />
              )}
              <PriceRow
                label="Taxable amount"
                value={formatCurrency(quote.pricing.taxableAmount, currency)}
                muted
              />
              <PriceRow
                label={`CGST @ ${quote.pricing.gst.cgstRate}%`}
                value={formatCurrency(quote.pricing.gst.cgstAmount, currency)}
                muted
              />
              <PriceRow
                label={`SGST @ ${quote.pricing.gst.sgstRate}%`}
                value={formatCurrency(quote.pricing.gst.sgstAmount, currency)}
                muted
              />
              <div className="border-t border-gray-100 pt-3">
                <PriceRow
                  label="Total payable"
                  value={formatCurrency(quote.pricing.total, currency)}
                  highlight
                />
              </div>
            </div>

            <button
              type="button"
              onClick={proceedToPayment}
              className="group mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
            >
              Proceed to payment
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                clearCheckoutCart();
                navigate('/admin/subscription/plans');
              }}
              className="mt-3 w-full text-center text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel and return to plans
            </button>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
