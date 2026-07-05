import mongoose, { Schema, Document } from 'mongoose';

export interface IMedia extends Document {
  companyId: mongoose.Types.ObjectId | null;
  uploadedBy: mongoose.Types.ObjectId;
  filename: string;
  mimetype: string;
  size: number;
  data: Buffer;
}

const mediaSchema = new Schema<IMedia>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    filename: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

mediaSchema.index({ companyId: 1, createdAt: -1 });
mediaSchema.index({ uploadedBy: 1 });

export const Media = mongoose.model<IMedia>('Media', mediaSchema);
