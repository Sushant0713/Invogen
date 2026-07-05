const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

/** Normalize stored upload URLs so images load through the Vite proxy / same origin. */
export function resolveMediaUrl(url?: string): string | undefined {
  if (!url?.trim()) return undefined;
  const trimmed = url.trim();

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;

  const uploadMatch = trimmed.match(/\/uploads\/([a-f\d]{24})(?:[?#].*)?$/i);
  if (uploadMatch) {
    return `${API_BASE}/uploads/${uploadMatch[1]}`;
  }

  if (trimmed.startsWith('/')) return trimmed;

  return trimmed;
}

export function toAbsoluteMediaUrl(url?: string): string | undefined {
  const resolved = resolveMediaUrl(url);
  if (!resolved) return undefined;
  if (resolved.startsWith('data:') || resolved.startsWith('blob:')) return resolved;
  if (resolved.startsWith('http://') || resolved.startsWith('https://')) return resolved;
  return `${window.location.origin}${resolved}`;
}
