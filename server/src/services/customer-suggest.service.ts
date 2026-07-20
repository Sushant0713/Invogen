import { Invoice } from '../models/Invoice.model';
import { Customer } from '../models/Customer.model';

/**
 * Detects "repeat" customers that were typed manually into an invoice instead
 * of being picked from the customer list, so the composer can offer to save
 * them. Identity is phone/email (people type names inconsistently); the name is
 * only used as a secondary similarity signal.
 */

export interface CustomerSuggestQuery {
  name?: string;
  phone?: string;
  email?: string;
}

export interface CustomerSuggestResult {
  /** True when this typed customer is missing from the customer list. */
  shouldSuggest: boolean;
  /** True when earlier invoices already used this identity. */
  isRepeat: boolean;
  /** How many earlier invoices match this identity. */
  priorInvoiceCount: number;
  /** Best-known details — merged from matching invoices, else the typed values. */
  suggestion?: {
    name: string;
    email?: string;
    phone?: string;
    gst?: string;
    address?: string;
  };
  reason?: 'already-a-customer' | 'not-enough-identity';
}

/** Digits only, dropping a leading country code so +91 98765 43210 === 9876543210. */
function digitsOnly(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Loose name match — same normalized string, or one contains the other. */
function namesLookAlike(a: string, b: string): boolean {
  if (!a || !b) return true; // name alone never blocks a phone/email match
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

function snapshotOf(invoice: { customerSnapshot?: Record<string, unknown> }) {
  return (invoice.customerSnapshot ?? {}) as Record<string, unknown>;
}

function readSnapshotField(
  snapshot: Record<string, unknown>,
  key: string
): string {
  const direct = snapshot[key];
  if (typeof direct === 'string' && direct.trim()) return direct;
  const placeholders = snapshot.placeholders as Record<string, unknown> | undefined;
  const fromPlaceholders = placeholders?.[key];
  return typeof fromPlaceholders === 'string' ? fromPlaceholders : '';
}

export const customerSuggestService = {
  async suggestFromInvoiceHistory(
    companyId: string,
    query: CustomerSuggestQuery
  ): Promise<CustomerSuggestResult> {
    const phone = digitsOnly(query.phone);
    const email = normalizeEmail(query.email);
    const name = normalizeName(query.name);

    // Phone/email is the identity. Without one we cannot match reliably.
    if (!phone && !email) {
      return {
        shouldSuggest: false,
        isRepeat: false,
        priorInvoiceCount: 0,
        reason: 'not-enough-identity',
      };
    }

    // Already saved as a customer? Then there is nothing to offer.
    const existingOr: Record<string, unknown>[] = [];
    if (phone) existingOr.push({ phone: { $regex: `${phone}$` } });
    if (email) existingOr.push({ email: new RegExp(`^${escapeRegex(email)}$`, 'i') });
    const existing = existingOr.length
      ? await Customer.findOne({ companyId, $or: existingOr }).lean()
      : null;
    if (existing) {
      return {
        shouldSuggest: false,
        isRepeat: false,
        priorInvoiceCount: 0,
        reason: 'already-a-customer',
      };
    }

    // Scan recent invoices for the same identity typed manually before.
    const invoices = await Invoice.find({ companyId })
      .select('customerSnapshot createdAt')
      .sort({ createdAt: -1 })
      .limit(400)
      .lean();

    let priorInvoiceCount = 0;
    let best: CustomerSuggestResult['suggestion'];

    for (const invoice of invoices) {
      const snapshot = snapshotOf(invoice as { customerSnapshot?: Record<string, unknown> });
      const snapPhone = digitsOnly(readSnapshotField(snapshot, 'phone') || readSnapshotField(snapshot, 'Phone'));
      const snapEmail = normalizeEmail(readSnapshotField(snapshot, 'email') || readSnapshotField(snapshot, 'Email'));
      const snapName = normalizeName(readSnapshotField(snapshot, 'name') || readSnapshotField(snapshot, 'ClientName'));

      const identityMatches =
        (!!phone && !!snapPhone && snapPhone === phone)
        || (!!email && !!snapEmail && snapEmail === email);
      if (!identityMatches) continue;
      if (!namesLookAlike(name, snapName)) continue;

      priorInvoiceCount += 1;
      if (!best) {
        best = {
          name: readSnapshotField(snapshot, 'name') || readSnapshotField(snapshot, 'ClientName') || String(query.name ?? ''),
          email: readSnapshotField(snapshot, 'email') || readSnapshotField(snapshot, 'Email') || query.email,
          phone: readSnapshotField(snapshot, 'phone') || readSnapshotField(snapshot, 'Phone') || query.phone,
          gst: readSnapshotField(snapshot, 'gst') || readSnapshotField(snapshot, 'GST') || undefined,
          address: readSnapshotField(snapshot, 'address') || readSnapshotField(snapshot, 'Address') || undefined,
        };
      }
    }

    // Not billed before: still worth offering to save them for next time —
    // fall back to what they just typed. Needs a name to be meaningful.
    if (priorInvoiceCount === 0) {
      const typedName = String(query.name ?? '').trim();
      if (!typedName) {
        return {
          shouldSuggest: false,
          isRepeat: false,
          priorInvoiceCount: 0,
          reason: 'not-enough-identity',
        };
      }
      return {
        shouldSuggest: true,
        isRepeat: false,
        priorInvoiceCount: 0,
        suggestion: { name: typedName, email: query.email, phone: query.phone },
      };
    }

    return {
      shouldSuggest: true,
      isRepeat: true,
      priorInvoiceCount,
      suggestion: best,
    };
  },
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
