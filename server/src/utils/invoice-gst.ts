import type { TemplatePage } from '@invogen/shared';

export function parseIndianAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;
  const cleaned = value.replace(/₹|rs\.?|inr/gi, '').replace(/,/g, '').trim();
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type InvoiceGstBreakdown = {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  totalAmount: number;
};

export function normalizeState(value?: string | null): string {
  return String(value ?? '').trim().toLowerCase();
}

export type InvoiceGstSource = {
  totals?: {
    subtotal?: number;
    discount?: number;
    tax?: number;
    total?: number;
  };
  customerSnapshot?: {
    state?: string;
    name?: string;
    placeholders?: Record<string, unknown>;
  };
  templateSnapshot?: TemplatePage[];
};

const TABLE_TYPES = new Set([
  'product_table',
  'table',
  'invoice_table',
  'invoice_table_2',
  'invoice_table_3',
]);

function normalizeAmountToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isTemplateSummaryRow(name: string, cells: Record<string, string>): boolean {
  const nameToken = normalizeAmountToken(name);
  if (/^(subtotal|cgst|sgst|gst|total|final|amount|tax)$/.test(nameToken)) return true;
  for (const value of Object.values(cells)) {
    const token = normalizeAmountToken(String(value));
    if (/^(subtotal|cgst|sgst|gst|total|final)$/.test(token)) return true;
  }
  return false;
}

function extractInvoiceTotalFromTemplateSnapshot(snapshot?: TemplatePage[]): number {
  if (!Array.isArray(snapshot)) return 0;

  let lineTotal = 0;
  let summaryTotal = 0;

  for (const page of snapshot) {
    for (const element of page.elements ?? []) {
      if (!TABLE_TYPES.has(element.type)) continue;
      const props = (element.props ?? {}) as Record<string, unknown>;
      const start = props.__previewPaginationStart;
      if (typeof start === 'number' && start > 0) continue;

      const rows = Array.isArray(props.rows)
        ? (props.rows as Array<{ name?: string; cells?: Record<string, string> }>)
        : [];
      const columns = Array.isArray(props.columns)
        ? (props.columns as Array<{ id: string; label?: string; visible?: boolean }>)
        : [];

      const amountColumnIds = columns
        .filter((col) => {
          if (col.visible === false) return false;
          const token = normalizeAmountToken(`${col.id} ${col.label ?? ''}`);
          return (
            col.id === 'col_total'
            || col.id === 'col_line_total'
            || col.id === 'col_amount'
            || /total|amount|lineamount|linetotal/.test(token)
          );
        })
        .map((col) => col.id);
      const fallbackAmountIds = amountColumnIds.length > 0 ? amountColumnIds : ['col_total'];

      for (const row of rows) {
        const cells = row.cells ?? {};
        if (isTemplateSummaryRow(String(row.name ?? ''), cells)) {
          for (const value of Object.values(cells)) {
            summaryTotal = Math.max(summaryTotal, parseIndianAmount(value));
          }
          continue;
        }
        for (const colId of fallbackAmountIds) {
          lineTotal += parseIndianAmount(cells[colId]);
        }
      }
    }
  }

  return summaryTotal > 0 ? summaryTotal : lineTotal;
}

function getPlaceholderInvoiceAmount(placeholders: Record<string, unknown>): number {
  const subtotal =
    parseIndianAmount(placeholders.Subtotal)
    || parseIndianAmount(placeholders.Taxable)
    || parseIndianAmount(placeholders.TaxableValue);
  const cgst = parseIndianAmount(placeholders.CGST);
  const sgst = parseIndianAmount(placeholders.SGST);
  const igst = parseIndianAmount(placeholders.IGST);
  const tax =
    parseIndianAmount(placeholders.Tax)
    || parseIndianAmount(placeholders.GST)
    || cgst + sgst + igst;
  const discount = parseIndianAmount(placeholders.Discount);
  const fromExplicit =
    parseIndianAmount(placeholders.Total) || parseIndianAmount(placeholders.Amount);
  if (fromExplicit > 0) return fromExplicit;
  const netSubtotal = Math.max(0, subtotal - discount);
  return netSubtotal + tax;
}

