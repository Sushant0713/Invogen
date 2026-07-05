import { ActivityLog } from '../models';

/** Fields populated when activity logs are shown in dashboards and admin lists. */
export const ACTIVITY_USER_POPULATE = 'firstName lastName email role';

export const logActivity = async (data: {
  userId?: string;
  companyId?: string | null;
  action: string;
  module: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}) => {
  try {
    await ActivityLog.create({
      userId: data.userId || undefined,
      companyId: data.companyId || undefined,
      action: data.action,
      module: data.module,
      description: data.description,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: data.metadata,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
