import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  type ProductTableProps,
  type TableColumnType,
  MIN_ROW_HEIGHT_PX,
  MIN_BORDER_WIDTH_PX,
  MAX_BORDER_WIDTH_PX,
  normalizeProductTableProps,
  productTablePropsToRecord,
  clampBorderOpacity,
  clampBorderWidth,
  addColumn,
  removeColumn,
  updateColumnLabel,
  updateColumnWidthPx,
  getTableTotalWidth,
  MIN_COL_WIDTH_PX,
  addRow,
  removeRow,
  updateRowName,
  updateRowHeight,
  updateHeaderHeight,
  updateCell,
  getColumnType,
  isSerialColumn,
  isProductColumn,
  updateColumnType,
} from './product-table';
import { AddColumnTypeSelect, ColumnTypeSelect } from './AddColumnTypeSelect';

export function ProductTableProperties({
  props,
  onChange,
}: {
  props: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const table = normalizeProductTableProps(props);
  const commit = (next: ProductTableProps) => onChange(productTablePropsToRecord(next));

  const handleAddColumn = (columnType: TableColumnType) => {
    commit(addColumn(table, columnType));
  };

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
        Choose a column type when adding: <strong>NA</strong> (plain text), <strong>Sr.No.</strong>{' '}
        (auto numbers), or <strong>Product</strong> (searchable list from Admin → Products).
      </p>

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
          <AddColumnTypeSelect onAdd={handleAddColumn} />
        </div>
        <div className="space-y-2">
          {table.columns.map((col) => (
            <div key={col.id} className="space-y-2 rounded-lg border border-gray-100 p-2">
              <div className="flex items-center gap-1">
                <Input
                  value={col.label}
                  placeholder="Enter column name"
                  onChange={(e) => commit(updateColumnLabel(table, col.id, e.target.value))}
                  className="flex-1"
                />
                <ColumnTypeSelect
                  value={getColumnType(col)}
                  onChange={(type) => commit(updateColumnType(table, col.id, type))}
                />
                <button
                  type="button"
                  title="Remove column"
                  disabled={table.columns.length <= 1}
                  onClick={() => commit(removeColumn(table, col.id))}
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Width: {col.widthPx}px
                </label>
                <input
                  type="range"
                  min={MIN_COL_WIDTH_PX}
                  max={Math.max(MIN_COL_WIDTH_PX + 20, getTableTotalWidth(table) - MIN_COL_WIDTH_PX * (table.columns.length - 1))}
                  value={col.widthPx}
                  onChange={(e) => commit(updateColumnWidthPx(table, col.id, Number(e.target.value)))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rows</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => commit(addRow(table))}>
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
              {table.columns.map((col) => {
                const serial = isSerialColumn(col);
                const product = isProductColumn(col);
                return (
                  <Input
                    key={col.id}
                    label={col.label}
                    value={row.cells[col.id] || ''}
                    disabled={serial}
                    readOnly={serial}
                    placeholder={product ? 'Type or pick on canvas' : undefined}
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
