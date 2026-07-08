import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Loader } from '@/components/ui/Loader';
import { toast } from 'sonner';
import { AdminProductsCrud } from './CrudPages';
import {
  parseProductSettings,
  type ProductSettings,
} from '@/features/builder/product-settings';
import { invalidateProductSettings } from '@/features/builder/use-product-settings-query';

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const { data: company, isLoading } = useQuery({
    queryKey: ['admin-company'],
    queryFn: async () => (await api.get('/admin/company')).data.data as Record<string, unknown>,
  });
  const [productSettings, setProductSettings] = useState<ProductSettings>({
    showProductSku: false,
  });

  useEffect(() => {
    if (!company) return;
    setProductSettings(parseProductSettings(company));
  }, [company]);

  const saveMutation = useMutation({
    mutationFn: async (next: ProductSettings) =>
      api.patch('/admin/company', { productSettings: next }),
    onSuccess: () => {
      invalidateProductSettings(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['admin-company'] });
      toast.success('Product settings saved');
    },
    onError: () => toast.error('Failed to save product settings'),
  });

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Product display</h2>
          <p className="mt-1 text-sm text-gray-500">
            Applies when products are picked in invoice tables. Each table can still override this
            in the template builder.
          </p>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Show SKU with product name</p>
            <p className="mt-0.5 text-xs text-gray-500">
              When on, picked products appear as “Name (SKU)” in the product column.
            </p>
          </div>
          <Switch
            checked={productSettings.showProductSku}
            onChange={(checked) => {
              const next = { showProductSku: checked };
              setProductSettings(next);
              saveMutation.mutate(next);
            }}
            label="Show SKU with product name"
          />
        </div>
      </Card>

      <AdminProductsCrud />
    </div>
  );
}
