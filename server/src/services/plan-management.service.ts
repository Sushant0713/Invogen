import mongoose from 'mongoose';
import { Plan, PlanType, PlanFeature, PlanDiscount, User } from '../models';
import type { PricingModel } from '../models/PlanType.model';
import { AppError } from '../utils/AppError';
import { BillingCycle, PlanTier, SubscriptionStatus, UserStatus, PlanDiscountPromoType } from '@invogen/shared';
import { discountService, generatePromoCode } from './discount.service';
import {
  resolvePlanTemplateIds,
  serializePlanTemplateIds,
} from '../utils/plan-template-access';

function serializePlanRecord(plan: Record<string, unknown>) {
  const configured =
    plan.templateAccessConfigured === true
    || typeof plan.canAddTemplate === 'boolean';

  return {
    ...plan,
    _id: String(plan._id),
    templateIds: serializePlanTemplateIds(plan.templateIds),
    templateAccessConfigured: configured,
    // Omit for legacy plans so the edit form does not treat them as configured.
    canAddTemplate: configured ? plan.canAddTemplate === true : undefined,
    showMadeWithInvogen: plan.showMadeWithInvogen === true,
  };
}

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const tierFromSlug = (slug: string): PlanTier => {
  if (slug.includes('company')) return PlanTier.COMPANY;
  return PlanTier.BUSINESS;
};

export const syncPlansFromType = async (planType: {
  _id: { toString(): string };
  name: string;
  slug: string;
  description?: string;
  pricingModel?: PricingModel;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  featureIds: { toString(): string }[];
  isActive: boolean;
}) => {
  const features = await PlanFeature.find({ _id: { $in: planType.featureIds } });
  const featureNames = features.map((f) => f.name);
  const tier = tierFromSlug(planType.slug);
  const cycles = [
    { cycle: BillingCycle.MONTHLY, price: planType.monthlyPrice },
    { cycle: BillingCycle.YEARLY, price: planType.yearlyPrice },
  ];

  const activeCycles = cycles.map((c) => c.cycle);
  await Plan.deleteMany({
    planTypeId: planType._id,
    billingCycle: { $nin: activeCycles },
  });

  for (const { cycle, price } of cycles) {
    const label = cycle.charAt(0).toUpperCase() + cycle.slice(1);
    const name = `${planType.name} ${label}`;
    const plan = await Plan.findOneAndUpdate(
      { planTypeId: planType._id, billingCycle: cycle },
      {
        name,
        tier,
        billingCycle: cycle,
        price,
        currency: planType.currency,
        features: featureNames,
        featureIds: planType.featureIds,
        planTypeId: planType._id,
        description: planType.description,
        isActive: planType.isActive,
        visibleOnWebsite: true,
        visibleOnSuperAdmin: true,
      },
      { upsert: true, new: true }
    );
  }
};

const allowedCyclesForModel = (): BillingCycle[] => [
  BillingCycle.MONTHLY,
  BillingCycle.YEARLY,
];

const defaultPriceForCycle = (
  planType: {
    monthlyPrice: number;
    yearlyPrice: number;
  },
  cycle: BillingCycle
) => {
  if (cycle === BillingCycle.MONTHLY) return planType.monthlyPrice;
  return planType.yearlyPrice;
};

const resolveFeaturePayload = async (featureIds: string[]) => {
  if (!featureIds?.length) throw new AppError('Select at least one feature', 400);
  const features = await PlanFeature.find({ _id: { $in: featureIds }, isActive: true });
  if (!features.length) throw new AppError('Selected features are invalid or inactive', 400);
  return {
    featureIds: features.map((f) => f._id),
    featureNames: features.map((f) => f.name),
  };
};

const validatePricing = (data: {
  monthlyPrice?: number;
  yearlyPrice?: number;
}) => {
  if (!data.monthlyPrice && data.monthlyPrice !== 0) throw new AppError('Monthly price is required', 400);
  if (!data.yearlyPrice && data.yearlyPrice !== 0) throw new AppError('Yearly price is required', 400);
};

