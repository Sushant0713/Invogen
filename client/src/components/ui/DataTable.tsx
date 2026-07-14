import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface DataTableProps<T> {
  columns: {
    key: string;
    label: string;
    render?: (item: T) => React.ReactNode;
    headerClassName?: string;
    cellClassName?: string;
  }[];
  data: T[];
  keyField?: string;
  loading?: boolean;
  getRowClassName?: (item: T) => string | undefined;
  getRowTitle?: (item: T) => string | undefined;
  pagination?: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  selection?: {
    selectedIds: string[];
    onToggleRow: (id: string) => void;
    onToggleAllVisible: () => void;
    isRowSelectable?: (item: T) => boolean;
    selectAllLabel?: string;
  };
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField = 'id',
  loading,
  getRowClassName,
  getRowTitle,
  pagination,
  selection,
}: DataTableProps<T>) {
  const [rowTip, setRowTip] = useState<{ text: string; x: number; y: number } | null>(null);

  if (loading) {
    return <div className="animate-pulse space-y-3">{[1, 2, 3].map((i) => (
      <div key={i} className="h-12 rounded-xl bg-gray-100" />
    ))}</div>;
  }

  const selectableRows = selection
    ? data.filter((item) => (selection.isRowSelectable ? selection.isRowSelectable(item) : true))
    : [];
  const selectableIds = selectableRows.map((item) => String(item[keyField]));
  const allVisibleSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selection?.selectedIds.includes(id));
  const someVisibleSelected = selectableIds.some((id) => selection?.selectedIds.includes(id));

  return (
    <div className="rounded-2xl border border-gray-100">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80">
            {selection ? (
              <th className="w-12 px-4 py-3">
                <label className="inline-flex items-center">
                  <span className="sr-only">{selection.selectAllLabel || 'Select all on page'}</span>
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={allVisibleSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = !allVisibleSelected && someVisibleSelected;
                    }}
                    onChange={selection.onToggleAllVisible}
                    disabled={selectableIds.length === 0}
                  />
                </label>
              </th>
            ) : null}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left font-medium text-gray-600 ${col.headerClassName || ''}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selection ? 1 : 0)} className="px-4 py-8 text-center text-gray-500">
                No data found
              </td>
            </tr>
          ) : (
            data.map((item, idx) => {
              const rowId = String(item[keyField] ?? idx);
              const rowSelectable = selection
                ? selection.isRowSelectable
                  ? selection.isRowSelectable(item)
                  : true
                : false;

              const extraClass = getRowClassName?.(item);
              const rowTitle = getRowTitle?.(item);

              return (
              <tr
                key={rowId || idx}
                className={`group border-b border-gray-50 transition-colors ${
                  extraClass || 'hover:bg-primary-50/30'
                }`}
                onMouseEnter={(event) => {
                  if (!rowTitle) {
                    setRowTip(null);
                    return;
                  }
                  const rect = event.currentTarget.getBoundingClientRect();
                  setRowTip({
                    text: rowTitle,
                    x: Math.min(rect.left + 24, window.innerWidth - 280),
                    y: Math.max(12, rect.top - 12),
                  });
                }}
                onMouseLeave={() => setRowTip(null)}
              >
                {selection ? (
                  <td className="px-4 py-3">
                    {rowSelectable ? (
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={selection.selectedIds.includes(rowId)}
                        onChange={() => selection.onToggleRow(rowId)}
                      />
                    ) : null}
                  </td>
                ) : null}
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-gray-700 ${col.cellClassName || ''}`}>
                    {col.render ? col.render(item) : String(item[col.key] ?? '')}
                  </td>
                ))}
              </tr>
              );
            })
          )}
        </tbody>
      </table>
      </div>
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <span className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {rowTip &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[100] -translate-y-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xl"
            style={{ left: rowTip.x, top: rowTip.y }}
          >
            {rowTip.text}
            <span className="absolute left-6 top-full border-8 border-transparent border-t-red-600" />
          </div>,
          document.body
        )}
    </div>
  );
}
