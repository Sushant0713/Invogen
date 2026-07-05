import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  MIN_ROW_HEIGHT_PX,
  MIN_BORDER_WIDTH_PX,
  MAX_BORDER_WIDTH_PX,
  clampBorderOpacity,
  clampBorderWidth,
} from './product-table';
import {
  productTablePropsToRecord,
  addInvoice3Column,
  removeRow,
  updateRowName,
  updateRowHeight,
  updateHeaderHeight,
  updateCell,
  normalizeInvoiceTable3Props,
  isInvoice3ComputedColumn,
  recalculateInvoiceTable3,
  addRow,
  setInvoice3DiscountMode,
  getInvoice3GrandTotalFormatted,
  type InvoiceTable3Props,
} from './invoice-table-3';
import type { InvoiceDiscountMode } from './invoice-table';
import { useTaxSettings } from './TaxSettingsProvider';
import { getCombinedGstRate } from './tax-settings';
import { InvoiceTable3ColumnList } from './InvoiceTable3ColumnList';
import { AddColumnTypeSelect } from './AddColumnTypeSelect';

export function InvoiceTable3Properties({
  props,
  onChange,
}: {
  props: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const taxSettings = useTaxSettings();
  const table = useMemo(
    () => recalculateInvoiceTable3(normalizeInvoiceTable3Props(props, taxSettings), taxSettings),
    [props, taxSettings]
  );
  const grandTotalPreview = useMemo(
    () =>
      getInvoice3GrandTotalFormatted(
        table.rows,
        taxSettings,
        table.columns,
        table.discountMode ?? 'amount'
      ),
    [table, taxSettings]
  );
  const commit = (next: InvoiceTable3Props) =>
    onChange(productTablePropsToRecord(recalculateInvoiceTable3(next, taxSettings)));

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
        Line total = (QTY × Rate − Discount) + GST. GST rate comes from Admin → Settings → Set up tax.
      </p>

      <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tax (from settings)</p>
        {!taxSettings.isEnabled ? (
          <p className="text-xs text-amber-700">Tax is disabled in company settings.</p>
        ) : (
          <p className="text-xs text-gray-600">GST: {getCombinedGstRate(taxSettings)}%</p>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Calculations</p>
        <div className="space-y-1.5">
          <label htmlFor="invoice3-discount-mode" className="block text-xs font-medium text-gray-600">
            Discount type
          </label>
          <select
            id="invoice3-discount-mode"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            value={table.discountMode ?? 'amount'}
            onChange={(e) =>
              commit(setInvoice3DiscountMode(table, e.target.value as InvoiceDiscountMode, taxSettings))
            }
          >
            <option value="amount">Amount (₹)</option>
            <option value="percent">Percentage (%)</option>
          </select>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total footer</p>
        <Input
          label="Label"
          value={table.totalFooterLabel ?? 'TOTAL :-'}
          onChange={(e) => commit({ ...table, totalFooterLabel: e.target.value })}
        />
        <div className="flex justify-between text-xs text-gray-700">
          <span>{table.totalFooterLabel ?? 'TOTAL :-'}</span>
          <span className="font-semibold tabular-nums">{grandTotalPreview}</span>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Footer height: {table.totalFooterHeightPx ?? MIN_ROW_HEIGHT_PX}px
          </label>
          <input
            type="range"
            min={MIN_ROW_HEIGHT_PX}
            max={80}
            value={table.totalFooterHeightPx ?? MIN_ROW_HEIGHT_PX}
            onChange={(e) =>
              commit({ ...table, totalFooterHeightPx: Number(e.target.value) })
            }
            className="w-full accent-primary"
          />
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
          <AddColumnTypeSelect onAdd={(type) => commit(addInvoice3Column(table, type))} />
        </div>
        <p className="mb-2 text-[11px] text-gray-500">
          Choose type when adding: NA, Sr.No. (auto), or Product (from Admin → Products).
        </p>
        <InvoiceTable3ColumnList table={table} onChange={commit} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rows</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => commit(addRow(table, taxSettings))}
          >
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
                  const computed = isInvoice3ComputedColumn(col.id);
                  return (
                    <Input
                      key={col.id}
                      label={col.label}
                      value={row.cells[col.id] || ''}
                      disabled={computed}
                      readOnly={computed}
                      onChange={(e) => commit(updateCell(table, row.id, col.id, e.target.value))}
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
