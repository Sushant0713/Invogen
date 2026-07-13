import mongoose from 'mongoose';
import {
  assertDiscountRedeemable,
  resolveDiscountStatus,
  type DiscountStatusInput,
} from '@invogen/shared';
import { Product } from '../models/Product.model';
import { Company } from '../models/Company.model';
import {
  ProductDiscount,
  type IProductDiscount,
  type ProductDiscountKind,
  type ProductDiscountScope,
} from '../models/ProductDiscount.model';
import { AppError } from '../utils/AppError';
import { getPagination, buildMeta } from '../utils/response';
import {
  calculateDiscountAmount,
  discountService,
  generatePromoCode,
} from './discount.service';

const normalizeCode = (code: string) => code.trim().toUpperCase();

function isDiscountLive(discount: Pick<IProductDiscount, 'isActive' | 'startDate' | 'endDate'>) {
  try {
    assertDiscountRedeemable({
      isActive: discount.isActive,
      startDate: discount.startDate,
      endDate: discount.endDate,
      maxUses: undefined,
      usedCount: 0,
    });
    return true;
  } catch {
    return false;
  }
}

function buildProductFilter(
  companyId: mongoose.Types.ObjectId,
  applyScope: ProductDiscountScope,
  productIds?: mongoose.Types.ObjectId[],
  category?: string
) {
  const filter: Record<string, unknown> = { companyId };
  if (applyScope === 'products' && productIds?.length) {
    filter._id = { $in: productIds };
  } else if (applyScope === 'category' && category?.trim()) {
    filter.category = category.trim();
  }
  return filter;
}

async function syncDirectDiscountToProducts(
  discount: IProductDiscount,
  previousProductIds?: string[],
  resetOnly = false
) {
  if (discount.kind !== 'direct' || !discount.companyId) return;

  const companyId = discount.companyId;
  const resetIds = previousProductIds?.filter(Boolean) || [];
  if (resetIds.length) {
    await Product.updateMany(
      { companyId, _id: { $in: resetIds } },
      { $set: { discount: 0, discountType: 'percentage' } }
    );
  }

  const live = resetOnly ? false : isDiscountLive(discount);
  const filter = buildProductFilter(
    companyId,
    discount.applyScope,
    discount.productIds,
    discount.category
  );

  if (!live) {
    await Product.updateMany(filter, { $set: { discount: 0, discountType: 'percentage' } });
    return;
  }

  await Product.updateMany(filter, {
    $set: {
      discount: discount.value,
      discountType: discount.discountType === 'fixed' ? 'fixed' : 'percentage',
    },
  });
}

function attachStatus<T extends DiscountStatusInput>(discount: T) {
  return { ...discount, statusSnapshot: resolveDiscountStatus(discount) };
}

function validatePayload(data: Record<string, unknown>, kind: ProductDiscountKind, isUpdate = false) {
  discountService.validateDiscountPayload(data as Parameters<typeof discountService.validateDiscountPayload>[0]);

  if (!isUpdate && !data.name) {
    throw new AppError('Discount name is required', 400);
  }

  if (kind === 'coupon' && !isUpdate && !data.code && data.code !== '') {
    // code auto-generated if empty
  }

  if (kind === 'direct' && data.applyScope === 'products') {
    const ids = data.productIds as string[] | undefined;
    if (!ids?.length) {
      throw new AppError('Select at least one product for product-specific discount', 400);
    }
  }

  if (kind === 'direct' && data.applyScope === 'category' && !data.category) {
    throw new AppError('Category is required for category-based discount', 400);
  }
}

function normalizePayload(data: Record<string, unknown>, kind: ProductDiscountKind) {
  const payload: Record<string, unknown> = { ...data, kind };

  if (kind === 'coupon') {
    payload.code = ((data.code as string) || generatePromoCode('PD')).toUpperCase();
    payload.applyScope = data.applyScope || 'all';
  }

  if (kind === 'direct') {
    payload.discountType = data.discountType === 'fixed' ? 'fixed' : 'percentage';
    payload.applyScope = data.applyScope || 'all';
    payload.productIds = Array.isArray(data.productIds)
      ? data.productIds.filter(Boolean)
      : [];
    if (payload.applyScope !== 'category') payload.category = undefined;
    if (payload.applyScope !== 'products') payload.productIds = [];
  }

  if ('startDate' in data || 'endDate' in data) {
    Object.assign(
      payload,
      discountService.normalizeDiscountDates({
        startDate: data.startDate as string | undefined,
        endDate: data.endDate as string | undefined,
      })
    );
  }

  if (data.minOrderAmount === '' || data.minOrderAmount == null) payload.minOrderAmount = undefined;
  if (data.maxUses === '' || data.maxUses == null) payload.maxUses = undefined;
  if (data.minQuantity === '' || data.minQuantity == null) payload.minQuantity = 1;
  if (data.priority === '' || data.priority == null) payload.priority = 0;

  return payload;
}

export interface ProductCouponContext {
  companyId?: string;
  amount: number;
  quantity?: number;
  productIds?: string[];
  category?: string;
}

