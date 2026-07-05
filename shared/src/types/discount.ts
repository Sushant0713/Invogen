export type DiscountLifecycleStatus =
  | 'inactive'
  | 'scheduled'
  | 'active'
  | 'expired'
  | 'exhausted';

export interface DiscountStatusInput {
  isActive: boolean;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  maxUses?: number | null;
  usedCount?: number;
}

export interface DiscountStatusSnapshot {
  lifecycle: DiscountLifecycleStatus;
  label: string;
  description: string;
  redeemable: boolean;
  startsAt?: string;
  endsAt?: string;
  daysUntilStart?: number;
  daysUntilEnd?: number;
}

export const DISCOUNT_STATUS_CONFIG: Record<
  DiscountLifecycleStatus,
  { label: string; description: string }
> = {
  inactive: {
    label: 'Inactive',
    description: 'Disabled by admin — not available for redemption',
  },
  scheduled: {
    label: 'Scheduled',
    description: 'Configured and enabled, but not yet within the start date',
  },
  active: {
    label: 'Active',
    description: 'Available for redemption right now',
  },
  expired: {
    label: 'Expired',
    description: 'Past the configured end date',
  },
  exhausted: {
    label: 'Exhausted',
    description: 'Maximum redemption limit has been reached',
  },
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function parseDiscountStartDate(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0)
    );
  }
  const [year, month, day] = value.split('T')[0].split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function parseDiscountEndDate(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999)
    );
  }
  const [year, month, day] = value.split('T')[0].split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

const daysBetween = (from: Date, to: Date) =>
  Math.max(0, Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY));

export function resolveDiscountStatus(
  discount: DiscountStatusInput,
  now: Date = new Date()
): DiscountStatusSnapshot {
  if (!discount.isActive) {
    return {
      lifecycle: 'inactive',
      ...DISCOUNT_STATUS_CONFIG.inactive,
      redeemable: false,
    };
  }

  const startsAt = discount.startDate ? parseDiscountStartDate(discount.startDate) : undefined;
  const endsAt = discount.endDate ? parseDiscountEndDate(discount.endDate) : undefined;

  if (startsAt && now < startsAt) {
    const daysUntilStart = daysBetween(now, startsAt);
    return {
      lifecycle: 'scheduled',
      label: DISCOUNT_STATUS_CONFIG.scheduled.label,
      description:
        daysUntilStart <= 1
          ? 'Starts tomorrow'
          : `Starts in ${daysUntilStart} days`,
      redeemable: false,
      startsAt: startsAt.toISOString(),
      daysUntilStart,
    };
  }

  if (endsAt && now > endsAt) {
    return {
      lifecycle: 'expired',
      ...DISCOUNT_STATUS_CONFIG.expired,
      redeemable: false,
      endsAt: endsAt.toISOString(),
    };
  }

  if (discount.maxUses != null && (discount.usedCount ?? 0) >= discount.maxUses) {
    return {
      lifecycle: 'exhausted',
      ...DISCOUNT_STATUS_CONFIG.exhausted,
      redeemable: false,
    };
  }

  let description = DISCOUNT_STATUS_CONFIG.active.description;
  let daysUntilEnd: number | undefined;

  if (endsAt) {
    daysUntilEnd = daysBetween(now, endsAt);
    if (daysUntilEnd <= 1) {
      description = 'Ends today';
    } else if (daysUntilEnd <= 7) {
      description = `Ends in ${daysUntilEnd} days`;
    }
  }

  return {
    lifecycle: 'active',
    label: DISCOUNT_STATUS_CONFIG.active.label,
    description,
    redeemable: true,
    startsAt: startsAt?.toISOString(),
    endsAt: endsAt?.toISOString(),
    daysUntilEnd,
  };
}

export function assertDiscountRedeemable(
  discount: DiscountStatusInput,
  now: Date = new Date()
): DiscountStatusSnapshot {
  const status = resolveDiscountStatus(discount, now);
  if (status.redeemable) return status;

  switch (status.lifecycle) {
    case 'inactive':
      throw new Error('This promo code is inactive');
    case 'scheduled':
      throw new Error(
        status.startsAt
          ? `This promo code starts on ${formatDiscountDate(status.startsAt)}`
          : 'This promo code is not active yet'
      );
    case 'expired':
      throw new Error('This promo code has expired');
    case 'exhausted':
      throw new Error('This promo code has reached its usage limit');
    default:
      throw new Error('This promo code cannot be used');
  }
}

export function formatDiscountDate(isoDate: string) {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(isoDate));
}
