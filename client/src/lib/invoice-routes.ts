/** Admin discount sidebar child routes. */
export function isDiscountNavChildActive(childPath: string, pathname: string): boolean {
  if (childPath === '/admin/discounts') {
    return pathname === childPath;
  }
  return pathname === childPath || pathname.startsWith(`${childPath}/`);
}

/** Invoice sidebar child routes — exact match for list root. */
export function isInvoiceNavChildActive(childPath: string, pathname: string): boolean {
  if (childPath === '/admin/invoices' || childPath === '/employee/invoices') {
    return pathname === childPath;
  }
  return pathname === childPath || pathname.startsWith(`${childPath}/`);
}

/** Super-admin template sidebar child routes. */
export function isTemplateNavChildActive(childPath: string, pathname: string): boolean {
  if (childPath === '/super-admin/templates') {
    return pathname === childPath || pathname === '/super-admin/templates/create';
  }
  if (childPath === '/super-admin/templates/super-admin') {
    return pathname === childPath || pathname.startsWith('/super-admin/templates/super-admin/');
  }
  return pathname === childPath || pathname.startsWith(`${childPath}/`);
}

export function buildPublicInvoiceViewUrl(token: string): string {
  return `${window.location.origin}/view/invoice/${token}`;
}
