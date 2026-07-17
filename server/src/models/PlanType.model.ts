import mongoose, { Schema, Document } from 'mongoose';

export type PricingModel = 'subscription';

export interface IPlanType extends Document {
  name: string;
  slug: string;
  description?: string;
  pricingModel: PricingModel;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  featureIds: mongoose.Types.ObjectId[];
  isActive: boolean;
}

const planTypeSchema = new Schema<IPlanType>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String },
    pricingModel: {
      type: String,
      enum: ['subscription'],
      default: 'subscription',
    },
    monthlyPrice: { type: Number, default: 0, min: 0 },
    yearlyPrice: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR' },
    featureIds: [{ type: Schema.Types.ObjectId, ref: 'PlanFeature' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const PlanType = mongoose.model<IPlanType>('PlanType', planTypeSchema);
