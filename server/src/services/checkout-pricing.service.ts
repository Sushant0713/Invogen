import { Plan } from '../models';
import { BillingCycle } from '@invogen/shared';
import { Setting } from '../models';
import { discountService, type AppliedDiscount } from './discount.service';
import { AppError } from '../utils/AppError';

export interface CheckoutQuotePlan {
  _id: string;
  name: string;
  description?: string;
  billingCycle: string;
  price: number;
  currency: string;
  planTypeName?: string;
}

export interface CheckoutQuoteDiscount {
  code: string;
  name: string;
  discountType: string;
  value: number;
  discountAmount: number;
}

export interface CheckoutQuote {
  plan: CheckoutQuotePlan;
  features: string[];
  billingOptions?: {
    monthly?: { _id: string; price: number };
    yearly?: { _id: string; price: number };
  };
  annualSavings?: number;
  pricing: {
    subtotal: number;
    discount: CheckoutQuoteDiscount | null;
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

const round2 = (value: number) => Math.round(value * 100) / 100;

async function getGstRates() {
  const setting = await Setting.findOne({ key: 'invoice_settings', scope: 'system' });
  const value = setting?.value as { cgstRate?: number; sgstRate?: number } | undefined;
  return {
    cgstRate: value?.cgstRate ?? 9,
    sgstRate: value?.sgstRate ?? 9,
  };
}

function planFeatures(plan: {
  features?: string[];
  featureIds?: unknown[];
}): string[] {
  if (plan.featureIds?.length) {
    return plan.featureIds
      .map((f) => {
        if (typeof f === 'object' && f !== null && 'name' in f) {
          return String((f as { name?: string }).name || '');
        }
        return '';
      })
      .filter(Boolean);
  }
  return plan.features || [];
}

async function getBillingOptions(planTypeId: string | undefined) {
  if (!planTypeId) return {};

  const siblings = await Plan.find({
    planTypeId,
    isActive: true,
    isPaused: false,
    visibleOnWebsite: true,
    billingCycle: { $in: ['monthly', 'yearly'] },
  }).select('_id billingCycle price');

  const monthly = siblings.find((p) => p.billingCycle === 'monthly');
  const yearly = siblings.find((p) => p.billingCycle === 'yearly');

  return {
    monthly: monthly ? { _id: monthly._id.toString(), price: monthly.price } : undefined,
    yearly: yearly ? { _id: yearly._id.toString(), price: yearly.price } : undefined,
  };
}

function buildPricing(
  subtotal: number,
  currency: string,
  appliedDiscount: AppliedDiscount | null,
  gstRates: { cgstRate: number; sgstRate: number }
) {
  const discountAmount = appliedDiscount?.discountAmount ?? 0;
  const taxableAmount = round2(Math.max(0, subtotal - discountAmount));
  const cgstAmount = round2((taxableAmount * gstRates.cgstRate) / 100);
  const sgstAmount = round2((taxableAmount * gstRates.sgstRate) / 100);
  const totalGst = round2(cgstAmount + sgstAmount);
  const total = round2(taxableAmount + totalGst);

  return {
    subtotal,
    discount: appliedDiscount
      ? {
          code: appliedDiscount.discount.code,
          name: appliedDiscount.discount.name,
          discountType: appliedDiscount.discount.discountType,
          value: appliedDiscount.discount.value,
          discountAmount: appliedDiscount.discountAmount,
        }
      : null,
    taxableAmount,
    gst: {
      cgstRate: gstRates.cgstRate,
      sgstRate: gstRates.sgstRate,
      cgstAmount,
      sgstAmount,
      totalGst,
    },
    total,
    currency,
  };
}

export const checkoutPricingService = {
  async buildQuote(planId: string, discountCode?: string): Promise<CheckoutQuote> {
    const plan = await Plan.findById(planId).populate('planTypeId').populate('featureIds');
    if (
      !plan ||
      !plan.isActive ||
      plan.isPaused ||
      ![BillingCycle.MONTHLY, BillingCycle.YEARLY].includes(plan.billingCycle)
    ) {
      throw new AppError('Plan not found', 404);
    }
    if (!plan.visibleOnWebsite) {
      throw new AppError('This plan is not available', 400);
    }

    let appliedDiscount: AppliedDiscount | null = null;
    if (discountCode?.trim()) {
      appliedDiscount = await discountService.validateAndApply(discountCode, {
        planId: plan._id.toString(),
        planTypeId:
          (plan.planTypeId as { _id?: { toString(): string } })?._id?.toString() ||
          plan.planTypeId?.toString(),
        billingCycle: plan.billingCycle,
        amount: plan.price,
      });
    }

    const gstRates = await getGstRates();
    const planType = plan.planTypeId as { name?: string; _id?: { toString(): string } } | undefined;
    const planTypeId = planType?._id?.toString() || plan.planTypeId?.toString();
    const billingOptions = await getBillingOptions(planTypeId);

    const annualSavings =
      billingOptions.monthly && billingOptions.yearly
        ? Math.max(0, billingOptions.monthly.price * 12 - billingOptions.yearly.price)
        : 0;

    return {
      plan: {
        _id: plan._id.toString(),
        name: plan.name,
        description: plan.description,
        billingCycle: plan.billingCycle,
        price: plan.price,
        currency: plan.currency || 'INR',
        planTypeName: planType?.name,
      },
      features: planFeatures(plan),
      billingOptions:
        billingOptions.monthly || billingOptions.yearly ? billingOptions : undefined,
      annualSavings: plan.billingCycle === 'yearly' ? annualSavings : undefined,
      pricing: buildPricing(plan.price, plan.currency || 'INR', appliedDiscount, gstRates),
    };
  },

  async resolvePayableTotal(planId: string, discountCode?: string) {
    const quote = await this.buildQuote(planId, discountCode);
    return {
      total: quote.pricing.total,
      currency: quote.pricing.currency,
      pricing: quote.pricing,
    };
  },
};
