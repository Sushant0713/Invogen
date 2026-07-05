import mongoose, { Schema, Document } from 'mongoose';
import { ComponentType } from '@invogen/shared';

export interface IComponent extends Document {
  name: string;
  type: ComponentType;
  defaultProps: Record<string, unknown>;
  propSchema: Record<string, unknown>;
  category: string;
  icon?: string;
  isActive: boolean;
}

const componentSchema = new Schema<IComponent>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: Object.values(ComponentType), required: true },
    defaultProps: { type: Schema.Types.Mixed, default: {} },
    propSchema: { type: Schema.Types.Mixed, default: {} },
    category: { type: String, default: 'general' },
    icon: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

componentSchema.index({ type: 1 });
componentSchema.index({ category: 1 });

export const Component = mongoose.model<IComponent>('Component', componentSchema);
