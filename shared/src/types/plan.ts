export enum PlanTier {
  BUSINESS = 'business',
  COMPANY = 'company',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELLED = 'cancelled',
  PAUSED = 'paused',
  TRIAL = 'trial',
}

/** How a plan discount is used: checkout coupon vs plans-page banner. */
export const PlanDiscountPromoType = {
  SIMPLE: 'simple',
  BANNER: 'banner',
} as const;

export type PlanDiscountPromoType =
  (typeof PlanDiscountPromoType)[keyof typeof PlanDiscountPromoType];
