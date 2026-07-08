export type ProductSettings = {
  showProductSku: boolean;
};

export const EMPTY_PRODUCT_SETTINGS: ProductSettings = {
  showProductSku: false,
};

export const PRODUCT_SETTINGS_QUERY_KEY = 'product-settings';

export function parseProductSettings(company: Record<string, unknown> | undefined): ProductSettings {
  const raw = company?.productSettings;
  if (!raw || typeof raw !== 'object') return EMPTY_PRODUCT_SETTINGS;
  const settings = raw as Record<string, unknown>;
  return {
    showProductSku: settings.showProductSku === true,
  };
}

/** Table override wins when set; otherwise use company default from Admin → Products. */
export function resolveShowProductSku(
  tableShowProductSku: boolean | undefined,
  companySettings: ProductSettings = EMPTY_PRODUCT_SETTINGS
): boolean {
  if (tableShowProductSku === true) return true;
  if (tableShowProductSku === false) return false;
  return companySettings.showProductSku === true;
}

export function normalizeShowProductSku(raw: unknown): boolean | undefined {
  if (raw === true) return true;
  if (raw === false) return false;
  return undefined;
}
