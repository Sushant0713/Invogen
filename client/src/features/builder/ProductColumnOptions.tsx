import { Switch } from '@/components/ui/Switch';
import { tableHasProductColumn } from './product-cell';
import { useProductSettings } from './ProductSettingsProvider';
import { resolveShowProductSku } from './product-settings';
import type { ProductTableColumn } from './product-table';

function ProductColumnSkuToggle({
  tableShowProductSku,
  onTableShowProductSkuChange,
  compact = false,
}: {
  tableShowProductSku?: boolean;
  onTableShowProductSkuChange: (value: boolean) => void;
  compact?: boolean;
}) {
  const companySettings = useProductSettings();
  const checked = resolveShowProductSku(tableShowProductSku, companySettings);

  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        compact ? 'rounded-lg border border-gray-100 bg-white px-2.5 py-2' : ''
      }`}
    >
      <div>
        <p className={`font-medium text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>
          Show SKU with name
        </p>
        {!compact ? (
          <p className="text-xs text-gray-500">
            When on, picked products appear as “Name (SKU)” in the same column.
          </p>
        ) : null}
      </div>
      <Switch
        checked={checked}
        onChange={onTableShowProductSkuChange}
        label="Show SKU with product name"
      />
    </div>
  );
}

export function ProductColumnOptions({
  columns,
  showProductSku,
  onShowProductSkuChange,
}: {
  columns: ProductTableColumn[];
  showProductSku?: boolean;
  onShowProductSkuChange: (value: boolean) => void;
}) {
  if (!tableHasProductColumn(columns)) return null;

  return (
    <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Product column</p>
      <ProductColumnSkuToggle
        tableShowProductSku={showProductSku}
        onTableShowProductSkuChange={onShowProductSkuChange}
      />
    </div>
  );
}

export function ProductColumnSkuInline({
  tableShowProductSku,
  onTableShowProductSkuChange,
}: {
  tableShowProductSku?: boolean;
  onTableShowProductSkuChange: (value: boolean) => void;
}) {
  return (
    <ProductColumnSkuToggle
      compact
      tableShowProductSku={tableShowProductSku}
      onTableShowProductSkuChange={onTableShowProductSkuChange}
    />
  );
}
