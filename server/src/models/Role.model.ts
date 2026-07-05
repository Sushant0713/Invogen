import mongoose, { Schema, Document } from 'mongoose';

export interface IRole extends Document {
  name: string;
  slug: string;
  permissions: string[];
  description?: string;
}

const roleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    permissions: [{ type: String }],
    description: { type: String },
  },
  { timestamps: true }
);

export const Role = mongoose.model<IRole>('Role', roleSchema);
