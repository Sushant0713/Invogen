/** Invoice sidebar child routes — exact match for list root. */
export function isInvoiceNavChildActive(childPath: string, pathname: string): boolean {
  if (childPath === '/admin/invoices' || childPath === '/employee/invoices') {
    return pathname === childPath;
  }
  return pathname === childPath || pathname.startsWith(`${childPath}/`);
}

export function buildPublicInvoiceViewUrl(token: string): string {
  return `${window.location.origin}/view/invoice/${token}`;
}
