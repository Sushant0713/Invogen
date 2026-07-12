export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  EMPLOYEE = 'employee',
}

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

export type AuthPortal = 'super-admin' | 'admin' | 'employee';

export type AuthProvider = 'local' | 'google';

export interface JwtPayload {
  userId: string;
  role: UserRole;
  companyId: string | null;
  permissions: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyId: string | null;
  permissions: string[];
  isEmailVerified: boolean;
  status: UserStatus;
  authProvider?: AuthProvider;
}
