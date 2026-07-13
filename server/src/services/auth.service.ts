import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { UserRole, UserStatus, ADMIN_PERMISSIONS, type AuthUser, type AuthPortal } from '@invogen/shared';
import { User, Company, Employee, Setting, Media, Notification } from '../models';
import { subscriptionService } from './subscription.service';
import { AppError } from '../utils/AppError';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  generateRandomToken,
  verifyRefreshToken,
} from '../utils/tokens';
import {
  getNotificationSettings,
  getSecuritySettings,
  isEmailVerificationRequired,
  assertEmailVerifiedForSession,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
} from '../utils/auth-emails';
import { notificationService } from './notification.service';
import { notifyNewClientRegistered } from '../utils/notification-events';
import { env } from '../config/env';
import { logActivity } from './activity.service';
import { verifyGoogleIdToken } from '../config/google';
import { maintenanceService } from './maintenance.service';
import { getMadeWithAdvertisingImage } from '../utils/made-with-advertising';
import { getPublicAgreements } from '../utils/public-agreements';
import {
  defaultEmployeeSettings,
  normalizeJoinCode,
  parseEmployeeSettings,
  sanitizeEmployeePermissions,
} from '../utils/employee-settings';
import { ensureCompanyInvoiceCode } from '../utils/company-invoice-code';

const PORTAL_ROLES: Record<AuthPortal, UserRole> = {
  'super-admin': UserRole.SUPER_ADMIN,
  admin: UserRole.ADMIN,
  employee: UserRole.EMPLOYEE,
};

const formatUser = (user: {
  _id: { toString(): string };
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyId?: { toString(): string } | null;
  permissions: string[];
  isEmailVerified: boolean;
  status: UserStatus;
  authProvider?: 'local' | 'google';
}): AuthUser => ({
  id: user._id.toString(),
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  companyId: user.companyId?.toString() || null,
  permissions: user.permissions,
  isEmailVerified: user.isEmailVerified,
  status: user.status,
  authProvider: user.authProvider || 'local',
});

function toPlainUser(user: {
  _id: { toString(): string };
  role: UserRole;
  companyId?: { toString(): string } | null;
  permissions: string[];
  email: string;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
  status: UserStatus;
  authProvider?: 'local' | 'google';
  toObject?: () => {
    _id: { toString(): string };
    role: UserRole;
    companyId?: { toString(): string } | null;
    permissions: string[];
    email: string;
    firstName: string;
    lastName: string;
    isEmailVerified: boolean;
    status: UserStatus;
    authProvider?: 'local' | 'google';
  };
}) {
  return typeof user.toObject === 'function' ? user.toObject() : user;
}

async function attachCompanyLogoMedia(logo: string | undefined, companyId: unknown, userId: unknown) {
  if (!logo) return;
  const mediaId = logo.match(/\/uploads\/([a-f\d]{24})/i)?.[1];
  if (mediaId) {
    await Media.findByIdAndUpdate(mediaId, {
      companyId,
      uploadedBy: userId,
    });
  }
}

async function createAdminCompany(
  userId: unknown,
  data: {
    email: string;
    companyName: string;
    phone?: string;
    gst?: string;
    pan?: string;
    logo?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      zipCode?: string;
    };
  }
) {
  const company = await Company.create({
    ownerId: userId,
    name: data.companyName,
    email: data.email,
    phone: data.phone,
    gst: data.gst,
    pan: data.pan,
    logo: data.logo,
    address: data.address,
    employeeSettings: defaultEmployeeSettings(),
  });

  await attachCompanyLogoMedia(data.logo, company._id, userId);
  await ensureCompanyInvoiceCode(company);
  return company;
}

