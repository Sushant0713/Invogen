import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  EMPTY_PRODUCT_SETTINGS,
  type ProductSettings,
} from './product-settings';
import { useProductSettingsQuery } from './use-product-settings-query';

const ProductSettingsContext = createContext<ProductSettings>(EMPTY_PRODUCT_SETTINGS);

export function ProductSettingsProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const { data } = useProductSettingsQuery(enabled);
  const value = useMemo(() => data ?? EMPTY_PRODUCT_SETTINGS, [data]);

  return (
    <ProductSettingsContext.Provider value={value}>
      {children}
    </ProductSettingsContext.Provider>
  );
}

export function useProductSettings(): ProductSettings {
  return useContext(ProductSettingsContext);
}
