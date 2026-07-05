import { BillingCycle } from '@invogen/shared';
import {
  assertDiscountRedeemable,
  parseDiscountEndDate,
  parseDiscountStartDate,
  resolveDiscountStatus,
  type DiscountStatusInput,
} from '@invogen/shared';
import { PlanDiscount, type IPlanDiscount } from '../models/PlanDiscount.model';
import { AppError } from '../utils/AppError';

export interface DiscountContext {
  planId?: string;
  planTypeId?: string;
  billingCycle?: BillingCycle | string;
  amount: number;
}

export interface AppliedDiscount {
  discount: IPlanDiscount;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
}

const normalizeCode = (code: string) => code.trim().toUpperCase();

export const generatePromoCode = (prefix = 'INV') => {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}${suffix}`;
};

export const calculateDiscountAmount = (
  amount: number,
  discount: Pick<IPlanDiscount, 'discountType' | 'value'>
) => {
  if (discount.discountType === 'percentage') {
    return Math.min(amount, Math.round((amount * discount.value) / 100));
  }
  return Math.min(amount, discount.value);
};

export const discountService = {
  async findByCode(code: string) {
    return PlanDiscount.findOne({ code: normalizeCode(code) });
  },

  validateDiscount(discount: IPlanDiscount, context: DiscountContext) {
    try {
      assertDiscountRedeemable({
        isActive: discount.isActive,
        startDate: discount.startDate,
        endDate: discount.endDate,
        maxUses: discount.maxUses,
        usedCount: discount.usedCount,
      });
    } catch (error) {
      throw new AppError(error instanceof Error ? error.message : 'Invalid promo code', 400);
    }

    if (discount.minOrderAmount != null && context.amount < discount.minOrderAmount) {
      throw new AppError(
        `Minimum order amount is ₹${discount.minOrderAmount}`,
        400
      );
    }

    if (discount.planTypeId && context.planTypeId) {
      if (discount.planTypeId.toString() !== context.planTypeId) {
        throw new AppError('This promo code is not valid for the selected plan type', 400);
      }
    }

    if (discount.planId && context.planId) {
      if (discount.planId.toString() !== context.planId) {
        throw new AppError('This promo code is not valid for the selected plan', 400);
      }
    }

    if (discount.billingCycle && discount.billingCycle !== 'all' && context.billingCycle) {
      if (discount.billingCycle !== context.billingCycle) {
        throw new AppError('This promo code is not valid for this billing cycle', 400);
      }
    }
  },

  applyDiscount(amount: number, discount: IPlanDiscount): AppliedDiscount {
    const discountAmount = calculateDiscountAmount(amount, discount);
    return {
      discount,
      originalAmount: amount,
      discountAmount,
      finalAmount: Math.max(0, amount - discountAmount),
    };
  },

  async validateAndApply(code: string, context: DiscountContext): Promise<AppliedDiscount> {
    const discount = await this.findByCode(code);
    if (!discount) throw new AppError('Invalid promo code', 404);

    this.validateDiscount(discount, context);
    return this.applyDiscount(context.amount, discount);
  },

  async incrementUsage(discountId: string) {
    await PlanDiscount.findByIdAndUpdate(discountId, { $inc: { usedCount: 1 } });
  },

  normalizeDiscountDates(data: {
    startDate?: string | Date | null;
    endDate?: string | Date | null;
  }) {
    return {
      startDate: data.startDate ? parseDiscountStartDate(data.startDate) : undefined,
      endDate: data.endDate ? parseDiscountEndDate(data.endDate) : undefined,
    };
  },

  attachStatus<T extends DiscountStatusInput>(discount: T) {
    const statusSnapshot = resolveDiscountStatus(discount);
    return { ...discount, statusSnapshot };
  },

  resolveDiscountStatus,

  validateDiscountPayload(data: {
    name?: string;
    code?: string;
    discountType?: string;
    value?: number;
    startDate?: string | Date;
    endDate?: string | Date;
    maxUses?: number | null;
    minOrderAmount?: number | null;
  }) {
    if (data.discountType === 'percentage' && data.value != null && data.value > 100) {
      throw new AppError('Percentage discount cannot exceed 100%', 400);
    }

    if (data.value != null && data.value < 0) {
      throw new AppError('Discount value must be positive', 400);
    }

    if (data.startDate && data.endDate) {
      const start = parseDiscountStartDate(data.startDate);
      const end = parseDiscountEndDate(data.endDate);
      if (end < start) {
        throw new AppError('End date must be on or after start date', 400);
      }
    }

    if (data.maxUses != null && data.maxUses < 1) {
      throw new AppError('Max uses must be at least 1', 400);
    }
  },
};
