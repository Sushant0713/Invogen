import mongoose, { Schema, Document } from 'mongoose';
import type { IAddress } from './Company.model';

export interface IContact {
  name: string;
  email?: string;
  phone?: string;
  designation?: string;
  isPrimary?: boolean;
}

export interface ICustomer extends Document {
  companyId: mongoose.Types.ObjectId;
  name: string;
  type: 'individual' | 'business';
  email?: string;
  phone?: string;
  gst?: string;
  pan?: string;
  billingAddress?: IAddress;
  shippingAddress?: IAddress;
  contacts: IContact[];
  creditLimit?: number;
  paymentTerms?: string;
  notes?: string;
  isActive: boolean;
}

const contactSchema = new Schema<IContact>(
  {
    name: { type: String, required: true },
    email: String,
    phone: String,
    designation: String,
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const addressSchema = new Schema<IAddress>(
  {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String,
  },
  { _id: false }
);

const customerSchema = new Schema<ICustomer>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['individual', 'business'], default: 'business' },
    email: String,
    phone: String,
    gst: String,
    pan: String,
    billingAddress: addressSchema,
    shippingAddress: addressSchema,
    contacts: [contactSchema],
    creditLimit: Number,
    paymentTerms: String,
    notes: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customerSchema.index({ companyId: 1, createdAt: -1 });
customerSchema.index({ companyId: 1, name: 1 });

export const Customer = mongoose.model<ICustomer>('Customer', customerSchema);
