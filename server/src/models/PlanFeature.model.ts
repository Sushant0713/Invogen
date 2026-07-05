import mongoose, { Schema, Document } from 'mongoose';

export interface IPlanFeature extends Document {
  name: string;
  key: string;
  description?: string;
  isActive: boolean;
}

const planFeatureSchema = new Schema<IPlanFeature>(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const PlanFeature = mongoose.model<IPlanFeature>('PlanFeature', planFeatureSchema);
