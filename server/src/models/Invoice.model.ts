import mongoose, { Schema, Document } from 'mongoose';
import { InvoiceType, InvoiceStatus } from '@invogen/shared';
import type { LineItem, TemplatePage } from '@invogen/shared';

export interface IInvoiceTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export interface IRecurringConfig {
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextDate: Date;
  endDate?: Date;
}

export interface IInvoiceShare {
  token: string;
  recipientName?: string;
  recipientEmail?: string;
  method: 'email' | 'whatsapp' | 'link';
  sharedAt: Date;
  sharedBy: mongoose.Types.ObjectId;
}

export interface IInvoice extends Document {
  companyId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  type: InvoiceType;
  status: InvoiceStatus;
  templateId?: mongoose.Types.ObjectId;
  templateSnapshot?: TemplatePage[];
  customerId?: mongoose.Types.ObjectId;
  customerSnapshot?: Record<string, unknown>;
  lineItems: LineItem[];
  totals: IInvoiceTotals;
  issueDate: Date;
  dueDate?: Date;
  notes?: string;
  terms?: string;
  pdfUrl?: string;
  signature?: string;
  barcode?: string;
  qrData?: string;
  recurringConfig?: IRecurringConfig;
  createdBy: mongoose.Types.ObjectId;
  sentAt?: Date;
  paidAt?: Date;
  shares?: IInvoiceShare[];
  createdAt: Date;
  updatedAt: Date;
}

const lineItemSchema = new Schema(
  {
    productId: Schema.Types.ObjectId,
    name: { type: String, required: true },
    description: String,
    hsn: String,
    quantity: { type: Number, required: true },
    unit: { type: String, default: 'pcs' },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
  },
  { _id: false }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    invoiceNumber: { type: String, required: true },
    type: { type: String, enum: Object.values(InvoiceType), default: InvoiceType.TAX },
    status: { type: String, enum: Object.values(InvoiceStatus), default: InvoiceStatus.DRAFT },
    templateId: { type: Schema.Types.ObjectId, ref: 'InvoiceTemplate' },
    templateSnapshot: Schema.Types.Mixed,
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerSnapshot: Schema.Types.Mixed,
    lineItems: [lineItemSchema],
    totals: {
      subtotal: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    issueDate: { type: Date, default: Date.now },
    dueDate: Date,
    notes: String,
    terms: String,
    pdfUrl: String,
    signature: String,
    barcode: String,
    qrData: String,
    recurringConfig: {
      frequency: String,
      nextDate: Date,
      endDate: Date,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sentAt: Date,
    paidAt: Date,
    shares: [
      {
        token: { type: String, required: true },
        recipientName: String,
        recipientEmail: String,
        method: { type: String, enum: ['email', 'whatsapp', 'link'], default: 'link' },
        sharedAt: { type: Date, default: Date.now },
        sharedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      },
    ],
  },
  { timestamps: true }
);

invoiceSchema.index({ companyId: 1, createdAt: -1 });
invoiceSchema.index({ companyId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ 'shares.token': 1 });

export const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);
