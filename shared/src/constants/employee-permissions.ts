import { PERMISSIONS, type Permission } from './permissions';

/** Features admins can grant to employees (register/login are always available). */
export const EMPLOYEE_ASSIGNABLE_PERMISSIONS: Permission[] = [
  PERMISSIONS.INVOICE_CREATE,
  PERMISSIONS.INVOICE_VIEW,
  PERMISSIONS.INVOICE_EDIT,
  PERMISSIONS.INVOICE_DELETE,
  PERMISSIONS.TEMPLATE_VIEW,
  PERMISSIONS.TEMPLATE_EDIT,
  PERMISSIONS.TEMPLATE_CREATE,
  PERMISSIONS.CUSTOMER_MANAGE,
  PERMISSIONS.PRODUCT_MANAGE,
  PERMISSIONS.REPORTS_VIEW,
];

/** Permissions auto-enabled when Create invoices is checked (delete is separate). */
export const INVOICE_CREATE_BUNDLE_PERMISSIONS: Permission[] = [
  PERMISSIONS.INVOICE_CREATE,
  PERMISSIONS.INVOICE_VIEW,
  PERMISSIONS.INVOICE_EDIT,
  PERMISSIONS.TEMPLATE_VIEW,
];

export type EmployeePermissionBundle = 'create_with_delete' | 'all';

export type EmployeePermissionUiKey = Permission | EmployeePermissionBundle;

export interface EmployeePermissionOption {
  key: EmployeePermissionUiKey;
  label: string;
  description: string;
  /** UI-only bundle — expands to real permissions when saved. */
  bundle?: EmployeePermissionBundle;
}

export const EMPLOYEE_PERMISSION_OPTIONS: EmployeePermissionOption[] = [
  {
    key: 'all',
    label: 'All features',
    description: 'Grant every available employee feature',
    bundle: 'all',
  },
  { key: PERMISSIONS.INVOICE_CREATE, label: 'Create invoices', description: 'Create and duplicate invoices' },
  {
    key: 'create_with_delete',
    label: 'Create & delete invoices',
    description: 'All create invoice features plus delete invoices',
    bundle: 'create_with_delete',
  },
  { key: PERMISSIONS.INVOICE_VIEW, label: 'View invoices', description: 'View invoice list and details' },
  { key: PERMISSIONS.INVOICE_EDIT, label: 'Edit invoices', description: 'View, edit, and create company invoices like admin' },
  { key: PERMISSIONS.INVOICE_DELETE, label: 'Delete invoices', description: 'Remove invoices' },
  { key: PERMISSIONS.TEMPLATE_VIEW, label: 'View templates', description: 'Browse invoice templates' },
  { key: PERMISSIONS.TEMPLATE_EDIT, label: 'Edit templates', description: 'Customize company templates' },
  {
    key: PERMISSIONS.TEMPLATE_CREATE,
    label: 'Add templates',
    description: 'Create new templates from system templates',
  },
  { key: PERMISSIONS.CUSTOMER_MANAGE, label: 'Manage customers', description: 'Add, edit customers and view their invoices' },
  { key: PERMISSIONS.PRODUCT_MANAGE, label: 'Manage products', description: 'Add and edit products' },
  { key: PERMISSIONS.REPORTS_VIEW, label: 'View reports', description: 'Access business reports' },
];

export function isCreateDeleteBundleActive(permissions: Permission[]): boolean {
  return (
    permissions.includes(PERMISSIONS.INVOICE_DELETE) &&
    INVOICE_CREATE_BUNDLE_PERMISSIONS.every((permission) => permissions.includes(permission))
  );
}

export function isAllPermissionsActive(permissions: Permission[]): boolean {
  return EMPLOYEE_ASSIGNABLE_PERMISSIONS.every((permission) => permissions.includes(permission));
}

export interface EmployeeSettings {
  allowSelfRegistration: boolean;
  requireApproval: boolean;
  defaultPermissions: Permission[];
  joinCode: string;
}
