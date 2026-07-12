import crypto from 'crypto';
import {
  EMPLOYEE_DEFAULT_PERMISSIONS,
  type EmployeeSettings,
  type Permission,
  EMPLOYEE_ASSIGNABLE_PERMISSIONS,
} from '@invogen/shared';

export function generateEmployeeJoinCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export function normalizeJoinCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function validateJoinCodeFormat(joinCode: string): string | null {
  if (!joinCode) return 'Join code is required';
  if (joinCode.length < 6) return 'Join code must be at least 6 characters';
  if (joinCode.length > 20) return 'Join code must be 20 characters or fewer';
  if (!/^[A-Z0-9]+$/.test(joinCode)) return 'Join code can only contain letters and numbers';
  return null;
}

export function defaultEmployeeSettings(): EmployeeSettings {
  return {
    allowSelfRegistration: true,
    requireApproval: true,
    defaultPermissions: [...EMPLOYEE_DEFAULT_PERMISSIONS],
    joinCode: generateEmployeeJoinCode(),
  };
}

export function sanitizeEmployeePermissions(permissions: unknown): Permission[] {
  if (!Array.isArray(permissions)) return [...EMPLOYEE_DEFAULT_PERMISSIONS];
  const allowed = new Set<string>(EMPLOYEE_ASSIGNABLE_PERMISSIONS);
  const unique = permissions.filter(
    (value): value is Permission => typeof value === 'string' && allowed.has(value)
  );
  return unique.length > 0 ? unique : [...EMPLOYEE_DEFAULT_PERMISSIONS];
}

export function parseEmployeeSettings(value: unknown): EmployeeSettings {
  const defaults = defaultEmployeeSettings();
  if (!value || typeof value !== 'object') return defaults;
  const raw = value as Partial<EmployeeSettings>;
  return {
    allowSelfRegistration: raw.allowSelfRegistration !== false,
    requireApproval: raw.requireApproval !== false,
    defaultPermissions: sanitizeEmployeePermissions(raw.defaultPermissions),
    joinCode:
      typeof raw.joinCode === 'string' && raw.joinCode.trim().length >= 6
        ? raw.joinCode.trim().toUpperCase()
        : defaults.joinCode,
  };
}
