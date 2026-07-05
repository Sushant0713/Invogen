import mongoose from 'mongoose';
import { SubscriptionStatus, BillingCycle } from '@invogen/shared';
import { Subscription, Plan, Payment } from '../models';
import { AppError } from '../utils/AppError';
import { cashfreeService } from './cashfree.service';

function computePeriodEnd(billingCycle: BillingCycle): Date {
  const end = new Date();
  if (billingCycle === BillingCycle.MONTHLY) {
    end.setMonth(end.getMonth() + 1);
  } else if (billingCycle === BillingCycle.YEARLY) {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setFullYear(end.getFullYear() + 100);
  }
  return end;
}

export const subscriptionService = {
  async syncExpiry(subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd?: Date | null;
    save(): Promise<unknown>;
  }) {
    if (
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd < new Date()
    ) {
      subscription.status = SubscriptionStatus.PAST_DUE;
      await subscription.save();
    }
  },

  isSubscriptionActive(subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd?: Date | null;
  } | null): boolean {
    if (!subscription) return false;
    const activeStatus =
      subscription.status === SubscriptionStatus.ACTIVE ||
      subscription.status === SubscriptionStatus.TRIAL;
    if (!activeStatus) return false;
    if (!subscription.currentPeriodEnd) return true;
    return subscription.currentPeriodEnd > new Date();
  },

  async getLatestSubscription(companyId: string) {
    const subscription = await Subscription.findOne({ companyId })
      .populate({
        path: 'planId',
        populate: { path: 'featureIds', select: 'name' },
      })
      .sort({ createdAt: -1 });
    if (subscription) {
      await this.syncExpiry(subscription);
    }
    return subscription;
  },

  async getStatus(companyId: string) {
    const subscription = await this.getLatestSubscription(companyId);
    return {
      active: this.isSubscriptionActive(subscription),
      subscription,
    };
  },

  async isCompanySubscriptionActive(companyId: string | null | undefined): Promise<boolean> {
    if (!companyId) return false;
    const { active } = await this.getStatus(companyId);
    return active;
  },

  async getAvailablePlans() {
    return Plan.find({
      isActive: true,
      isPaused: false,
      visibleOnWebsite: true,
    })
      .populate('planTypeId', 'name slug')
      .populate('featureIds', 'name')
      .sort({ price: 1 })
      .lean();
  },

  async getSubscriptionHistory(companyId: string) {
    return Subscription.find({ companyId })
      .populate({
        path: 'planId',
        populate: { path: 'featureIds', select: 'name' },
      })
      .sort({ createdAt: -1 })
      .lean();
  },

  async getPaymentHistory(companyId: string) {
    return Payment.find({ companyId })
      .populate('subscriptionId')
      .sort({ createdAt: -1 })
      .lean();
  },

  async getBillingSummary(companyId: string) {
    const companyObjectId = new mongoose.Types.ObjectId(companyId);
    const [payments, subscription, totals] = await Promise.all([
      Payment.find({ companyId }).sort({ createdAt: -1 }).limit(5).lean(),
      this.getLatestSubscription(companyId),
      Payment.aggregate([
        {
          $match: {
            companyId: companyObjectId,
            status: 'captured',
          },
        },
        {
          $group: {
            _id: null,
            totalSpent: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return {
      active: this.isSubscriptionActive(subscription),
      subscription,
      recentPayments: payments,
      totalSpent: totals[0]?.totalSpent ?? 0,
      paymentCount: totals[0]?.count ?? 0,
    };
  },

  async selectPlan(companyId: string, planId: string) {
    if (cashfreeService.isConfigured()) {
      throw new AppError('Payment is required. Please complete checkout via Cashfree.', 402);
    }

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive || plan.isPaused) {
      throw new AppError('Plan not found', 404);
    }
    if (!plan.visibleOnWebsite) {
      throw new AppError('This plan is not available', 400);
    }

    await Subscription.updateMany(
      {
        companyId,
        status: {
          $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.PAST_DUE],
        },
      },
      { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() }
    );

    const subscription = await Subscription.create({
      companyId,
      planId: plan._id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: computePeriodEnd(plan.billingCycle),
      maintenanceDueDate:
        plan.billingCycle === BillingCycle.LIFETIME
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : undefined,
    });

    return subscription.populate('planId');
  },

  async assignPlanByAdmin(companyId: string, planId: string) {
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      throw new AppError('Plan not found', 404);
    }

    await Subscription.updateMany(
      {
        companyId,
        status: {
          $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.PAST_DUE],
        },
      },
      { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() }
    );

    const subscription = await Subscription.create({
      companyId,
      planId: plan._id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: computePeriodEnd(plan.billingCycle),
      maintenanceDueDate:
        plan.billingCycle === BillingCycle.LIFETIME
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : undefined,
    });

    return subscription.populate('planId');
  },

  async updateSubscriptionStatus(companyId: string, status: SubscriptionStatus) {
    const subscription = await Subscription.findOne({ companyId }).sort({ createdAt: -1 });
    if (!subscription) throw new AppError('No subscription found', 404);
    subscription.status = status;
    if (status === SubscriptionStatus.CANCELLED) {
      subscription.cancelledAt = new Date();
    }
    await subscription.save();
    return subscription.populate('planId');
  },
};