export function computeInvoiceGst(
  invoice: InvoiceGstSource,
  companyState?: string | null
): InvoiceGstBreakdown {
  const totals = invoice.totals ?? {};
  const snap = invoice.customerSnapshot;
  const placeholders = snap?.placeholders ?? {};

  let taxable = Math.max(0, (totals.subtotal ?? 0) - (totals.discount ?? 0));
  let totalGst = totals.tax ?? 0;
  let totalAmount = totals.total ?? 0;

  if (taxable <= 0) {
    taxable =
      parseIndianAmount(placeholders.Subtotal)
      || parseIndianAmount(placeholders.Taxable)
      || parseIndianAmount(placeholders.TaxableValue);
  }

  const placeholderCgst = parseIndianAmount(placeholders.CGST);
  const placeholderSgst = parseIndianAmount(placeholders.SGST);
  const placeholderIgst = parseIndianAmount(placeholders.IGST);

  if (totalGst <= 0) {
    totalGst =
      parseIndianAmount(placeholders.Tax)
      || parseIndianAmount(placeholders.GST)
      || placeholderCgst + placeholderSgst + placeholderIgst;
  }

  if (totalAmount <= 0) {
    totalAmount =
      parseIndianAmount(placeholders.Total)
      || parseIndianAmount(placeholders.Amount)
      || taxable + totalGst;
  }

  let cgst = placeholderCgst;
  let sgst = placeholderSgst;
  let igst = placeholderIgst;

  if (cgst <= 0 && sgst <= 0 && igst <= 0 && totalGst > 0) {
    const customerState = getInvoiceCustomerState(invoice);
    const isInterState =
      normalizeState(customerState) &&
      normalizeState(companyState) &&
      normalizeState(customerState) !== normalizeState(companyState);

    if (isInterState) {
      igst = totalGst;
    } else {
      cgst = Math.round((totalGst / 2) * 100) / 100;
      sgst = Math.round((totalGst - cgst) * 100) / 100;
    }
  }

  const computedGst = cgst + sgst + igst;
  if (computedGst > 0) {
    totalGst = computedGst;
  }

  return {
    taxable,
    cgst,
    sgst,
    igst,
    totalGst,
    totalAmount,
  };
}

export function getInvoiceAmount(invoice: InvoiceGstSource): number {
  const total = invoice.totals?.total ?? 0;
  if (total > 0) return total;

  const placeholders = invoice.customerSnapshot?.placeholders ?? {};
  const fromPlaceholders = getPlaceholderInvoiceAmount(placeholders);
  if (fromPlaceholders > 0) return fromPlaceholders;

  return extractInvoiceTotalFromTemplateSnapshot(invoice.templateSnapshot);
}

export function syncResolvedInvoiceTotals(invoice: InvoiceGstSource): boolean {
  const resolved = resolveInvoiceTotals(invoice);
  if (resolved.total <= 0) return false;
  invoice.totals = resolved;
  return true;
}

export function resolveInvoiceTotals(invoice: InvoiceGstSource) {
  const stored = invoice.totals ?? {};
  if ((stored.total ?? 0) > 0) {
    return {
      subtotal: stored.subtotal ?? 0,
      discount: stored.discount ?? 0,
      tax: stored.tax ?? 0,
      total: stored.total ?? 0,
    };
  }

  const placeholders = invoice.customerSnapshot?.placeholders ?? {};
  const subtotal =
    parseIndianAmount(placeholders.Subtotal)
    || parseIndianAmount(placeholders.Taxable)
    || parseIndianAmount(placeholders.TaxableValue);
  const cgst = parseIndianAmount(placeholders.CGST);
  const sgst = parseIndianAmount(placeholders.SGST);
  const igst = parseIndianAmount(placeholders.IGST);
  const tax =
    parseIndianAmount(placeholders.Tax)
    || parseIndianAmount(placeholders.GST)
    || cgst + sgst + igst;
  const total = getInvoiceAmount(invoice);
  const discount = parseIndianAmount(placeholders.Discount);

  return {
    subtotal,
    discount,
    tax,
    total,
  };
}

export function enrichInvoiceWithTotals<T extends InvoiceGstSource>(invoice: T): T {
  return {
    ...invoice,
    totals: resolveInvoiceTotals(invoice),
  };
}

export function getInvoiceCustomerName(invoice: InvoiceGstSource): string {
  const snap = invoice.customerSnapshot;
  const fromSnapshot = snap?.name?.trim();
  if (fromSnapshot) return fromSnapshot;
  const fromPlaceholder = String(snap?.placeholders?.ClientName ?? '').trim();
  return fromPlaceholder || 'Unknown customer';
}

export function getInvoiceCustomerState(invoice: InvoiceGstSource): string {
  const snap = invoice.customerSnapshot as
    | {
        state?: string;
        address?: { state?: string } | string;
        placeholders?: Record<string, unknown>;
      }
    | undefined;
  if (!snap) return '';

  const fromState = snap.state?.trim();
  if (fromState) return fromState;

  const address = snap.address;
  if (address && typeof address === 'object' && address.state?.trim()) {
    return address.state.trim();
  }

  const fromPlaceholder = String(snap.placeholders?.State ?? '').trim();
  return fromPlaceholder;
}
