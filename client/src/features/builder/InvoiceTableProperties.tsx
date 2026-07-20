import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  MIN_ROW_HEIGHT_PX,
  MIN_BORDER_WIDTH_PX,
  MAX_BORDER_WIDTH_PX,
  resolveBuilderTablePropsForEdit,
} from './product-table';
import {
  invoiceTablePropsToRecord,
  clampBorderOpacity,
  clampBorderWidth,
  addInvoiceColumn,
  removeRow,
  updateRowName,
  updateRowHeight,
  updateHeaderHeight,
  updateCell,
  normalizeInvoiceTableProps,
  isInvoiceComputedColumn,
  recalculateInvoiceTable,
  addRow,
  setInvoiceDiscountMode,
  setInvoiceTaxDisplayMode,
  type InvoiceDiscountMode,
  type InvoiceTaxDisplayMode,
} from './invoice-table';
import { useTaxSettings } from './TaxSettingsProvider';
import { InvoiceTableColumnList } from './InvoiceTableColumnList';
import { AddColumnTypeSelect } from './AddColumnTypeSelect';
import { ProductColumnOptions } from './ProductColumnOptions';
import { Switch } from '@/components/ui/Switch';

export function InvoiceTableProperties({
  props,
  onChange,
}: {
  props: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const taxSettings = useTaxSettings();
  const table = useMemo(
    () => recalculateInvoiceTable(normalizeInvoiceTableProps(resolveBuilderTablePropsForEdit(props)), taxSettings),
    [props, taxSettings]
  );
  const commit = (next: ReturnType<typeof normalizeInvoiceTableProps>) =>
    onChange(invoiceTablePropsToRecord(next));

  return (
    <div className="space-y-5 border-t border-gray-100 pt-4">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Style</p>
        <Input
          label="Table color"
          type="color"
          value={table.tableColor}
          onChange={(e) => commit({ ...table, tableColor: e.target.value })}
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Border opacity: {table.borderOpacity}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={table.borderOpacity}
            onChange={(e) =>
              commit({ ...table, borderOpacity: clampBorderOpacity(Number(e.target.value)) })
            }
            className="w-full accent-primary"
          />
        </div>
        <Input
          label="Border thickness (px)"
          type="number"
          min={MIN_BORDER_WIDTH_PX}
          max={MAX_BORDER_WIDTH_PX}
          value={String(table.borderWidth)}
          onChange={(e) =>
            commit({ ...table, borderWidth: clampBorderWidth(Number(e.target.value)) })
          }
        />
      </div>

      <p className="text-xs text-gray-500">
        Drag custom columns to reorder. Hidden columns are excluded from calculations. Choose
        whether discount is a flat amount or percentage, and CGST+SGST, combined GST, or IGST.
      </p>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Amount in words</p>
          <p className="mt-0.5 text-[11px] text-gray-500">Show total amount in words under the table</p>
        </div>
        <Switch
          checked={table.showAmountInWords !== false}
          onChange={(checked) => commit({ ...table, showAmountInWords: checked })}
          label="Show amount in words"
        />
      </div>

      <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Calculations</p>
        <div className="space-y-1.5">
          <label htmlFor="invoice-discount-mode" className="block text-xs font-medium text-gray-600">
            Discount type
          </label>
          <select
            id="invoice-discount-mode"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            value={table.discountMode ?? 'amount'}
            onChange={(e) =>
              commit(setInvoiceDiscountMode(table, e.target.value as InvoiceDiscountMode, taxSettings))
            }
          >
            <option value="amount">Amount (₹)</option>
            <option value="percent">Percentage (%)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="invoice-tax-display" className="block text-xs font-medium text-gray-600">
            Tax columns
          </label>
          <select
            id="invoice-tax-display"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            value={table.taxDisplayMode ?? 'split'}
            onChange={(e) =>
              commit(setInvoiceTaxDisplayMode(table, e.target.value as InvoiceTaxDisplayMode, taxSettings))
            }
          >
            <option value="split">CGST + SGST</option>
            <option value="combined">GST (combined)</option>
            <option value="igst">IGST</option>
          </select>
        </div>
      </div>

      {table.showHeader && (
        <Input
          label="Header height (px)"
          type="number"
          min={MIN_ROW_HEIGHT_PX}
          value={String(table.headerHeightPx || MIN_ROW_HEIGHT_PX)}
          onChange={(e) => commit(updateHeaderHeight(table, Number(e.target.value)))}
        />
      )}

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Columns</p>
          <AddColumnTypeSelect onAdd={(type) => commit(addInvoiceColumn(table, type))} />
        </div>
        <p className="mb-2 text-[11px] text-gray-500">
          Choose type when adding: NA, Sr.No., Product, SKU, or HSN.
        </p>
        <ProductColumnOptions
          columns={table.columns}
          showProductSku={table.showProductSku}
          onShowProductSkuChange={(value) => commit({ ...table, showProductSku: value })}
        />
        <InvoiceTableColumnList
          table={table}
          taxSettings={taxSettings}
          onChange={commit}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rows</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => commit(addRow(table, taxSettings))}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
        <div className="space-y-4">
          {table.rows.map((row) => (
            <div key={row.id} className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 space-y-2">
              <div className="flex items-center gap-1">
                <Input
                  label="Row name"
                  value={row.name}
                  onChange={(e) => commit(updateRowName(table, row.id, e.target.value))}
                  className="flex-1"
                />
                <button
                  type="button"
                  title="Remove row"
                  disabled={table.rows.length <= 1}
                  onClick={() => commit(removeRow(table, row.id))}
                  className="mt-5 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {table.columns
                .filter((col) => col.visible !== false)
                .map((col) => {
                const computed = isInvoiceComputedColumn(col.id);
                return (
                <Input
                  key={col.id}
                  label={col.label}
                  value={row.cells[col.id] || ''}
                  disabled={computed}
                  readOnly={computed}
                  onChange={(e) => commit(updateCell(table, row.id, col.id, e.target.value, taxSettings))}
                />
              );
              })}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Height: {row.heightPx}px
                </label>
                <input
                  type="range"
                  min={MIN_ROW_HEIGHT_PX}
                  max={200}
                  value={row.heightPx}
                  onChange={(e) => commit(updateRowHeight(table, row.id, Number(e.target.value)))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
