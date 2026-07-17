import mongoose, { Schema, Document } from 'mongoose';
import { BillingCycle, PlanDiscountPromoType } from '@invogen/shared';

export interface IPlanDiscount extends Document {
  name: string;
  code: string;
  description?: string;
  promoType: PlanDiscountPromoType;
  discountType: 'percentage' | 'fixed';
  value: number;
  planTypeId?: mongoose.Types.ObjectId;
  planId?: mongoose.Types.ObjectId;
  billingCycle?: BillingCycle | 'all';
  minOrderAmount?: number;
  maxUses?: number;
  usedCount: number;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
}

const planDiscountSchema = new Schema<IPlanDiscount>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true },
    promoType: {
      type: String,
      enum: Object.values(PlanDiscountPromoType),
      default: PlanDiscountPromoType.SIMPLE,
    },
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: { type: Number, required: true, min: 0 },
    planTypeId: { type: Schema.Types.ObjectId, ref: 'PlanType' },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan' },
    billingCycle: {
      type: String,
      enum: [...Object.values(BillingCycle), 'all'],
      default: 'all',
    },
    minOrderAmount: { type: Number, min: 0 },
    maxUses: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    startDate: Date,
    endDate: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const PlanDiscount =
  (mongoose.models.PlanDiscount as mongoose.Model<IPlanDiscount> | undefined) ||
  mongoose.model<IPlanDiscount>('PlanDiscount', planDiscountSchema);
