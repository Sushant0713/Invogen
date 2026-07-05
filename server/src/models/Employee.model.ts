import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployee extends Document {
  userId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  permissions: string[];
  createdBy: mongoose.Types.ObjectId;
  department?: string;
  designation?: string;
}

const employeeSchema = new Schema<IEmployee>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    permissions: [{ type: String }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    department: String,
    designation: String,
  },
  { timestamps: true }
);

employeeSchema.index({ companyId: 1 });
employeeSchema.index({ userId: 1 }, { unique: true });

export const Employee = mongoose.model<IEmployee>('Employee', employeeSchema);
