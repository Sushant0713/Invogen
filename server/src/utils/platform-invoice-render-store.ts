import type { TemplatePage } from '@invogen/shared';
import { randomUUID } from 'crypto';

export type PlatformInvoiceRenderPayload = {
  pages: TemplatePage[];
  invoiceNumber: string;
  branding: {
    logo?: string;
    signature?: string;
  };
  /** Platform invoice CGST/SGST — used for the same table math as Super Admin live preview. */
  tax?: {
    cgstRate: number;
    sgstRate: number;
  };
  expiresAt: number;
};

const TTL_MS = 10 * 60 * 1000;
const store = new Map<string, PlatformInvoiceRenderPayload>();

export function createPlatformInvoiceRenderToken(
  payload: Omit<PlatformInvoiceRenderPayload, 'expiresAt'>
): string {
  const token = randomUUID();
  store.set(token, { ...payload, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function getPlatformInvoiceRenderPayload(
  token: string
): PlatformInvoiceRenderPayload | null {
  const row = store.get(token);
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    store.delete(token);
    return null;
  }
  return row;
}

export function consumePlatformInvoiceRenderToken(token: string): PlatformInvoiceRenderPayload | null {
  const row = getPlatformInvoiceRenderPayload(token);
  if (!row) return null;
  store.delete(token);
  return row;
}
