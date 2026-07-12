export function parseInvoiceAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;
  const cleaned = value.replace(/₹|rs\.?|inr/gi, '').replace(/,/g, '').trim();
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

type InvoiceTotalSource = {
  totals?: {
    subtotal?: number;
    discount?: number;
    tax?: number;
    total?: number;
  };
  customerSnapshot?: {
    placeholders?: Record<string, unknown>;
  };
};

export function resolveInvoiceTotal(invoice: InvoiceTotalSource): number {
  const stored = invoice.totals?.total ?? 0;
  if (stored > 0) return stored;
  const placeholders = invoice.customerSnapshot?.placeholders ?? {};
  return buildInvoiceTotalsFromPlaceholders(placeholders).total;
}

export function buildInvoiceTotalsFromPlaceholders(
  placeholders: Record<string, unknown>
): { subtotal: number; discount: number; tax: number; total: number } {
  const subtotal =
    parseInvoiceAmount(placeholders.Subtotal)
    || parseInvoiceAmount(placeholders.Taxable)
    || parseInvoiceAmount(placeholders.TaxableValue);
  const cgst = parseInvoiceAmount(placeholders.CGST);
  const sgst = parseInvoiceAmount(placeholders.SGST);
  const igst = parseInvoiceAmount(placeholders.IGST);
  const tax =
    parseInvoiceAmount(placeholders.Tax)
    || parseInvoiceAmount(placeholders.GST)
    || cgst + sgst + igst;
  const total =
    parseInvoiceAmount(placeholders.Total)
    || parseInvoiceAmount(placeholders.Amount)
    || subtotal + tax;
  const discount = parseInvoiceAmount(placeholders.Discount);

  return { subtotal, discount, tax, total };
}