async function issueAuthTokens(
  user: {
    _id: { toString(): string };
    role: UserRole;
    companyId?: { toString(): string } | null;
    permissions: string[];
    email: string;
    firstName: string;
    lastName: string;
    isEmailVerified: boolean;
    status: UserStatus;
    authProvider?: 'local' | 'google';
  },
  options?: {
    remember?: boolean;
    portal?: AuthPortal;
    ip?: string;
    userAgent?: string;
    permissions?: string[];
  }
) {
  const plainUser = toPlainUser(user);
  let permissions = options?.permissions ?? plainUser.permissions;
  if (plainUser.role === UserRole.EMPLOYEE) {
    const employee = await Employee.findOne({ userId: plainUser._id });
    if (employee) permissions = employee.permissions;
  }

  const accessToken = generateAccessToken({
    userId: plainUser._id.toString(),
    role: plainUser.role,
    companyId: plainUser.companyId?.toString() || null,
    permissions,
  });

  const refreshToken = generateRefreshToken(plainUser._id.toString(), options?.remember);
  const userDoc = await User.findById(plainUser._id).select('+refreshTokenHash');
  if (userDoc) {
    userDoc.refreshTokenHash = hashToken(refreshToken);
    userDoc.lastLogin = new Date();
    await userDoc.save();
  }

  if (options?.portal) {
    await logActivity({
      userId: plainUser._id.toString(),
      companyId: plainUser.companyId?.toString(),
      action: 'login',
      module: 'auth',
      description: `Logged in via ${options.portal} as ${plainUser.email}`,
      ipAddress: options.ip,
      userAgent: options.userAgent,
    });
  }

  const subscriptionActive =
    plainUser.role === UserRole.ADMIN
      ? await subscriptionService.isCompanySubscriptionActive(plainUser.companyId?.toString())
      : true;

  return {
    user: formatUser({ ...plainUser, permissions }),
    accessToken,
    refreshToken,
    subscriptionActive,
  };
}

