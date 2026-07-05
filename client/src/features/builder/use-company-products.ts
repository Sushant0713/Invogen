import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';

export type CompanyProductOption = {
  _id: string;
  name: string;
  sku?: string;
  price?: number;
  category?: string;
};

function extractProducts(payload: unknown): CompanyProductOption[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const id = row._id != null ? String(row._id) : '';
        const name = typeof row.name === 'string' ? row.name.trim() : '';
        if (!id || !name) return null;
        return {
          _id: id,
          name,
          sku: typeof row.sku === 'string' ? row.sku : undefined,
          price: typeof row.price === 'number' ? row.price : undefined,
          category: typeof row.category === 'string' ? row.category : undefined,
        } satisfies CompanyProductOption;
      })
      .filter((item): item is CompanyProductOption => item != null);
  }
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return extractProducts((payload as { data: unknown }).data);
  }
  return [];
}

/** Products from Admin → Products, with optional name search. */
export function useCompanyProducts(options?: {
  enabled?: boolean;
  search?: string;
}) {
  const enabled = options?.enabled ?? true;
  const search = options?.search?.trim() ?? '';

  return useQuery({
    queryKey: ['builder-company-products', search],
    queryFn: async () => {
      const res = await api.get('/admin/products', {
        params: {
          limit: 100,
          ...(search ? { search } : {}),
        },
      });
      // wrap() sends { success, data: Product[], meta }
      return extractProducts(res.data?.data);
    },
    enabled,
    staleTime: 15_000,
    retry: 1,
  });
}
