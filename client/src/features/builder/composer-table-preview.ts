import {
  computeInvoice2Summary,
  isInvoiceTable2Type,
  recalculateInvoiceTable2,
  type InvoiceTable2Props,
} from './invoice-table-2';
import { isInvoiceTable1Type, recalculateInvoiceTable, type InvoiceTableProps } from './invoice-table';
import { isInvoiceTable3Type, recalculateInvoiceTable3, type InvoiceTable3Props } from './invoice-table-3';
import {
  productTablePropsToRecord,
  recalculateProductTable,
  type ProductTableProps,
  type ProductTableRow,
} from './product-table';
import { normalizeTablePropsForType, resolveTableElementType } from './table-props-normalize';
import { EMPTY_TAX_SETTINGS, type TaxSettings } from './tax-settings';

function normalizeSummaryToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isEmbeddedSummaryRow(row: Pick<ProductTableRow, 'id' | 'name' | 'cells'>): boolean {
  if (row.id.startsWith('summary_')) return true;
  const nameToken = normalizeSummaryToken(row.name ?? '');
  if (/^(subtotal|cgst|sgst|gst|total|final|amount|tax)$/.test(nameToken)) return true;
  for (const value of Object.values(row.cells ?? {})) {
    const token = normalizeSummaryToken(String(value));
    if (/^(subtotal|cgst|sgst|gst|total|final)$/.test(token)) return true;
  }
  return false;
}

function lineRowsOnly(rows: ProductTableRow[]): ProductTableRow[] {
  return rows.filter((row) => !isEmbeddedSummaryRow(row));
}

function hasSummaryBlock(raw: Record<string, unknown>): boolean {
  return Array.isArray(raw.summaryRows) && raw.summaryRows.length > 0;
}

export function isSummaryOnlyTable(props: ProductTableProps): boolean {
  if (!Array.isArray(props.rows) || props.rows.length === 0) return false;
  return lineRowsOnly(props.rows).length === 0;
}

function resolveSummaryTableColumns(props: ProductTableProps): {
  labelCol: string | null;
  valueCol: string | null;
} {
  const visible = props.columns.filter((col) => col.visible !== false);
  if (visible.length === 0) return { labelCol: null, valueCol: null };

  const valueCol =
    visible.find((col) => /total|amount|value/i.test(normalizeSummaryToken(col.label)))?.id
    ?? visible[visible.length - 1]?.id
    ?? null;

  const labelCol =
    visible.find((col) => /label|column|description|particular/i.test(normalizeSummaryToken(col.label)))?.id
    ?? visible.find((col) => col.id !== valueCol)?.id
    ?? visible[0]?.id
    ?? null;

  return { labelCol, valueCol };
}

/** Sync a standalone totals table (Column / Total) from computed invoice totals. */
export function syncSummaryOnlyTable(
  props: ProductTableProps,
  totals: Record<string, string | undefined>
): Record<string, unknown> {
  if (!Array.isArray(props.rows) || !Array.isArray(props.columns)) {
    return productTablePropsToRecord(props);
  }
  const { labelCol, valueCol } = resolveSummaryTableColumns(props);
  if (!valueCol) return productTablePropsToRecord(props);

  const rows = props.rows.map((row) => {
    const kind = detectSummaryKind(row);
    if (!kind) return row;
    const amount =
      kind === 'subtotal' ? totals.Subtotal
      : kind === 'cgst' ? totals.CGST
      : kind === 'sgst' ? totals.SGST
      : kind === 'gst' ? totals.GST ?? totals.Tax
      : totals.Total;
    if (!amount) return row;
    const cells = { ...row.cells, [valueCol]: amount };
    if (labelCol && kind === 'subtotal' && !cells[labelCol]) cells[labelCol] = 'SUBTOTAL';
    return { ...row, cells };
  });

  return productTablePropsToRecord({ ...props, rows });
}

function coerceComposerTableProps(
  elementType: string,
  raw: Record<string, unknown>
): ProductTableProps {
  const base = raw as unknown as ProductTableProps;
  if (Array.isArray(base.columns) && Array.isArray(base.rows)) {
    return base;
  }
  return normalizeTablePropsForType(elementType, raw);
}

