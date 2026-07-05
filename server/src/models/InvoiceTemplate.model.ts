import mongoose, { Schema, Document } from 'mongoose';
import type { TemplatePage } from '@invogen/shared';

export interface IInvoiceTemplate extends Document {
  name: string;
  category: string;
  description?: string;
  pages: TemplatePage[];
  isSystem: boolean;
  companyId?: mongoose.Types.ObjectId;
  thumbnail?: string;
  version: number;
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
}

const canvasElementSchema = new Schema(
  {
    id: String,
    type: String,
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    zIndex: Number,
    props: Schema.Types.Mixed,
    locked: Boolean,
    visible: { type: Boolean, default: true },
  },
  { _id: false }
);

const templatePageSchema = new Schema(
  {
    id: String,
    name: String,
    elements: [canvasElementSchema],
    margins: {
      top: { type: Number, default: 40 },
      right: { type: Number, default: 40 },
      bottom: { type: Number, default: 40 },
      left: { type: Number, default: 40 },
    },
    pageSize: {
      width: Number,
      height: Number,
    },
  },
  { _id: false }
);

const invoiceTemplateSchema = new Schema<IInvoiceTemplate>(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, default: '' },
    pages: [templatePageSchema],
    isSystem: { type: Boolean, default: false },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    thumbnail: String,
    version: { type: Number, default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

invoiceTemplateSchema.index({ companyId: 1, category: 1 });
invoiceTemplateSchema.index({ isSystem: 1 });

export const InvoiceTemplate = mongoose.model<IInvoiceTemplate>(
  'InvoiceTemplate',
  invoiceTemplateSchema
);
