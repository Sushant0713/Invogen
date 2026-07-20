export interface StructuredAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

const PIN_RE = /\b(\d{6})\b/;
/** "Maharashtra (27)" -> "Maharashtra" — invoices often carry the GST state code. */
const STATE_CODE_SUFFIX_RE = /\s*\(\s*\d{1,2}\s*\)\s*$/;

function clean(value: string): string {
  return value.trim().replace(/[,;]+$/, '').trim();
}

/**
 * Best-effort parse of the free-text address typed on an invoice into the
 * structured shape the Customer model stores.
 *
 * Invoice addresses are entered as loose multi-line text, e.g.
 *   Suryanagar, Plot 4
 *   Mumbai, Maharashtra (27)
 *   India 400059
 * Anything we cannot confidently classify stays in `street`, so no typed
 * detail is ever lost.
 */
export function parseCustomerAddress(raw: string | undefined): StructuredAddress {
  const text = String(raw ?? '').trim();
  if (!text) return {};

  const lines = text
    .split('\n')
    .map(clean)
    .filter(Boolean);
  if (lines.length === 0) return {};

  const result: StructuredAddress = {};
  const remaining = [...lines];

  // PIN code can appear on any line; pull it out wherever it is.
  for (let i = remaining.length - 1; i >= 0; i -= 1) {
    const match = PIN_RE.exec(remaining[i]);
    if (!match) continue;
    result.zipCode = match[1];
    const stripped = clean(remaining[i].replace(match[1], ''));
    if (stripped) remaining[i] = stripped;
    else remaining.splice(i, 1);
    break;
  }

  // Last line often holds the country (no digits, single-or-two words).
  if (remaining.length > 1) {
    const last = remaining[remaining.length - 1];
    if (!/\d/.test(last) && last.split(/\s+/).length <= 2 && !last.includes(',')) {
      result.country = last;
      remaining.pop();
    }
  }

  // Next candidate line is usually "City, State".
  if (remaining.length > 0) {
    const candidate = remaining[remaining.length - 1];
    if (candidate.includes(',')) {
      const parts = candidate.split(',').map(clean).filter(Boolean);
      if (parts.length >= 2) {
        result.state = parts[parts.length - 1].replace(STATE_CODE_SUFFIX_RE, '').trim();
        result.city = parts[parts.length - 2];
        // Anything before city belongs to the street.
        const leading = parts.slice(0, -2);
        remaining.pop();
        if (leading.length) remaining.push(leading.join(', '));
      }
    } else if (remaining.length > 1) {
      // Bare city line above the street block.
      result.city = candidate;
      remaining.pop();
    }
  }

  const street = remaining.join(', ').trim();
  if (street) result.street = street;

  return result;
}
