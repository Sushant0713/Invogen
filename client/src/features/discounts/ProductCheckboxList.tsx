import { useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';

export interface ProductCheckboxItem {
  _id: string;
  name: string;
  sku?: string;
  price?: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
}

function formatCatalogDiscount(product: ProductCheckboxItem): string | null {
  if (!product.discount || product.discount <= 0) return null;
  if (product.discountType === 'fixed') {
    return `${formatCurrency(product.discount)} off`;
  }
  return `${product.discount}% off`;
}

function sortProductsNaturally(products: ProductCheckboxItem[]) {
  return [...products].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );
}

export function ProductCheckboxList({
  products,
  selectedIds,
  onChange,
}: {
  products: ProductCheckboxItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const sorted = useMemo(() => sortProductsNaturally(products), [products]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleProduct = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((item) => item !== id));
      return;
    }
    onChange([...selectedIds, id]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange(sorted.map((p) => p._id))}
          disabled={sorted.length === 0}
        >
          Select all
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([])}
          disabled={selectedIds.length === 0}
        >
          Uncheck all
        </Button>
        <span className="text-xs text-gray-500">
          {selectedIds.length} of {sorted.length} selected
        </span>
      </div>

      <div className="max-h-[220px] overflow-y-auto rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
        {sorted.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">No products found</p>
        ) : (
          sorted.map((product) => {
            const checked = selectedSet.has(product._id);
            const discountLabel = formatCatalogDiscount(product);
            return (
              <label
                key={product._id}
                className={`flex cursor-pointer items-start gap-3 px-4 py-2.5 transition-colors hover:bg-primary-50/40 ${
                  checked ? 'bg-primary-50/30' : ''
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                  checked={checked}
                  onChange={() => toggleProduct(product._id)}
                />
                <span className="min-w-0 flex-1 text-sm text-gray-800">
                  <span className="font-medium">{product.name}</span>
                  {product.sku ? (
                    <span className="text-gray-500"> ({product.sku})</span>
                  ) : null}
                  <span className="text-gray-500"> — ₹{product.price ?? 0}</span>
                  {discountLabel ? (
                    <span className="ml-1 text-xs text-green-700">· {discountLabel}</span>
                  ) : null}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
