import { normalizeProductTableProps, productTablePropsToRecord } from './product-table';
import { isInvoiceTable1Type, normalizeInvoiceTableProps } from './invoice-table';
import { isInvoiceTable2Type, normalizeInvoiceTable2Props } from './invoice-table-2';
import { isInvoiceTable3Type, normalizeInvoiceTable3Props } from './invoice-table-3';
import type { ProductTableProps } from './product-table';

export function normalizeTablePropsForType(
  type: string,
  raw: Record<string, unknown> = {}
): ProductTableProps {
  if (isInvoiceTable1Type(type)) return normalizeInvoiceTableProps(raw);
  if (isInvoiceTable2Type(type)) return normalizeInvoiceTable2Props(raw);
  if (isInvoiceTable3Type(type)) return normalizeInvoiceTable3Props(raw);
  return normalizeProductTableProps(raw);
}

export { productTablePropsToRecord };
