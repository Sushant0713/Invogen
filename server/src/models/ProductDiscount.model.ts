import mongoose, { Schema, Document } from 'mongoose';

export type ProductDiscountKind = 'coupon' | 'direct';
export type ProductDiscountType = 'percentage' | 'fixed';
export type ProductDiscountScope = 'all' | 'products' | 'category';

export interface IProductDiscount extends Document {
  companyId?: mongoose.Types.ObjectId;
  kind: ProductDiscountKind;
  name: string;
  code?: string;
  description?: string;
  discountType: ProductDiscountType;
  value: number;
  applyScope: ProductDiscountScope;
  productIds: mongoose.Types.ObjectId[];
  category?: string;
  minOrderAmount?: number;
  minQuantity?: number;
  maxUses?: number;
  usedCount: number;
  startDate?: Date;
  endDate?: Date;
  priority: number;
  isActive: boolean;
}

const productDiscountSchema = new Schema<IProductDiscount>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    kind: { type: String, enum: ['coupon', 'direct'], required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, uppercase: true, trim: true },
    description: { type: String, trim: true },
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: { type: Number, required: true, min: 0 },
    applyScope: { type: String, enum: ['all', 'products', 'category'], default: 'all' },
    productIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    category: { type: String, trim: true },
    minOrderAmount: { type: Number, min: 0 },
    minQuantity: { type: Number, min: 1, default: 1 },
    maxUses: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    startDate: Date,
    endDate: Date,
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productDiscountSchema.index({ companyId: 1, kind: 1, createdAt: -1 });
productDiscountSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { kind: 'coupon', code: { $type: 'string' } } }
);

export const ProductDiscount = mongoose.model<IProductDiscount>('ProductDiscount', productDiscountSchema);
