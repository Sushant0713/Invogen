import { UserRole } from '@invogen/shared';
import { Employee } from '../models';

export async function resolveUserPermissions(user: {
  _id: { toString(): string };
  role: UserRole;
  permissions?: string[] | null;
}): Promise<string[]> {
  if (user.role !== UserRole.EMPLOYEE) {
    return Array.isArray(user.permissions) ? user.permissions : [];
  }

  const employee = await Employee.findOne({ userId: user._id }).select('permissions');
  if (employee?.permissions?.length) {
    return employee.permissions;
  }

  return Array.isArray(user.permissions) ? user.permissions : [];
}
