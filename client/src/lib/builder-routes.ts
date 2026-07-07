const TEMPLATE_BUILDER_PATTERN = /\/templates\/[^/]+\/edit$/;
const INVOICE_COMPOSER_PATTERN = /\/invoices\/new\/[^/]+$/;
const INVOICE_EDIT_PATTERN = /\/invoices\/[^/]+\/edit$/;

export function isTemplateBuilderPath(pathname: string): boolean {
  return TEMPLATE_BUILDER_PATTERN.test(pathname);
}

export function isInvoiceComposerPath(pathname: string): boolean {
  return INVOICE_COMPOSER_PATTERN.test(pathname) || INVOICE_EDIT_PATTERN.test(pathname);
}

export function isFullHeightWorkspacePath(pathname: string): boolean {
  return isTemplateBuilderPath(pathname) || isInvoiceComposerPath(pathname);
}
