import { PERMISSIONS, type Permission } from '@invogen/shared';
import type { NavItem } from '@/config/navigation';

const EMPLOYEE_NAV_PERMISSIONS: Record<string, Permission[] | null> = {
  '/employee/dashboard': null,
  '/employee/invoices': [
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_EDIT,
  ],
  '/employee/templates': [PERMISSIONS.TEMPLATE_VIEW, PERMISSIONS.TEMPLATE_EDIT],
  '/employee/products': [PERMISSIONS.PRODUCT_MANAGE],
  '/employee/customers': [PERMISSIONS.CUSTOMER_MANAGE],
  '/employee/profile': null,
};

const EMPLOYEE_CHILD_NAV_PERMISSIONS: Record<string, Permission[]> = {
  '/employee/invoices': [
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_EDIT,
  ],
  '/employee/invoices/shared': [
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_EDIT,
  ],
  '/employee/invoices/new': [PERMISSIONS.INVOICE_CREATE, PERMISSIONS.INVOICE_EDIT],
};

function hasNavPermission(path: string, permissions: string[]) {
  const required = EMPLOYEE_NAV_PERMISSIONS[path];
  if (!required) return true;
  return required.some((permission) => permissions.includes(permission));
}

function filterChildNav(children: NavItem['children'], permissions: string[]) {
  if (!children?.length) return children;
  return children.filter((child) => {
    const required = EMPLOYEE_CHILD_NAV_PERMISSIONS[child.path];
    if (!required) return true;
    return required.some((permission) => permissions.includes(permission));
  });
}

export function filterEmployeeNav(navItems: NavItem[], permissions: string[]): NavItem[] {
  return navItems
    .map((item) => {
      if (!item.children?.length) return item;
      const children = filterChildNav(item.children, permissions);
      if (!children?.length) return null;
      return { ...item, children };
    })
    .filter((item): item is NavItem => {
      if (!item) return false;
      if (item.path === '/employee/invoices' && permissions.includes(PERMISSIONS.TEMPLATE_EDIT)) {
        return false;
      }
      return hasNavPermission(item.path, permissions);
    });
}
