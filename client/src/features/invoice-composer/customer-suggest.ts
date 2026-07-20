import { useEffect, useMemo, useRef, useState } from 'react';
import api from '@/api/client';

export interface CustomerSuggestion {
  name: string;
  email?: string;
  phone?: string;
  gst?: string;
  address?: string;
}

export interface CustomerSuggestResponse {
  shouldSuggest: boolean;
  /** True when earlier invoices already used this phone/email. */
  isRepeat: boolean;
  priorInvoiceCount: number;
  suggestion?: CustomerSuggestion;
  reason?: string;
}

/** Stable key for a typed identity — used for dismissals and change detection. */
export function customerIdentityKey(
  name: string | undefined,
  phone: string | undefined,
  email: string | undefined
): string {
  const digits = String(phone ?? '').replace(/\D/g, '').slice(-10);
  const mail = String(email ?? '').trim().toLowerCase();
  const person = String(name ?? '').trim().toLowerCase();
  return `${person}|${digits}|${mail}`;
}

function hasEnoughIdentity(phone?: string, email?: string): boolean {
  const digits = String(phone ?? '').replace(/\D/g, '');
  const mail = String(email ?? '').trim();
  return digits.length >= 10 || /.+@.+\..+/.test(mail);
}

/**
 * Asks the server whether this manually-typed customer was billed before and
 * is missing from the customer list. Only runs when the user typed details
 * instead of selecting an existing customer.
 */
export function useRepeatCustomerSuggestion(params: {
  apiBase: string;
  enabled: boolean;
  name?: string;
  phone?: string;
  email?: string;
}): { data: CustomerSuggestResponse | null; identityKey: string } {
  const { apiBase, enabled, name, phone, email } = params;
  const identityKey = useMemo(
    () => customerIdentityKey(name, phone, email),
    [name, phone, email]
  );
  const [data, setData] = useState<CustomerSuggestResponse | null>(null);
  const latestKeyRef = useRef(identityKey);

  useEffect(() => {
    latestKeyRef.current = identityKey;
    if (!enabled || !hasEnoughIdentity(phone, email)) {
      setData(null);
      return;
    }

    let cancelled = false;
    // Debounce: the identity fields change on every keystroke.
    const timer = window.setTimeout(async () => {
      try {
        const res = await api.get(`${apiBase}/customers/suggest`, {
          params: { name: name ?? '', phone: phone ?? '', email: email ?? '' },
        });
        if (cancelled || latestKeyRef.current !== identityKey) return;
        setData(res.data?.data ?? res.data ?? null);
      } catch {
        if (!cancelled) setData(null);
      }
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [apiBase, enabled, identityKey, name, phone, email]);

  return { data, identityKey };
}