/** Finalize table props after a composer edit — line items + summary block. */
export function finalizeComposerTableProps(
  elementType: string,
  raw: Record<string, unknown>,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): Record<string, unknown> {
  const resolvedType = resolveTableElementType(elementType, raw);
  const base = coerceComposerTableProps(elementType, raw);

  // Standalone totals tables are synced at page level after line-item tables are calculated.
  if (isSummaryOnlyTable(base)) {
    return productTablePropsToRecord(base);
  }

  const lines = lineRowsOnly(base.rows);

  if (isInvoiceTable1Type(resolvedType)) {
    return productTablePropsToRecord(
      recalculateInvoiceTable({ ...base, rows: lines } as InvoiceTableProps, tax)
    );
  }

  if (isInvoiceTable2Type(resolvedType)) {
    const as2 = raw as unknown as InvoiceTable2Props;
    return productTablePropsToRecord(
      recalculateInvoiceTable2(
        {
          ...base,
          ...as2,
          rows: lines,
          showSummaryTable: as2.showSummaryTable !== false,
        },
        tax
      )
    );
  }

  if (isInvoiceTable3Type(resolvedType)) {
    return productTablePropsToRecord(
      recalculateInvoiceTable3({ ...base, rows: lines } as InvoiceTable3Props, tax)
    );
  }

  let table: ProductTableProps = recalculateProductTable({ ...base, rows: lines });

  if (hasSummaryBlock(raw) || base.rows.some(isEmbeddedSummaryRow)) {
    table = recalculateInvoiceTable2(
      {
        ...(table as InvoiceTable2Props),
        rows: lineRowsOnly(table.rows),
        showSummaryTable: true,
      },
      tax
    );
    table = syncEmbeddedSummaryFromInvoice2(table, tax);
  }

  return productTablePropsToRecord(table);
}

/** Live preview: recompute summary from current row cells without re-normalizing template defaults. */
export function refreshTablePropsForLivePreview(
  elementType: string,
  raw: Record<string, unknown>,
  tax: TaxSettings = EMPTY_TAX_SETTINGS
): ProductTableProps {
  const finalized = finalizeComposerTableProps(elementType, raw, tax) as unknown as ProductTableProps;
  if (Array.isArray(finalized.columns) && Array.isArray(finalized.rows)) {
    return finalized;
  }
  return coerceComposerTableProps(elementType, raw);
}

function syncEmbeddedSummaryFromInvoice2(
  table: ProductTableProps,
  tax: TaxSettings
): ProductTableProps {
  const embedded = table.rows.filter(isEmbeddedSummaryRow);
  if (embedded.length === 0) return table;

  const lines = lineRowsOnly(table.rows);
  const as2 = table as InvoiceTable2Props;
  const summary = computeInvoice2Summary(lines, tax, as2.columns, as2);

  const amountCol =
    table.columns.find((col) => /^amount$|^total$/i.test(normalizeSummaryToken(col.label)))?.id
    ?? table.columns[table.columns.length - 1]?.id;

  if (!amountCol) return table;

  const syncedEmbedded = embedded.map((row) => {
    const kind = detectSummaryKind(row);
    if (!kind) return row;
    const amount =
      kind === 'total' ? summary.total
      : kind === 'subtotal' ? summary.subtotal
      : kind === 'cgst' ? summary.cgst
      : kind === 'sgst' ? summary.sgst
      : summary.gst;
    return { ...row, cells: { ...row.cells, [amountCol]: formatPreviewAmount(amount) } };
  });

  return {
    ...table,
    rows: [...lines, ...syncedEmbedded],
  };
}

function detectSummaryKind(
  row: Pick<ProductTableRow, 'name' | 'cells'>
): 'subtotal' | 'cgst' | 'sgst' | 'gst' | 'total' | null {
  const tokens = [row.name ?? '', ...Object.values(row.cells ?? {})].map((v) =>
    normalizeSummaryToken(String(v))
  );
  for (const token of tokens) {
    if (token.includes('subtotal')) return 'subtotal';
    if (token.includes('cgst')) return 'cgst';
    if (token.includes('sgst')) return 'sgst';
    if (token === 'gst' || token.startsWith('gst')) return 'gst';
    if (token === 'final' || token === 'total') return 'total';
  }
  return null;
}

function formatPreviewAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}
