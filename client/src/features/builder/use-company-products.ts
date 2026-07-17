import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import {
  companyApiForScope,
  productsApiForScope,
  type CompanyBrandingScope,
} from './company-branding';
import { useCompanyScope } from './CompanyBrandingProvider';

export type CompanyProductOption = {
  _id: string;
  name: string;
  sku?: string;
  price?: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  /** Product GST % (catalog). Used for invoice table line tax when set. */
  gst?: number;
  /** Legacy alias for gst % on some product records. */
  tax?: number;
  category?: string;
  suspendedBySystem?: boolean;
};

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  // Mongo Decimal128 / BSON number wrappers
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.$numberDecimal === 'string') {
      return toOptionalNumber(record.$numberDecimal);
    }
    if (typeof (value as { toString?: () => string }).toString === 'function') {
      const asString = String(value);
      if (asString && asString !== '[object Object]') {
        return toOptionalNumber(asString);
      }
    }
  }
  return undefined;
}

function extractProducts(payload: unknown): CompanyProductOption[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const id = row._id != null ? String(row._id) : '';
        const name = typeof row.name === 'string' ? row.name.trim() : '';
        if (!id || !name) return null;
        const price =
          toOptionalNumber(row.price)
          ?? toOptionalNumber(row.unitPrice)
          ?? toOptionalNumber(row.rate)
          ?? toOptionalNumber(row.sellingPrice);
        return {
          _id: id,
          name,
          sku: typeof row.sku === 'string' ? row.sku : undefined,
          price,
          discount: toOptionalNumber(row.discount),
          discountType:
            row.discountType === 'fixed' || row.discountType === 'percentage'
              ? row.discountType
              : undefined,
          gst: toOptionalNumber(row.gst),
          tax: toOptionalNumber(row.tax),
          category: typeof row.category === 'string' ? row.category : undefined,
          suspendedBySystem: typeof row.suspendedBySystem === 'boolean' ? row.suspendedBySystem : false,
        } satisfies CompanyProductOption;
      })
      .filter((item): item is CompanyProductOption => item != null);
  }
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return extractProducts((payload as { data: unknown }).data);
  }
  return [];
}

/** Company product catalog for invoice / template editors. */
export function useCompanyProducts(options?: {
  enabled?: boolean;
  search?: string;
  scope?: CompanyBrandingScope;
}) {
  const contextScope = useCompanyScope();
  const enabled = options?.enabled ?? true;
  const search = options?.search?.trim() ?? '';
  const scope = options?.scope ?? contextScope;
  const productsApi = productsApiForScope(scope);

  return useQuery({
    queryKey: ['builder-company-products', scope, search],
    queryFn: async () => {
      const res = await api.get(productsApi, {
        params: {
          limit: 100,
          naturalOrder: 'true',
          ...(search ? { search } : {}),
        },
      });
      // wrap() sends { success, data: Product[], meta }
      return extractProducts(res.data?.data);
    },
    enabled,
    staleTime: 5_000,
    refetchOnMount: 'always',
    retry: 1,
  });
}
