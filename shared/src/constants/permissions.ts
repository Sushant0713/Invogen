export const PERMISSIONS = {
  INVOICE_CREATE: 'invoice.create',
  INVOICE_VIEW: 'invoice.view',
  INVOICE_EDIT: 'invoice.edit',
  INVOICE_DELETE: 'invoice.delete',
  TEMPLATE_VIEW: 'template.view',
  TEMPLATE_EDIT: 'template.edit',
  TEMPLATE_CREATE: 'template.create',
  CUSTOMER_MANAGE: 'customer.manage',
  PRODUCT_MANAGE: 'product.manage',
  EMPLOYEE_MANAGE: 'employee.manage',
  SETTINGS_MANAGE: 'settings.manage',
  REPORTS_VIEW: 'reports.view',
  SUBSCRIPTION_MANAGE: 'subscription.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ADMIN_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const EMPLOYEE_DEFAULT_PERMISSIONS: Permission[] = [
  PERMISSIONS.INVOICE_CREATE,
  PERMISSIONS.INVOICE_VIEW,
  PERMISSIONS.TEMPLATE_VIEW,
];
