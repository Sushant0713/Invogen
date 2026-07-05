import mongoose, { Schema, Document } from 'mongoose';

export interface IPermission extends Document {
  key: string;
  name: string;
  description?: string;
  module: string;
}

const permissionSchema = new Schema<IPermission>(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    module: { type: String, required: true },
  },
  { timestamps: true }
);

export const Permission = mongoose.model<IPermission>('Permission', permissionSchema);
