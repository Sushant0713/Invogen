import { UserRole, UserStatus } from '@invogen/shared';
import { Notification, User } from '../models';

export type PlatformNotificationSettings = {
  welcomeEmail?: boolean;
  invoiceCreated?: boolean;
  paymentReceived?: boolean;
  subscriptionRenewal?: boolean;
  subscriptionExpired?: boolean;
  supportTicketUpdates?: boolean;
};

const DEFAULT_SETTINGS: Required<PlatformNotificationSettings> = {
  welcomeEmail: true,
  invoiceCreated: true,
  paymentReceived: true,
  subscriptionRenewal: true,
  subscriptionExpired: true,
  supportTicketUpdates: true,
};

export async function getPlatformNotificationSettings(): Promise<PlatformNotificationSettings> {
  const { Setting } = await import('../models');
  const row = await Setting.findOne({ key: 'notification_settings', scope: 'system' });
  return { ...DEFAULT_SETTINGS, ...((row?.value || {}) as PlatformNotificationSettings) };
}

function isSettingEnabled(
  settings: PlatformNotificationSettings,
  key: keyof PlatformNotificationSettings
): boolean {
  return settings[key] !== false;
}

type NotificationPayload = {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  link?: string;
  metadata?: Record<string, unknown>;
};

export const notificationService = {
  async getForUser(userId: string, companyId?: string | null) {
    const filter: Record<string, unknown> = { userId };
    if (companyId) {
      filter.companyId = companyId;
    } else {
      filter.$or = [{ companyId: null }, { companyId: { $exists: false } }];
    }
    return Notification.find(filter).sort({ createdAt: -1 }).limit(50);
  },

  async getUnreadCount(userId: string, companyId?: string | null) {
    const filter: Record<string, unknown> = { userId, isRead: false };
    if (companyId) {
      filter.companyId = companyId;
    } else {
      filter.$or = [{ companyId: null }, { companyId: { $exists: false } }];
    }
    return Notification.countDocuments(filter);
  },

  async markRead(userId: string, id: string, companyId?: string | null) {
    const filter: Record<string, unknown> = { _id: id, userId };
    if (companyId) {
      filter.companyId = companyId;
    } else {
      filter.$or = [{ companyId: null }, { companyId: { $exists: false } }];
    }
    const notification = await Notification.findOneAndUpdate(filter, { isRead: true }, { new: true });
    if (!notification) {
      const { AppError } = await import('../utils/AppError');
      throw new AppError('Notification not found', 404);
    }
    return notification;
  },

  async markAllRead(userId: string, companyId?: string | null) {
    const filter: Record<string, unknown> = { userId, isRead: false };
    if (companyId) {
      filter.companyId = companyId;
    } else {
      filter.$or = [{ companyId: null }, { companyId: { $exists: false } }];
    }
    await Notification.updateMany(filter, { isRead: true });
  },

  async notifyCompanyAdmins(
    companyId: string,
    data: NotificationPayload,
    settingKey?: keyof PlatformNotificationSettings
  ) {
    const settings = await getPlatformNotificationSettings();
    if (settingKey && !isSettingEnabled(settings, settingKey)) {
      return [];
    }

    const admins = await User.find({
      companyId,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    }).select('_id');

    if (admins.length === 0) return [];

    return Notification.insertMany(
      admins.map((admin) => ({
        userId: admin._id,
        companyId,
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        link: data.link,
        metadata: data.metadata,
      }))
    );
  },

  async notifyUser(
    userId: string,
    data: NotificationPayload,
    options?: { companyId?: string | null; settingKey?: keyof PlatformNotificationSettings }
  ) {
    if (options?.settingKey) {
      const settings = await getPlatformNotificationSettings();
      if (!isSettingEnabled(settings, options.settingKey)) {
        return null;
      }
    }

    return Notification.create({
      userId,
      companyId: options?.companyId ?? undefined,
      title: data.title,
      message: data.message,
      type: data.type || 'info',
      link: data.link,
      metadata: data.metadata,
    });
  },

  async notifySuperAdmins(data: NotificationPayload) {
    const superAdmins = await User.find({
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    }).select('_id');

    if (superAdmins.length === 0) return [];

    return Notification.insertMany(
      superAdmins.map((admin) => ({
        userId: admin._id,
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        link: data.link,
        metadata: data.metadata,
      }))
    );
  },

  async broadcastToCompanyAdmins(data: NotificationPayload) {
    const admins = await User.find({
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      companyId: { $exists: true, $ne: null },
    }).select('_id companyId');

    if (admins.length === 0) return [];

    return Notification.insertMany(
      admins.map((admin) => ({
        userId: admin._id,
        companyId: admin.companyId,
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        link: data.link,
        metadata: data.metadata,
      }))
    );
  },

  fire(promise: Promise<unknown>) {
    void promise.catch((error) => {
      console.error('[notification]', error);
    });
  },
};