export const productDiscountService = {
  async list(query: Record<string, unknown>, companyId?: string) {
    const kind = query.kind as ProductDiscountKind | undefined;
    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const filter: Record<string, unknown> = {};

    if (companyId) filter.companyId = new mongoose.Types.ObjectId(companyId);
    if (kind) filter.kind = kind;
    if (!companyId && kind === 'coupon') {
      filter.kind = 'coupon';
    }

    const search = typeof query.search === 'string' ? query.search.trim() : '';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      ProductDiscount.find(filter)
        .populate('companyId', 'name')
        .populate('productIds', 'name sku price category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProductDiscount.countDocuments(filter),
    ]);

    return {
      data: data.map((row) => attachStatus(row as DiscountStatusInput)),
      meta: buildMeta(page, limit, total),
    };
  },

  async getCompaniesForSelect() {
    return Company.find().select('name').sort({ name: 1 }).lean();
  },

  async getProductsForCompany(companyId: string) {
    if (!companyId) throw new AppError('Company is required', 400);
    return Product.find({ companyId })
      .select('name sku price category discount discountType')
      .collation({ locale: 'en', numericOrdering: true })
      .sort({ name: 1 })
      .limit(500)
      .lean();
  },

  async create(data: Record<string, unknown>, companyId?: string) {
    const kind = (data.kind as ProductDiscountKind) || 'direct';
    if (kind === 'direct' && !companyId && !data.companyId) {
      throw new AppError('Company is required for direct product discounts', 400);
    }

    validatePayload(data, kind);

    const payload = normalizePayload(data, kind);
    if (companyId) {
      payload.companyId = new mongoose.Types.ObjectId(companyId);
    } else if (payload.companyId) {
      payload.companyId = new mongoose.Types.ObjectId(payload.companyId as string);
    }

    if (kind === 'coupon') {
      const code = payload.code as string;
      const existing = await ProductDiscount.findOne({ code, kind: 'coupon' });
      if (existing) throw new AppError('Coupon code already exists', 409);
    }

    const discount = await ProductDiscount.create(payload);
    if (kind === 'direct') {
      await syncDirectDiscountToProducts(discount);
    }

    await discount.populate([
      { path: 'companyId', select: 'name' },
      { path: 'productIds', select: 'name sku price category' },
    ]);
    return attachStatus(discount.toObject() as DiscountStatusInput);
  },

  async update(id: string, data: Record<string, unknown>, companyId?: string) {
    const existing = await ProductDiscount.findById(id);
    if (!existing) throw new AppError('Discount not found', 404);
    if (companyId && existing.companyId?.toString() !== companyId) {
      throw new AppError('Discount not found', 404);
    }

    validatePayload(data, existing.kind, true);

    if (data.code) {
      const code = normalizeCode(data.code as string);
      const duplicate = await ProductDiscount.findOne({
        code,
        kind: 'coupon',
        _id: { $ne: id },
      });
      if (duplicate) throw new AppError('Coupon code already exists', 409);
      data.code = code;
    }

    const previousProductIds =
      existing.kind === 'direct'
        ? existing.productIds.map((pid) => pid.toString())
        : undefined;

    const update = normalizePayload({ ...existing.toObject(), ...data }, existing.kind);
    delete update._id;
    delete update.createdAt;
    delete update.updatedAt;
    delete update.usedCount;

    const discount = await ProductDiscount.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!discount) throw new AppError('Discount not found', 404);

    if (discount.kind === 'direct') {
      await syncDirectDiscountToProducts(discount, previousProductIds);
    }

    await discount.populate([
      { path: 'companyId', select: 'name' },
      { path: 'productIds', select: 'name sku price category' },
    ]);
    return attachStatus(discount.toObject() as DiscountStatusInput);
  },

  async remove(id: string, companyId?: string) {
    const discount = await ProductDiscount.findById(id);
    if (!discount) throw new AppError('Discount not found', 404);
    if (companyId && discount.companyId?.toString() !== companyId) {
      throw new AppError('Discount not found', 404);
    }

    if (discount.kind === 'direct') {
      await syncDirectDiscountToProducts(
        discount,
        discount.productIds.map((pid) => pid.toString()),
        true
      );
    }

    await ProductDiscount.findByIdAndDelete(id);
  },

  async validateCoupon(code: string, context: ProductCouponContext) {
    const discount = await ProductDiscount.findOne({
      code: normalizeCode(code),
      kind: 'coupon',
    });
    if (!discount) throw new AppError('Invalid coupon code', 404);

    try {
      assertDiscountRedeemable({
        isActive: discount.isActive,
        startDate: discount.startDate,
        endDate: discount.endDate,
        maxUses: discount.maxUses,
        usedCount: discount.usedCount,
      });
    } catch (error) {
      throw new AppError(error instanceof Error ? error.message : 'Coupon is not valid', 400);
    }

    if (discount.companyId && context.companyId) {
      if (discount.companyId.toString() !== context.companyId) {
        throw new AppError('This coupon is not valid for your account', 400);
      }
    }

    if (discount.minOrderAmount != null && context.amount < discount.minOrderAmount) {
      throw new AppError(`Minimum order amount is ₹${discount.minOrderAmount}`, 400);
    }

    if (discount.minQuantity != null && (context.quantity ?? 1) < discount.minQuantity) {
      throw new AppError(`Minimum quantity is ${discount.minQuantity}`, 400);
    }

    if (discount.applyScope === 'category' && discount.category) {
      if (!context.category || context.category.toLowerCase() !== discount.category.toLowerCase()) {
        throw new AppError('This coupon does not apply to the selected category', 400);
      }
    }

    const discountAmount = calculateDiscountAmount(context.amount, discount);
    return {
      discount: attachStatus(discount.toObject() as DiscountStatusInput),
      originalAmount: context.amount,
      discountAmount,
      finalAmount: Math.max(0, context.amount - discountAmount),
    };
  },

  async incrementCouponUsage(id: string) {
    await ProductDiscount.findOneAndUpdate({ _id: id, kind: 'coupon' }, { $inc: { usedCount: 1 } });
  },
};
