import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  companyId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  hsn?: string;
  gst?: number;
  unit: string;
  sku?: string;
  barcode?: string;
  price: number;
  discount: number;
  tax: number;
  stock: number;
  images: string[];
  isActive: boolean;
}

const productSchema = new Schema<IProduct>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true },
    description: String,
    category: String,
    brand: String,
    hsn: String,
    gst: { type: Number, default: 18 },
    unit: { type: String, default: 'pcs' },
    sku: String,
    barcode: String,
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 18 },
    stock: { type: Number, default: 0 },
    images: [String],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ companyId: 1, createdAt: -1 });
productSchema.index({ companyId: 1, sku: 1 });

export const Product = mongoose.model<IProduct>('Product', productSchema);
