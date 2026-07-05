import mongoose, { Schema, Document } from 'mongoose';
import { UserRole, UserStatus, type AuthProvider } from '@invogen/shared';

export interface IUser extends Document {
  email: string;
  passwordHash?: string;
  authProvider: AuthProvider;
  googleId?: string;
  profilePicture?: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyId: mongoose.Types.ObjectId | null;
  permissions: string[];
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  refreshTokenHash?: string;
  lastLogin?: Date;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String, sparse: true, unique: true },
    profilePicture: { type: String },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    role: { type: String, enum: Object.values(UserRole), required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },
    permissions: [{ type: String }],
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    refreshTokenHash: { type: String, select: false },
    lastLogin: { type: Date },
    status: { type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE },
  },
  { timestamps: true }
);

userSchema.index({ companyId: 1, role: 1 });
userSchema.index({ status: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
