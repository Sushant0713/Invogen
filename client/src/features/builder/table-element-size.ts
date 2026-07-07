import {
  type ProductTableProps,
  type ProductTableColumn,
  computeTableHeight,
  fitTableLayoutForPreview,
  getDisplayTableTotalWidth,
  isTableElementType,
  productTablePropsToRecord,
  scaleTableLayout,
  MIN_COL_WIDTH_PX,
  MIN_ROW_HEIGHT_PX,
} from './product-table';
import { isInvoiceTable1Type, getVisibleInvoiceColumns } from './invoice-table';
import { isInvoiceTable2Type, computeInvoiceTable2Height, getVisibleInvoice2Columns } from './invoice-table-2';
import { isInvoiceTable3Type, computeInvoiceTable3Height, getVisibleInvoice3Columns } from './invoice-table-3';
import { normalizeTablePropsForType } from './table-props-normalize';

export function resolveTableElementSize(
  elementType: string | undefined,
  props: ProductTableProps
): { width: number; height: number } {
  const width = getDisplayTableTotalWidth(props) + 2;
  let height = computeTableHeight(props);
  if (elementType && isInvoiceTable2Type(elementType)) {
    height = computeInvoiceTable2Height(props);
  } else if (elementType && isInvoiceTable3Type(elementType)) {
    height = computeInvoiceTable3Height(props);
  }
  return { width, height };
}

function tableDisplayColumns(elementType: string, table: ProductTableProps): ProductTableColumn[] {
  if (isInvoiceTable1Type(elementType)) return getVisibleInvoiceColumns(table.columns);
  if (isInvoiceTable2Type(elementType)) return getVisibleInvoice2Columns(table.columns);
  if (isInvoiceTable3Type(elementType)) return getVisibleInvoice3Columns(table.columns);
  return table.columns.filter((col) => col.visible !== false);
}

/** Fitted table layout for live preview (column widths, row heights, headers). */
export function resolvePreviewTableFittedLayout(
  elementType: string,
  containerWidthPx: number,
  rawProps: Record<string, unknown>
): { width: number; height: number; tableProps: Record<string, unknown> } {
  const table = normalizeTablePropsForType(elementType, rawProps);
  const displayColumns = tableDisplayColumns(elementType, table);
  const base =
    displayColumns === table.columns
      ? table
      : { ...table, columns: displayColumns };
  const fitted = fitTableLayoutForPreview(base, Math.max(1, containerWidthPx));
  const size = resolveTableElementSize(elementType, fitted);
  return {
    width: size.width,
    height: size.height,
    tableProps: productTablePropsToRecord(fitted),
  };
}

/** Keep table layout and box inside the template content area (inside page margins). */
export function clampTableElementToPage(
  x: number,
  y: number,
  table: ProductTableProps,
  pageWidth = 794,
  pageHeight = 1123,
  margins: { top: number; right: number; bottom: number; left: number } = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  elementType?: string
): {
  x: number;
  y: number;
  width: number;
  height: number;
  table: ProductTableProps;
} {
  const minX = margins.left;
  const minY = margins.top;
  const maxRight = pageWidth - margins.right;
  const maxBottom = pageHeight - margins.bottom;

  const originX = Math.max(minX, x);
  const originY = Math.max(minY, y);
  const maxW = Math.max(MIN_COL_WIDTH_PX + 2, maxRight - originX);
  const maxH = Math.max(MIN_ROW_HEIGHT_PX + 2, maxBottom - originY);

  let resultTable = table;
  let fitted = resolveTableElementSize(elementType, resultTable);

  if (fitted.width > maxW || fitted.height > maxH) {
    const scale = Math.min(maxW / fitted.width, maxH / fitted.height, 1);
    if (scale < 1) {
      resultTable = scaleTableLayout(resultTable, scale, scale);
      fitted = resolveTableElementSize(elementType, resultTable);
    }
  }

  const width = Math.min(fitted.width, maxW);
  const height = Math.min(fitted.height, maxH);
  const clampedX = Math.max(minX, Math.min(originX, maxRight - width));
  const clampedY = Math.max(minY, Math.min(originY, maxBottom - height));

  return { x: clampedX, y: clampedY, width, height, table: resultTable };
}
