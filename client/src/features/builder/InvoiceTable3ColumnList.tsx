import { useCallback, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import type { ProductTableColumn } from './product-table';
import { MIN_COL_WIDTH_PX, getColumnType, updateColumnType } from './product-table';
import { ColumnTypeSelect } from './AddColumnTypeSelect';
import {
  getInvoice3FlexibleColumnBounds,
  getTableTotalWidth,
  isInvoice3FixedColumn,
  isInvoice3ComputedColumn,
  removeInvoice3Column,
  reorderInvoice3FlexibleColumns,
  setInvoice3ColumnVisible,
  updateColumnWidthPx,
  updateInvoice3ColumnLabel,
  type InvoiceTable3Props,
} from './invoice-table-3';
import { useTaxSettings } from './TaxSettingsProvider';
import { ProductColumnSkuInline } from './ProductColumnOptions';
import { isProductColumn } from './product-table';

function ColumnWidthSlider({
  table,
  col,
  onChange,
}: {
  table: InvoiceTable3Props;
  col: ProductTableColumn;
  onChange: (next: InvoiceTable3Props) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        Width: {col.widthPx}px
      </label>
      <input
        type="range"
        min={MIN_COL_WIDTH_PX}
        max={Math.max(
          MIN_COL_WIDTH_PX + 20,
          getTableTotalWidth(table) - MIN_COL_WIDTH_PX * (table.columns.length - 1)
        )}
        value={col.widthPx}
        onChange={(e) => onChange(updateColumnWidthPx(table, col.id, Number(e.target.value)))}
        className="w-full accent-primary"
      />
    </div>
  );
}

function ColumnVisibilityButton({
  visible,
  disabled,
  onToggle,
}: {
  visible: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      title={visible ? 'Hide column' : 'Show column'}
      disabled={disabled}
      onClick={onToggle}
      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
    >
      {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
    </button>
  );
}

function FixedColumnRow({
  table,
  col,
  onChange,
}: {
  table: InvoiceTable3Props;
  col: ProductTableColumn;
  onChange: (next: InvoiceTable3Props) => void;
}) {
  const taxSettings = useTaxSettings();
  const visible = col.visible !== false;
  const visibleCount = table.columns.filter((item) => item.visible !== false).length;
  const computed = isInvoice3ComputedColumn(col.id);

  return (
    <div
      className={`space-y-2 rounded-lg border border-gray-100 p-2 ${visible ? '' : 'opacity-60'}`}
    >
      <div className="flex items-center gap-1">
        <Input value={col.label} disabled className="flex-1" />
        <span className="shrink-0 rounded-md bg-gray-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">
          {computed ? 'Calc' : 'Fixed'}
        </span>
        <ColumnVisibilityButton
          visible={visible}
          disabled={visible && visibleCount <= 1}
          onToggle={() =>
            onChange(setInvoice3ColumnVisible(table, col.id, !visible, taxSettings))
          }
        />
      </div>
      <ColumnWidthSlider table={table} col={col} onChange={onChange} />
    </div>
  );
}

function SortableFlexibleColumnRow({
  table,
  col,
  onChange,
}: {
  table: InvoiceTable3Props;
  col: ProductTableColumn;
  onChange: (next: InvoiceTable3Props) => void;
}) {
  const taxSettings = useTaxSettings();
  const visible = col.visible !== false;
  const visibleCount = table.columns.filter((item) => item.visible !== false).length;

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: col.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`space-y-2 rounded-lg border border-gray-100 p-2 ${
        isDragging ? 'opacity-50' : ''
      } ${visible ? '' : 'opacity-60'}`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="cursor-grab rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
          aria-label={`Drag to reorder ${col.label}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <Input
          value={col.label}
          placeholder="Enter column name"
          onChange={(e) => onChange(updateInvoice3ColumnLabel(table, col.id, e.target.value))}
          className="flex-1"
        />
        <ColumnTypeSelect
          value={getColumnType(col)}
          onChange={(type) =>
            onChange(updateColumnType(table, col.id, type) as InvoiceTable3Props)
          }
        />
        <ColumnVisibilityButton
          visible={visible}
          disabled={visible && visibleCount <= 1}
          onToggle={() =>
            onChange(setInvoice3ColumnVisible(table, col.id, !visible, taxSettings))
          }
        />
        <button
          type="button"
          title="Remove column"
          onClick={() => onChange(removeInvoice3Column(table, col.id))}
          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <ColumnWidthSlider table={table} col={col} onChange={onChange} />
      {isProductColumn(col) ? (
        <ProductColumnSkuInline
          tableShowProductSku={table.showProductSku}
          onTableShowProductSkuChange={(value) =>
            onChange({ ...table, showProductSku: value })
          }
        />
      ) : null}
    </div>
  );
}

function DragColumnPreview({ col }: { col: ProductTableColumn }) {
  return (
    <div className="space-y-2 rounded-lg border border-primary/30 bg-white p-2 shadow-lg">
      <div className="flex items-center gap-2">
        <GripVertical className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-sm font-medium text-gray-800">{col.label}</span>
      </div>
    </div>
  );
}

export function InvoiceTable3ColumnList({
  table,
  onChange,
}: {
  table: InvoiceTable3Props;
  onChange: (next: InvoiceTable3Props) => void;
}) {
  const flexibleBounds = getInvoice3FlexibleColumnBounds(table.columns);
  const flexibleColumns = table.columns.slice(flexibleBounds.start, flexibleBounds.end);
  const fixedColumns = table.columns.slice(flexibleBounds.end);
  const sortableIds = flexibleColumns.map((col) => col.id);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const activeColumn = activeDragId
    ? flexibleColumns.find((col) => col.id === activeDragId)
    : undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      onChange(reorderInvoice3FlexibleColumns(table, String(active.id), String(over.id)));
    },
    [onChange, table]
  );

  const handleDragCancel = useCallback(() => setActiveDragId(null), []);

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {flexibleColumns.map((col, index) => (
            <SortableFlexibleColumnRow
              key={col.id}
              table={table}
              col={col}
              onChange={onChange}
            />
          ))}
        </SortableContext>
        <DragOverlay>
          {activeColumn ? <DragColumnPreview col={activeColumn} /> : null}
        </DragOverlay>
      </DndContext>

      {fixedColumns.map((col) => (
        <FixedColumnRow key={col.id} table={table} col={col} onChange={onChange} />
      ))}
    </div>
  );
}
