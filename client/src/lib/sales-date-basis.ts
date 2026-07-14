const STORAGE_KEY = 'invogen:sales-date-basis';

export type SalesDateBasisPreference = 'invoice' | 'status';

export function getSalesDateBasis(companyId?: string | null): SalesDateBasisPreference {
  if (typeof window === 'undefined') return 'invoice';
  try {
    const scoped = companyId ? window.localStorage.getItem(`${STORAGE_KEY}:${companyId}`) : null;
    const raw = scoped ?? window.localStorage.getItem(STORAGE_KEY);
    return raw === 'status' ? 'status' : 'invoice';
  } catch {
    return 'invoice';
  }
}

export function setSalesDateBasis(
  basis: SalesDateBasisPreference,
  companyId?: string | null
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = companyId ? `${STORAGE_KEY}:${companyId}` : STORAGE_KEY;
    window.localStorage.setItem(key, basis);
    window.localStorage.setItem(STORAGE_KEY, basis);
    window.dispatchEvent(
      new CustomEvent('invogen:sales-date-basis-changed', { detail: { basis, companyId } })
    );
  } catch {
    /* ignore quota / private mode */
  }
}
