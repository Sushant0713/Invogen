import mongoose, { Schema, Document } from 'mongoose';
import { SubscriptionStatus } from '@invogen/shared';

export interface ISubscription extends Document {
  companyId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  status: SubscriptionStatus;
  razorpaySubscriptionId?: string;
  razorpayOrderId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.TRIAL,
    },
    razorpaySubscriptionId: String,
    razorpayOrderId: String,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelledAt: Date,
  },
  { timestamps: true }
);

subscriptionSchema.index({ companyId: 1 });
subscriptionSchema.index({ status: 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
