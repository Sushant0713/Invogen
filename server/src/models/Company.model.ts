import mongoose, { Schema, Document } from 'mongoose';

export interface IAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

export interface IBankDetails {
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branch?: string;
  upiId?: string;
}

export interface IInvoiceSettings {
  prefix: string;
  numberFormat: string;
  nextNumber: number;
  currency: string;
  timezone: string;
  taxRate: number;
  taxLabel: string;
}

export interface IProductSettings {
  /** Default: show "Name (SKU)" in invoice product columns when picked from catalog. */
  showProductSku?: boolean;
}

export interface ITaxSettings {
  isEnabled: boolean;
  cgstRate: number;
  sgstRate: number;
  gstRate: number;
  taxDisplayMode: 'split' | 'combined';
  includeInPrice: boolean;
}

export interface ICompany extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  logo?: string;
  signature?: string;
  address?: IAddress;
  gst?: string;
  pan?: string;
  bankDetails?: IBankDetails;
  invoiceSettings: IInvoiceSettings;
  productSettings?: IProductSettings;
  taxSettings: ITaxSettings;
  isActive: boolean;
}

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

const bankDetailsSchema = new Schema<IBankDetails>(
  {
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    branch: String,
    upiId: String,
  },
  { _id: false }
);

const invoiceSettingsSchema = new Schema<IInvoiceSettings>(
  {
    prefix: { type: String, default: 'INV' },
    numberFormat: { type: String, default: '{PREFIX}-{YYYY}-{NNNN}' },
    nextNumber: { type: Number, default: 1 },
    currency: { type: String, default: 'INR' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    taxRate: { type: Number, default: 18 },
    taxLabel: { type: String, default: 'GST' },
  },
  { _id: false }
);

const taxSettingsSchema = new Schema<ITaxSettings>(
  {
    isEnabled: { type: Boolean, default: true },
    cgstRate: { type: Number, default: 9 },
    sgstRate: { type: Number, default: 9 },
    gstRate: { type: Number, default: 18 },
    taxDisplayMode: { type: String, enum: ['split', 'combined'], default: 'split' },
    includeInPrice: { type: Boolean, default: false },
  },
  { _id: false }
);

const productSettingsSchema = new Schema<IProductSettings>(
  {
    showProductSku: { type: Boolean, default: false },
  },
  { _id: false }
);

const companySchema = new Schema<ICompany>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    email: String,
    phone: String,
    logo: String,
    signature: String,
    address: addressSchema,
    gst: String,
    pan: String,
    bankDetails: bankDetailsSchema,
    invoiceSettings: { type: invoiceSettingsSchema, default: () => ({}) },
    productSettings: { type: productSettingsSchema, default: () => ({}) },
    taxSettings: { type: taxSettingsSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

companySchema.index({ ownerId: 1 });

export const Company = mongoose.model<ICompany>('Company', companySchema);