export const planManagementService = {
  async getPlanTypes() {
    return PlanType.find()
      .select('name slug description pricingModel monthlyPrice yearlyPrice currency featureIds isActive')
      .populate('featureIds', 'name key')
      .sort({ createdAt: -1 });
  },

  async createPlanType(data: {
    name: string;
    description?: string;
    pricingModel: PricingModel;
    monthlyPrice?: number;
    yearlyPrice?: number;
    currency?: string;
    featureIds?: string[];
  }) {
    validatePricing(data);
    const slug = slugify(data.name);
    const existing = await PlanType.findOne({ slug });
    if (existing) throw new AppError('Plan type with this name already exists', 409);

    const planType = await PlanType.create({
      name: data.name,
      slug,
      description: data.description,
      pricingModel: 'subscription',
      monthlyPrice: data.monthlyPrice ?? 0,
      yearlyPrice: data.yearlyPrice ?? 0,
      currency: data.currency || 'INR',
      featureIds: data.featureIds || [],
    });

    return planType.populate('featureIds', 'name key');
  },

  async updatePlanType(id: string, data: Record<string, unknown>) {
    const planType = await PlanType.findById(id);
    if (!planType) throw new AppError('Plan type not found', 404);

    if (data.name && data.name !== planType.name) {
      planType.slug = slugify(data.name as string);
    }

    validatePricing({
      monthlyPrice: (data.monthlyPrice as number) ?? planType.monthlyPrice,
      yearlyPrice: (data.yearlyPrice as number) ?? planType.yearlyPrice,
    });

    Object.assign(planType, data, { pricingModel: 'subscription' });

    await planType.save();
    return planType.populate('featureIds', 'name key');
  },

  async deletePlanType(id: string) {
    const planType = await PlanType.findByIdAndDelete(id);
    if (!planType) throw new AppError('Plan type not found', 404);
    await Plan.deleteMany({ planTypeId: id });
  },

  async getFeatures(): Promise<Array<Record<string, unknown> & { usageCount: number }>> {
    const features = await PlanFeature.find().sort({ name: 1 }).lean();
    const usageCounts = await PlanType.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $unwind: '$featureIds' },
      { $group: { _id: '$featureIds', count: { $sum: 1 } } },
    ]);

    const countMap = new Map(usageCounts.map((row) => [row._id.toString(), row.count]));

    return features.map((feature) => ({
      ...feature,
      usageCount: countMap.get(String(feature._id)) || 0,
    }));
  },

  async createFeature(data: { name: string; description?: string; key?: string }) {
    const key = data.key || slugify(data.name);
    return PlanFeature.create({ ...data, key });
  },

  async updateFeature(id: string, data: Record<string, unknown>) {
    const feature = await PlanFeature.findByIdAndUpdate(id, data, { new: true });
    if (!feature) throw new AppError('Feature not found', 404);
    return feature;
  },

  async deleteFeature(id: string) {
    const feature = await PlanFeature.findByIdAndDelete(id);
    if (!feature) throw new AppError('Feature not found', 404);
    await PlanType.updateMany({ featureIds: id }, { $pull: { featureIds: id } });
  },

  async getDiscounts() {
    const discounts = await PlanDiscount.find({
      billingCycle: { $in: ['all', BillingCycle.MONTHLY, BillingCycle.YEARLY] },
    })
      .populate('planTypeId', 'name slug pricingModel')
      .populate('planId', 'name billingCycle price')
      .sort({ createdAt: -1 })
      .lean();

    return discounts.map((discount) =>
      discountService.attachStatus(discount)
    );
  },

  async createDiscount(data: Record<string, unknown>) {
    discountService.validateDiscountPayload(data as Parameters<typeof discountService.validateDiscountPayload>[0]);

    const code = ((data.code as string) || generatePromoCode()).toUpperCase();
    const existing = await PlanDiscount.findOne({ code });
    if (existing) throw new AppError('Promo code already exists', 409);

    const normalizedDates = discountService.normalizeDiscountDates({
      startDate: data.startDate as string | undefined,
      endDate: data.endDate as string | undefined,
    });

    const payload = {
      ...data,
      code,
      planTypeId: data.planTypeId || undefined,
      planId: data.planId || undefined,
      minOrderAmount: data.minOrderAmount ?? undefined,
      maxUses: data.maxUses ?? undefined,
      ...normalizedDates,
    };

    const discount = await PlanDiscount.create(payload);
    await discount.populate([
      { path: 'planTypeId', select: 'name slug pricingModel' },
      { path: 'planId', select: 'name billingCycle price' },
    ]);
    return discountService.attachStatus(discount.toObject());
  },

  async updateDiscount(id: string, data: Record<string, unknown>) {
    discountService.validateDiscountPayload(data as Parameters<typeof discountService.validateDiscountPayload>[0]);

    if (data.code) {
      const code = (data.code as string).toUpperCase();
      const duplicate = await PlanDiscount.findOne({ code, _id: { $ne: id } });
      if (duplicate) throw new AppError('Promo code already exists', 409);
      data.code = code;
    }

    const update = { ...data };
    if ('startDate' in data) {
      update.startDate = data.startDate
        ? discountService.normalizeDiscountDates({ startDate: data.startDate as string }).startDate
        : undefined;
    }
    if ('endDate' in data) {
      update.endDate = data.endDate
        ? discountService.normalizeDiscountDates({ endDate: data.endDate as string }).endDate
        : undefined;
    }
    if ('planTypeId' in data && !data.planTypeId) update.planTypeId = undefined;
    if ('planId' in data && !data.planId) update.planId = undefined;

    const discount = await PlanDiscount.findByIdAndUpdate(id, update, { new: true });
    if (!discount) throw new AppError('Discount not found', 404);
    await discount.populate([
      { path: 'planTypeId', select: 'name slug pricingModel' },
      { path: 'planId', select: 'name billingCycle price' },
    ]);
    return discountService.attachStatus(discount.toObject());
  },

  async deleteDiscount(id: string) {
    const discount = await PlanDiscount.findByIdAndDelete(id);
    if (!discount) throw new AppError('Discount not found', 404);
  },

  async getPlanList(): Promise<Array<Record<string, unknown>>> {
    const plans = await Plan.find({
      billingCycle: { $in: [BillingCycle.MONTHLY, BillingCycle.YEARLY] },
    })
      .populate('planTypeId', 'name slug pricingModel monthlyPrice yearlyPrice currency')
      .populate('featureIds', 'name')
      .sort({ planTypeId: 1, billingCycle: 1 })
      .lean();

    const discounts = await PlanDiscount.find({
      isActive: true,
      $or: [
        { promoType: { $exists: false } },
        { promoType: PlanDiscountPromoType.SIMPLE },
      ],
    })
      .select('planTypeId planId billingCycle code name promoType')
      .lean();

    const userCounts = await User.aggregate<{ _id: mongoose.Types.ObjectId; userCount: number }>([
      { $match: { companyId: { $ne: null }, status: UserStatus.ACTIVE } },
      {
        $lookup: {
          from: 'subscriptions',
          localField: 'companyId',
          foreignField: 'companyId',
          as: 'subscription',
        },
      },
      { $unwind: '$subscription' },
      {
        $match: {
          'subscription.status': { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
        },
      },
      { $group: { _id: '$subscription.planId', userCount: { $sum: 1 } } },
    ]);

    const userCountMap = new Map(userCounts.map((row) => [row._id.toString(), row.userCount]));

    return plans.map((plan) => {
      const planTypeId = plan.planTypeId?._id?.toString() || plan.planTypeId?.toString();
      const matchingDiscounts = discounts.filter((discount) => {
        const discountTypeId = discount.planTypeId?.toString();
        const discountPlanId = discount.planId?.toString();
        if (discountPlanId && discountPlanId !== plan._id.toString()) return false;
        if (discountTypeId && discountTypeId !== planTypeId) return false;
        if (discount.billingCycle && discount.billingCycle !== 'all' && discount.billingCycle !== plan.billingCycle) {
          return false;
        }
        return true;
      });

      return {
        ...serializePlanRecord(plan as Record<string, unknown>),
        discountCount: matchingDiscounts.length,
        discounts: matchingDiscounts.map((d) => ({ code: d.code, name: d.name })),
        userCount: userCountMap.get(plan._id.toString()) || 0,
      };
    });
  },

  async createPlan(data: {
    planTypeId: string;
    billingCycle: BillingCycle;
    name?: string;
    description?: string;
    featureIds: string[];
    templateIds?: string[];
    canAddTemplate?: boolean;
    templateAccessConfigured?: boolean;
    showMadeWithInvogen?: boolean;
    price: number;
    mrp?: number;
    isActive?: boolean;
    visibleOnWebsite?: boolean;
    visibleOnSuperAdmin?: boolean;
    maxUsers?: number;
    maxInvoices?: number;
    maxProducts?: number;
  }) {
    const planType = await PlanType.findById(data.planTypeId);
    if (!planType) throw new AppError('Plan type not found', 404);

    const allowed = allowedCyclesForModel();
    if (!allowed.includes(data.billingCycle)) {
      throw new AppError('Billing cycle is not available for the selected plan type', 400);
    }

    if (data.price == null || data.price < 0) throw new AppError('Valid price is required', 400);

    const { featureIds, featureNames } = await resolveFeaturePayload(data.featureIds);
    const templateIds = await resolvePlanTemplateIds(data.templateIds);
    const tier = tierFromSlug(planType.slug);
    const label = data.billingCycle.charAt(0).toUpperCase() + data.billingCycle.slice(1);
    const name = (data.name || `${planType.name} ${label}`).trim();

    const planData: any = {
      name,
      description: data.description || planType.description,
      tier,
      billingCycle: data.billingCycle,
      price: data.price,
      mrp: data.mrp != null && data.mrp > 0 ? data.mrp : undefined,
      currency: planType.currency,
      features: featureNames,
      featureIds,
      templateIds,
      canAddTemplate: data.canAddTemplate ?? false,
      templateAccessConfigured: data.templateAccessConfigured ?? true,
      showMadeWithInvogen: data.showMadeWithInvogen === true,
      planTypeId: planType._id,
      isActive: data.isActive ?? true,
      visibleOnWebsite: data.visibleOnWebsite ?? true,
      visibleOnSuperAdmin: data.visibleOnSuperAdmin ?? true,
      maxUsers: data.maxUsers as number | undefined,
      maxInvoices: data.maxInvoices as number | undefined,
      maxProducts: data.maxProducts as number | undefined,
    };
    const plan = await Plan.create(planData);

    await plan.populate([
      { path: 'planTypeId', select: 'name slug pricingModel' },
      { path: 'featureIds', select: 'name' },
    ]);
    return serializePlanRecord(plan.toObject() as unknown as Record<string, unknown>);
  },

  async updatePlan(id: string, data: Record<string, unknown>) {
    const plan = await Plan.findById(id);
    if (!plan) throw new AppError('Plan not found', 404);

    const planType = await PlanType.findById((data.planTypeId as string) || plan.planTypeId);
    if (!planType) throw new AppError('Plan type not found', 404);

    const billingCycle = (data.billingCycle as BillingCycle) || plan.billingCycle;
    const allowed = allowedCyclesForModel();
    if (!allowed.includes(billingCycle)) {
      throw new AppError('Billing cycle is not available for the selected plan type', 400);
    }

    const $set: Record<string, unknown> = {
      tier: tierFromSlug(planType.slug),
      currency: planType.currency,
      planTypeId: planType._id,
      billingCycle,
    };

    if (data.featureIds) {
      const { featureIds, featureNames } = await resolveFeaturePayload(data.featureIds as string[]);
      $set.featureIds = featureIds;
      $set.features = featureNames;
    }

    if (data.templateIds !== undefined) {
      $set.templateIds = await resolvePlanTemplateIds(
        Array.isArray(data.templateIds) ? (data.templateIds as string[]) : []
      );
    }
    if (data.canAddTemplate !== undefined) {
      $set.canAddTemplate = Boolean(data.canAddTemplate);
    }
    if (data.templateAccessConfigured !== undefined) {
      $set.templateAccessConfigured = Boolean(data.templateAccessConfigured);
    }
    if (data.showMadeWithInvogen !== undefined) {
      $set.showMadeWithInvogen = Boolean(data.showMadeWithInvogen);
    }
    
    if (data.maxUsers !== undefined) $set.maxUsers = data.maxUsers as number;
    if (data.maxInvoices !== undefined) $set.maxInvoices = data.maxInvoices as number;
    if (data.maxProducts !== undefined) $set.maxProducts = data.maxProducts as number;

    if (data.name) $set.name = data.name as string;
    if (data.description !== undefined) $set.description = data.description as string;
    if (data.price != null) $set.price = data.price as number;

    const $unset: Record<string, 1> = {};
    if (data.mrp !== undefined) {
      const mrp = data.mrp as number | null;
      if (mrp != null && Number(mrp) > 0) {
        $set.mrp = Number(mrp);
      } else {
        $unset.mrp = 1;
      }
    }

    if (data.isActive != null) $set.isActive = data.isActive as boolean;
    if (data.visibleOnWebsite != null) $set.visibleOnWebsite = data.visibleOnWebsite as boolean;
    if (data.visibleOnSuperAdmin != null) $set.visibleOnSuperAdmin = data.visibleOnSuperAdmin as boolean;
    const update: Record<string, unknown> = { $set };
    if (Object.keys($unset).length) update.$unset = $unset;

    const updated = await Plan.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!updated) throw new AppError('Plan not found', 404);

    await updated.populate([
      { path: 'planTypeId', select: 'name slug pricingModel' },
      { path: 'featureIds', select: 'name' },
    ]);
    return serializePlanRecord(updated.toObject() as unknown as Record<string, unknown>);
  },

  async deletePlan(id: string) {
    const plan = await Plan.findByIdAndDelete(id);
    if (!plan) throw new AppError('Plan not found', 404);
  },
};
