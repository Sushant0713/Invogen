import {
  TABLE_COLUMN_TYPE_LABELS,
  TABLE_COLUMN_TYPES,
  type TableColumnType,
} from './product-table';

const selectClass =
  'rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

export function AddColumnTypeSelect({
  onAdd,
}: {
  onAdd: (columnType: TableColumnType) => void;
}) {
  return (
    <select
      className={selectClass}
      defaultValue=""
      aria-label="Add column by type"
      onChange={(e) => {
        const value = e.target.value as TableColumnType | '';
        if (!value) return;
        onAdd(value);
        e.target.value = '';
      }}
    >
      <option value="" disabled>
        Add column…
      </option>
      {TABLE_COLUMN_TYPES.map((type) => (
        <option key={type} value={type}>
          {TABLE_COLUMN_TYPE_LABELS[type]}
        </option>
      ))}
    </select>
  );
}

/** Dropdown to set or change an existing column's type. */
export function ColumnTypeSelect({
  value,
  onChange,
}: {
  value?: TableColumnType;
  onChange: (columnType: TableColumnType) => void;
}) {
  return (
    <select
      className={`${selectClass} shrink-0`}
      value={value ?? 'na'}
      aria-label="Column type"
      onChange={(e) => onChange(e.target.value as TableColumnType)}
    >
      {TABLE_COLUMN_TYPES.map((type) => (
        <option key={type} value={type}>
          {TABLE_COLUMN_TYPE_LABELS[type]}
        </option>
      ))}
    </select>
  );
}
