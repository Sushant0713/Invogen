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
  accountName?: string;
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
  igstRate: number;
  taxDisplayMode: 'split' | 'combined' | 'igst';
  includeInPrice: boolean;
}

export interface IEmployeeSettings {
  allowSelfRegistration: boolean;
  requireApproval: boolean;
  defaultPermissions: string[];
  joinCode: string;
}

export interface ICompany extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  /** Short unique code used in invoice numbers, e.g. SK in SK-INV-2026-00001 */
  invoiceCode?: string;
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
  employeeSettings?: IEmployeeSettings;
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
    accountName: String,
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
    numberFormat: { type: String, default: '{CODE}-{PREFIX}-{YYYY}-{NNNNN}' },
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
    igstRate: { type: Number, default: 18 },
    taxDisplayMode: { type: String, enum: ['split', 'combined', 'igst'], default: 'split' },
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

const employeeSettingsSchema = new Schema<IEmployeeSettings>(
  {
    allowSelfRegistration: { type: Boolean, default: true },
    requireApproval: { type: Boolean, default: true },
    defaultPermissions: { type: [String], default: [] },
    joinCode: { type: String, trim: true, uppercase: true },
  },
  { _id: false }
);

const companySchema = new Schema<ICompany>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    invoiceCode: { type: String, trim: true, uppercase: true, maxlength: 8 },
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
    employeeSettings: { type: employeeSettingsSchema },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

companySchema.index({ ownerId: 1 });
companySchema.index({ invoiceCode: 1 }, { unique: true, sparse: true });
companySchema.index({ 'employeeSettings.joinCode': 1 }, { unique: true, sparse: true });

export const Company = mongoose.model<ICompany>('Company', companySchema);
