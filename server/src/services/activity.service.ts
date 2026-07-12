import { ActivityLog, User } from '../models';

/** Fields populated when activity logs are shown in dashboards and admin lists. */
export const ACTIVITY_USER_POPULATE = 'firstName lastName email role';

export async function buildActivityLogSearchFilter(
  searchRaw: unknown
): Promise<Record<string, unknown>> {
  const search = String(searchRaw || '').trim();
  if (!search) return {};

  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');

  const matchingUsers = await User.find({
    $or: [{ email: regex }, { firstName: regex }, { lastName: regex }],
  })
    .select('_id')
    .lean();

  const userIds = matchingUsers.map((user) => user._id);
  const orConditions: Record<string, unknown>[] = [
    { action: regex },
    { module: regex },
    { description: regex },
    { ipAddress: regex },
  ];

  if (userIds.length > 0) {
    orConditions.push({ userId: { $in: userIds } });
  }

  return { $or: orConditions };
}

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
