import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { isTableWrapFriendlyColumn, isProductLikeColumn, tableHasSkuColumn } from '@/features/builder/product-table';
import { ProductCellSelect } from '@/features/builder/ProductCellSelect';
import type { CompanyProductOption } from '@/features/builder/use-company-products';
import { useProductSettings } from '@/features/builder/ProductSettingsProvider';
import { resolveShowProductSku } from '@/features/builder/product-settings';
import type { ScannedTable } from './invoice-document';
import { isTableCellEditableForRow } from './invoice-document';
import { TableDiscountModeSelect } from './TableDiscountModeSelect';
import type { InvoiceDiscountMode } from '@/features/builder/invoice-table';

interface InvoiceTableFormSectionProps {
  tables: ScannedTable[];
  onCellChange: (
    pageId: string,
    elementId: string,
    rowId: string,
    columnId: string,
    value: string
  ) => void;
  onProductPick?: (
    pageId: string,
    elementId: string,
    rowId: string,
    columnId: string,
    product: CompanyProductOption
  ) => void;
  onAddRow?: (pageId: string, elementId: string) => void;
  onDeleteRow?: (pageId: string, elementId: string, rowId: string) => void;
  onDiscountModeChange?: (
    pageId: string,
    elementId: string,
    mode: InvoiceDiscountMode
  ) => void;
  onAmountInWordsChange?: (
    pageId: string,
    elementId: string,
    enabled: boolean
  ) => void;
}

function FormSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function InvoiceTableFormSection({
  tables,
  onCellChange,
  onProductPick,
  onAddRow,
  onDeleteRow,
  onDiscountModeChange,
  onAmountInWordsChange,
}: InvoiceTableFormSectionProps) {
  const productSettings = useProductSettings();

  if (tables.length === 0) return null;

  return (
    <>
      {tables.map((table, tableIndex) => (
        <FormSection
          key={table.elementId}
          title={`${tables.length > 1 ? `${tableIndex + 1}. ` : ''}${table.label}`}
          subtitle={`${table.pageName} · ${table.tableKind} · ${table.rows.length} row${table.rows.length === 1 ? '' : 's'}`}
        >
          {table.supportsAmountInWords && onAmountInWordsChange ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
              <span className="text-sm font-medium text-gray-700">Amount in words</span>
              <Switch
                checked={table.showAmountInWords}
                onChange={(enabled) =>
                  onAmountInWordsChange(table.pageId, table.elementId, enabled)
                }
                label="Show amount in words"
              />
            </div>
          ) : null}
          {table.supportsDiscountMode && onDiscountModeChange ? (
            <TableDiscountModeSelect
              id={`form-discount-mode-${table.elementId}`}
              value={table.discountMode ?? 'amount'}
              onChange={(mode) =>
                onDiscountModeChange(table.pageId, table.elementId, mode)
              }
            />
          ) : null}
          {table.rows.map((row, rowIndex) => {
            const editableColumns = table.columns.filter((col) =>
              isTableCellEditableForRow(
                table.elementType,
                col.id,
                row,
                col.columnType,
                col.label
              )
            );
            if (editableColumns.length === 0) return null;

            return (
            <div key={row.id} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Row {rowIndex + 1}
                </p>
                {onDeleteRow && table.rows.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => onDeleteRow(table.pageId, table.elementId, row.id)}
                    title={`Delete row ${rowIndex + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {editableColumns.map((col) => {
                  const isProduct = isProductLikeColumn(col);
                  const isMultiline = isTableWrapFriendlyColumn(col);
                  const cellValue = row.cells[col.id] ?? '';

                  if (isProduct) {
                    return (
                      <div key={col.id} className="space-y-1.5 sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">{col.label}</label>
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                          <ProductCellSelect
                            value={cellValue}
                            width={320}
                            height={40}
                            fullWidth
                            showSku={
                              tableHasSkuColumn(table.columns)
                                ? false
                                : resolveShowProductSku(table.showProductSku, productSettings)
                            }
                            onChange={(value) =>
                              onCellChange(
                                table.pageId,
                                table.elementId,
                                row.id,
                                col.id,
                                value
                              )
                            }
                            onProductSelect={
                              onProductPick
                                ? (product) =>
                                    onProductPick(
                                      table.pageId,
                                      table.elementId,
                                      row.id,
                                      col.id,
                                      product
                                    )
                                : undefined
                            }
                          />
                        </div>
                      </div>
                    );
                  }

                  if (isMultiline) {
                    return (
                      <div key={col.id} className="space-y-1.5">
                        <label className="block text-sm font-medium text-gray-700">{col.label}</label>
                        <textarea
                          className="min-h-[72px] w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                          value={cellValue}
                          onChange={(e) =>
                            onCellChange(
                              table.pageId,
                              table.elementId,
                              row.id,
                              col.id,
                              e.target.value
                            )
                          }
                        />
                      </div>
                    );
                  }

                  return (
                    <Input
                      key={col.id}
                      label={col.label}
                      value={cellValue}
                      onChange={(e) =>
                        onCellChange(
                          table.pageId,
                          table.elementId,
                          row.id,
                          col.id,
                          e.target.value
                        )
                      }
                    />
                  );
                })}
              </div>
            </div>
            );
          })}
          {onAddRow ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onAddRow(table.pageId, table.elementId)}
            >
              <Plus className="h-4 w-4" />
              Add row
            </Button>
          ) : null}
        </FormSection>
      ))}
    </>
  );
}
