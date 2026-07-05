import mongoose, { Schema, Document } from 'mongoose';

export interface ISetting extends Document {
  key: string;
  value: unknown;
  scope: 'system' | 'company' | 'auth';
  companyId?: mongoose.Types.ObjectId;
  description?: string;
}

const settingSchema = new Schema<ISetting>(
  {
    key: { type: String, required: true },
    value: Schema.Types.Mixed,
    scope: { type: String, enum: ['system', 'company', 'auth'], default: 'system' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    description: String,
  },
  { timestamps: true }
);

settingSchema.index({ key: 1, scope: 1, companyId: 1 }, { unique: true });

export const Setting = mongoose.model<ISetting>('Setting', settingSchema);