export const authService = {
  async getBranding() {
    const [profileSetting, madeWithImage] = await Promise.all([
      Setting.findOne({ key: 'company_profile', scope: 'system' }),
      getMadeWithAdvertisingImage(),
    ]);
    const profile = (profileSetting?.value || {}) as Record<string, string>;
    return {
      name: profile.name || 'Invogen',
      logo: profile.logo || '',
      tagline:
        'Premium invoice builder for modern businesses. Create, customize, and send professional invoices.',
      /** Super-admin image shown after "Made with" on plan-gated template ads. */
      madeWithImage,
    };
  },

  async getAgreements() {
    return getPublicAgreements();
  },

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName: string;
    phone?: string;
    gst?: string;
    pan?: string;
    logo?: string;
    logoFilename?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      zipCode?: string;
    };
  }) {
    await maintenanceService.assertPortalAccessible('admin');

    const existing = await User.findOne({ email: data.email });
    if (existing) throw new AppError('Email already registered', 409);

    const passwordHash = await bcrypt.hash(data.password, 12);
    const verificationToken = generateRandomToken();

    const user = await User.create({
      email: data.email,
      passwordHash,
      authProvider: 'local',
      firstName: data.firstName,
      lastName: data.lastName,
      role: UserRole.ADMIN,
      permissions: ADMIN_PERMISSIONS,
      isEmailVerified: false,
      emailVerificationToken: hashToken(verificationToken),
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const company = await createAdminCompany(user._id, data);

    user.companyId = company._id;
    await user.save();

    await sendVerificationEmail({
      to: data.email,
      firstName: data.firstName,
      token: verificationToken,
    });

    const notificationSettings = await getNotificationSettings();
    if (notificationSettings.welcomeEmail !== false) {
      await sendWelcomeEmail({ to: data.email, firstName: data.firstName });
    }

    notificationService.fire(
      notifyNewClientRegistered({
        companyName: data.companyName,
        email: data.email,
        clientUserId: user._id.toString(),
      })
    );

    return formatUser(user);
  },

  async registerEmployee(data: {
    joinCode: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    department?: string;
    designation?: string;
  }) {
    await maintenanceService.assertPortalAccessible('employee');

    const joinCode = normalizeJoinCode(data.joinCode);
    const company = await Company.findOne({ 'employeeSettings.joinCode': joinCode });
    if (!company) throw new AppError('Invalid company join code', 404);

    const settings = parseEmployeeSettings(company.employeeSettings);
    if (!settings.allowSelfRegistration) {
      throw new AppError('Employee self-registration is disabled for this company', 403);
    }

    const existing = await User.findOne({ email: data.email });
    if (existing) throw new AppError('Email already registered', 409);

    const passwordHash = await bcrypt.hash(data.password, 12);
    const requiresApproval = settings.requireApproval;
    const status = requiresApproval ? UserStatus.PENDING : UserStatus.ACTIVE;
    const permissions = requiresApproval
      ? []
      : sanitizeEmployeePermissions(settings.defaultPermissions);

    const user = await User.create({
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: UserRole.EMPLOYEE,
      companyId: company._id,
      permissions,
      isEmailVerified: true,
      status,
    });

    await Employee.create({
      userId: user._id,
      companyId: company._id,
      permissions,
      createdBy: company.ownerId,
      department: data.department,
      designation: data.designation,
    });

    if (requiresApproval) {
      const admins = await User.find({
        companyId: company._id,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      }).select('_id');

      if (admins.length > 0) {
        await Notification.insertMany(
          admins.map((admin) => ({
            userId: admin._id,
            companyId: company._id,
            title: 'New employee registration',
            message: `${data.firstName} ${data.lastName} (${data.email}) requested employee access.`,
            type: 'info',
            link: '/admin/employees/pending',
            metadata: { employeeEmail: data.email },
          }))
        );
      }
    }

    return {
      user: formatUser(user),
      requiresApproval,
    };
  },

  async registerWithGoogle(data: {
    credential: string;
    firstName: string;
    lastName: string;
    companyName: string;
    phone?: string;
    gst?: string;
    pan?: string;
    logo?: string;
    logoFilename?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      zipCode?: string;
    };
  }) {
    await maintenanceService.assertPortalAccessible('admin');

    const profile = await verifyGoogleIdToken(data.credential);

    const existingByGoogle = await User.findOne({ googleId: profile.googleId });
    if (existingByGoogle) {
      throw new AppError('Google account already registered. Please sign in.', 409);
    }

    const existingByEmail = await User.findOne({ email: profile.email });
    if (existingByEmail) {
      throw new AppError('Email already registered. Please sign in instead.', 409);
    }

    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);

    const user = await User.create({
      email: profile.email,
      passwordHash,
      authProvider: 'google',
      googleId: profile.googleId,
      profilePicture: profile.picture,
      firstName: data.firstName.trim() || profile.firstName,
      lastName: data.lastName.trim() || profile.lastName,
      role: UserRole.ADMIN,
      permissions: ADMIN_PERMISSIONS,
      isEmailVerified: true,
    });

    const company = await createAdminCompany(user._id, {
      email: profile.email,
      companyName: data.companyName,
      phone: data.phone,
      gst: data.gst,
      pan: data.pan,
      logo: data.logo,
      address: data.address,
    });

    user.companyId = company._id;
    await user.save();

    notificationService.fire(
      notifyNewClientRegistered({
        companyName: data.companyName,
        email: profile.email,
        clientUserId: user._id.toString(),
      })
    );

    return issueAuthTokens(user, { portal: 'admin' });
  },

  async loginWithGoogle(
    portal: AuthPortal,
    data: { credential: string; remember?: boolean },
    meta?: { ip?: string; userAgent?: string }
  ) {
    await maintenanceService.assertPortalAccessible(portal);

    const expectedRole = PORTAL_ROLES[portal];
    const profile = await verifyGoogleIdToken(data.credential);

    let user = await User.findOne({ googleId: profile.googleId });
    if (!user) {
      user = await User.findOne({ email: profile.email });
    }

    if (!user) {
      throw new AppError('No account found. Please register first.', 404);
    }
    if (user.role !== expectedRole) {
      throw new AppError('Invalid credentials for this portal', 401);
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new AppError('Account suspended', 403);
    }
    if (user.status === UserStatus.PENDING) {
      throw new AppError('Your account is awaiting admin approval', 403);
    }
    if (user.authProvider === 'local' && !user.googleId) {
      throw new AppError('This email uses password sign-in. Please sign in with your password.', 401);
    }

    if (!user.googleId) {
      user.googleId = profile.googleId;
      user.authProvider = 'google';
      if (profile.picture) user.profilePicture = profile.picture;
      user.isEmailVerified = true;
      await user.save();
    }

    return issueAuthTokens(user, {
      remember: data.remember,
      portal,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  },

  async login(
    portal: AuthPortal,
    data: { email: string; password: string; remember?: boolean },
    meta?: { ip?: string; userAgent?: string }
  ) {
    await maintenanceService.assertPortalAccessible(portal);

    const expectedRole = PORTAL_ROLES[portal];
    const user = await User.findOne({ email: data.email }).select(
      '+passwordHash +refreshTokenHash'
    );
    if (!user) throw new AppError('Invalid credentials', 401);
    if (user.role !== expectedRole) throw new AppError('Invalid credentials for this portal', 401);
    if (user.status === UserStatus.SUSPENDED) throw new AppError('Account suspended', 403);
    if (user.status === UserStatus.PENDING) {
      throw new AppError('Your account is awaiting admin approval', 403);
    }
    if (user.authProvider === 'google' && !user.passwordHash) {
      throw new AppError('This account uses Google sign-in. Please continue with Google.', 401);
    }
    if (!user.passwordHash) throw new AppError('Invalid credentials', 401);

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      await logActivity({
        userId: user._id.toString(),
        action: 'login_failed',
        module: 'auth',
        description: 'Failed login attempt',
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
      });
      throw new AppError('Invalid credentials', 401);
    }

    const securitySettings = await getSecuritySettings();
    if (isEmailVerificationRequired(securitySettings)) {
      await assertEmailVerifiedForSession(user);
    }

    let permissions = user.permissions;
    if (user.role === UserRole.EMPLOYEE) {
      const employee = await Employee.findOne({ userId: user._id });
      if (employee) permissions = employee.permissions;
    }

    const result = await issueAuthTokens(user, {
      remember: data.remember,
      portal,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      permissions,
    });

    return result;
  },

  async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.userId).select('+refreshTokenHash');
    if (!user || user.refreshTokenHash !== hashToken(refreshToken)) {
      throw new AppError('Invalid refresh token', 401);
    }
    if (user.status === UserStatus.PENDING) {
      throw new AppError('Your account is awaiting admin approval', 403);
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new AppError('Your account access has been disabled', 403);
    }

    if (user.role === UserRole.ADMIN) {
      await maintenanceService.assertPortalAccessible('admin');
    } else if (user.role === UserRole.EMPLOYEE) {
      await maintenanceService.assertPortalAccessible('employee');
    }

    await assertEmailVerifiedForSession(user);

    let permissions = user.permissions;
    if (user.role === UserRole.EMPLOYEE) {
      const employee = await Employee.findOne({ userId: user._id });
      if (employee) permissions = employee.permissions;
    }

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
      companyId: user.companyId?.toString() || null,
      permissions,
    });

    const newRefreshToken = generateRefreshToken(user._id.toString());
    user.refreshTokenHash = hashToken(newRefreshToken);
    await user.save();

    return { accessToken, refreshToken: newRefreshToken, user: formatUser({ ...user.toObject(), permissions }) };
  },

  async logout(userId: string) {
    await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
  },

  async getMe(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    if (user.role === UserRole.ADMIN) {
      await maintenanceService.assertPortalAccessible('admin');
    } else if (user.role === UserRole.EMPLOYEE) {
      await maintenanceService.assertPortalAccessible('employee');
    }

    await assertEmailVerifiedForSession(user);

    let permissions = user.permissions;
    if (user.role === UserRole.EMPLOYEE) {
      const employee = await Employee.findOne({ userId: user._id });
      if (employee) permissions = employee.permissions;
    }

    return {
      user: formatUser({ ...user.toObject(), permissions }),
      subscriptionActive:
        user.role === UserRole.ADMIN
          ? await subscriptionService.isCompanySubscriptionActive(user.companyId?.toString())
          : true,
    };
  },

  async verifyEmail(token: string) {
    const hashed = hashToken(token);
    const user = await User.findOne({
      emailVerificationToken: hashed,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) throw new AppError('Invalid or expired verification token', 400);

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    return formatUser(user);
  },

  async resendVerification(email: string) {
    const user = await User.findOne({ email }).select(
      '+emailVerificationToken +emailVerificationExpires'
    );
    if (!user) throw new AppError('User not found', 404);
    if (user.isEmailVerified) throw new AppError('Email already verified', 400);

    const verificationToken = generateRandomToken();
    user.emailVerificationToken = hashToken(verificationToken);
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await sendVerificationEmail({
      to: email,
      firstName: user.firstName,
      token: verificationToken,
    });
  },

  async forgotPassword(email: string, portal?: AuthPortal): Promise<{ resetUrl?: string } | void> {
    const filter: Record<string, unknown> = { email };
    if (portal && PORTAL_ROLES[portal]) {
      filter.role = PORTAL_ROLES[portal];
    }

    const user = await User.findOne(filter).select(
      '+passwordResetToken +passwordResetExpires'
    );
    if (!user) return;

    if (user.status === UserStatus.SUSPENDED) {
      return;
    }

    const resetToken = generateRandomToken();
    user.passwordResetToken = hashToken(resetToken);
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const portalQuery = portal ? `&portal=${encodeURIComponent(portal)}` : '';
    const clientBase = env.CLIENT_URL.replace(/\/$/, '');
    const resetUrl = `${clientBase}/reset-password?token=${encodeURIComponent(resetToken)}${portalQuery}`;

    await sendPasswordResetEmail({
      to: email,
      firstName: user.firstName,
      resetUrl,
    });

    if (env.NODE_ENV === 'development') {
      console.warn('[auth] Password reset link (development):');
      console.warn(`  ${resetUrl}`);
      return { resetUrl };
    }
  },

  async resetPassword(token: string, password: string) {
    const hashed = hashToken(token);
    const user = await User.findOne({
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires +passwordHash');

    if (!user) throw new AppError('Invalid or expired reset token', 400);

    user.passwordHash = await bcrypt.hash(password, 12);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
  },
};
