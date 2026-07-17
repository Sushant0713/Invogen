import mongoose from 'mongoose';
import { SubscriptionStatus, BillingCycle, UserStatus, PlanDiscountPromoType } from '@invogen/shared';
import { Subscription, Plan, Payment, Employee, User, Product, PlanDiscount } from '../models';
import { AppError } from '../utils/AppError';
import { razorpayService } from './razorpay.service';
import { notificationService } from './notification.service';
import { notifySubscriptionExpired } from '../utils/notification-events';
import { discountService } from './discount.service';

function computePeriodEnd(billingCycle: BillingCycle): Date {
  const end = new Date();
  if (billingCycle === BillingCycle.MONTHLY) {
    end.setMonth(end.getMonth() + 1);
  } else {
    end.setFullYear(end.getFullYear() + 1);
  }
  return end;
}

const SELLABLE_BILLING_CYCLES = [BillingCycle.MONTHLY, BillingCycle.YEARLY];

export const subscriptionService = {
  async syncExpiry(subscription: {
    companyId?: mongoose.Types.ObjectId | string;
    status: SubscriptionStatus;
    currentPeriodEnd?: Date | null;
    planId?: { name?: string } | mongoose.Types.ObjectId;
    save(): Promise<unknown>;
  }) {
    if (
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd < new Date()
    ) {
      subscription.status = SubscriptionStatus.PAST_DUE;
      await subscription.save();
      if (subscription.companyId) {
        const planRef = subscription.planId;
        const planName =
          planRef && typeof planRef === 'object' && 'name' in planRef
            ? String(planRef.name)
            : undefined;
        notificationService.fire(
          notifySubscriptionExpired(String(subscription.companyId), planName)
        );
      }
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
      billingCycle: { $in: SELLABLE_BILLING_CYCLES },
    })
      .populate('planTypeId', 'name slug description')
      .populate('featureIds', 'name')
      .select(
        'name price mrp currency billingCycle tier description features featureIds planTypeId maxUsers maxInvoices maxProducts templateIds canAddTemplate templateAccessConfigured'
      )
      .sort({ price: 1 })
      .lean();
  },

  async getPublicBannerDiscounts() {
    const discounts = await PlanDiscount.find({
      isActive: true,
      promoType: PlanDiscountPromoType.BANNER,
    })
      .select(
        'name code description discountType value planTypeId planId billingCycle startDate endDate maxUses usedCount isActive promoType'
      )
      .sort({ createdAt: -1 })
      .lean();

    return discounts
      .map((discount) => discountService.attachStatus(discount))
      .filter((discount) => {
        const lifecycle = discount.statusSnapshot?.lifecycle;
        return lifecycle === 'active' || lifecycle === 'scheduled';
      });
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
    if (razorpayService.isConfigured()) {
      throw new AppError('Payment is required. Please complete checkout via Razorpay.', 402);
    }

    const plan = await Plan.findById(planId);
    if (
      !plan ||
      !plan.isActive ||
      plan.isPaused ||
      !SELLABLE_BILLING_CYCLES.includes(plan.billingCycle)
    ) {
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
    });
    await subscription.populate('planId');
    await subscription.populate('planId');
    const maxUsers = (subscription.planId as any)?.maxUsers;
    const maxProducts = (subscription.planId as any)?.maxProducts;
    await Promise.all([
      this.syncEmployeeStatusesWithPlanLimit(companyId, maxUsers),
      this.syncProductStatusesWithPlanLimit(companyId, maxProducts),
    ]);

    return subscription;
  },

  async assignPlanByAdmin(companyId: string, planId: string) {
    const plan = await Plan.findById(planId);
    if (
      !plan ||
      !plan.isActive ||
      !SELLABLE_BILLING_CYCLES.includes(plan.billingCycle)
    ) {
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
    });

    await subscription.populate('planId');
    const maxUsers = (subscription.planId as any)?.maxUsers;
    const maxProducts = (subscription.planId as any)?.maxProducts;
    await Promise.all([
      this.syncEmployeeStatusesWithPlanLimit(companyId, maxUsers),
      this.syncProductStatusesWithPlanLimit(companyId, maxProducts),
    ]);

    return subscription;
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

  async syncEmployeeStatusesWithPlanLimit(companyId: string, maxUsers?: number | null) {
    const employees = await Employee.find({ companyId }).populate('userId').sort({ createdAt: 1 });
    let totalActive = 1; // Count Admin as 1

    for (const employee of employees) {
      const user = employee.userId as any;
      if (!user || user.status === UserStatus.PENDING) continue;

      if (maxUsers !== undefined && maxUsers !== null && totalActive >= maxUsers) {
        if (user.status === UserStatus.ACTIVE) {
          user.status = UserStatus.SUSPENDED;
          user.refreshTokenHash = undefined;
          employee.suspendedBySystem = true;
          await Promise.all([user.save(), employee.save()]);
        }
      } else {
        if (employee.suspendedBySystem) {
          user.status = UserStatus.ACTIVE;
          employee.suspendedBySystem = false;
          await Promise.all([user.save(), employee.save()]);
          totalActive++;
        } else if (user.status === UserStatus.ACTIVE) {
          totalActive++;
        }
      }
    }
  },

  async syncProductStatusesWithPlanLimit(companyId: string, maxProducts?: number | null) {
    const products = await Product.find({ companyId }).sort({ createdAt: 1 });
    let totalActive = 0;

    for (const product of products) {
      if (maxProducts !== undefined && maxProducts !== null && totalActive >= maxProducts) {
        if (product.isActive) {
          product.isActive = false;
          product.suspendedBySystem = true;
          await product.save();
        }
      } else {
        if (product.suspendedBySystem) {
          product.isActive = true;
          product.suspendedBySystem = false;
          await product.save();
          totalActive++;
        } else if (product.isActive) {
          totalActive++;
        }
      }
    }
  }
};
