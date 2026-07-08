import mongoose, { Schema, Document } from 'mongoose';
import { PlanTier, BillingCycle } from '@invogen/shared';

export interface IPlan extends Document {
  name: string;
  tier: PlanTier;
  billingCycle: BillingCycle;
  price: number;
  currency: string;
  features: string[];
  featureIds?: mongoose.Types.ObjectId[];
  planTypeId?: mongoose.Types.ObjectId;
  razorpayPlanId?: string;
  maintenanceCharge?: number;
  isActive: boolean;
  isPaused: boolean;
  visibleOnWebsite: boolean;
  visibleOnSuperAdmin: boolean;
  /** Pre-built (system) templates clients on this plan may access. */
  templateIds?: mongoose.Types.ObjectId[];
  /** When false, clients cannot create custom templates. */
  canAddTemplate?: boolean;
  /** When true, templateIds + canAddTemplate are enforced for clients on this plan. */
  templateAccessConfigured?: boolean;
  /**
   * When true, invoices/templates for companies on this plan show a
   * "Made with Invogen" advertisement badge at the bottom-right.
   */
  showMadeWithInvogen?: boolean;
  description?: string;
}

const planSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true },
    tier: { type: String, enum: Object.values(PlanTier), required: true },
    billingCycle: { type: String, enum: Object.values(BillingCycle), required: true },
    price: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    features: [{ type: String }],
    featureIds: [{ type: Schema.Types.ObjectId, ref: 'PlanFeature' }],
    planTypeId: { type: Schema.Types.ObjectId, ref: 'PlanType' },
    razorpayPlanId: String,
    maintenanceCharge: Number,
    isActive: { type: Boolean, default: true },
    isPaused: { type: Boolean, default: false },
    visibleOnWebsite: { type: Boolean, default: true },
    visibleOnSuperAdmin: { type: Boolean, default: true },
    templateIds: [{ type: Schema.Types.ObjectId, ref: 'InvoiceTemplate' }],
    canAddTemplate: { type: Boolean },
    templateAccessConfigured: { type: Boolean },
    showMadeWithInvogen: { type: Boolean, default: false },
    description: String,
  },
  { timestamps: true }
);

planSchema.index({ tier: 1, billingCycle: 1 });

export const Plan = mongoose.model<IPlan>('Plan', planSchema);
