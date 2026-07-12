import type { TemplatePage } from '@invogen/shared';

export type PlaceholderContext = Record<string, string>;

const MUSTACHE_RE = /\{\{(\w+)\}\}/g;
const ANGLE_RE = /<\s*([^<>]+?)\s*>/g;

function normalizeAnglePlaceholderLabel(inner: string): string {
  return inner.trim().replace(/\s+/g, ' ');
}

function resolvedPlaceholderValue(
  key: string,
  context: PlaceholderContext,
  unresolvedFallback: string
): string {
  const raw = context[key];
  if (typeof raw === 'string' && raw.trim()) return raw;
  return unresolvedFallback;
}

export function replacePlaceholdersInString(value: string, context: PlaceholderContext): string {
  let next = value.replace(MUSTACHE_RE, (_, key: string) =>
    resolvedPlaceholderValue(key, context, `{{${key}}}`)
  );
  next = next.replace(ANGLE_RE, (_, inner: string) => {
    const key = normalizeAnglePlaceholderLabel(inner);
    if (!key) return `<${inner}>`;
    return resolvedPlaceholderValue(key, context, `<${key}>`);
  });
  return next;
}

function transformValue(value: unknown, context: PlaceholderContext): unknown {
  if (typeof value === 'string') return replacePlaceholdersInString(value, context);
  if (Array.isArray(value)) return value.map((item) => transformValue(item, context));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = transformValue(v, context);
    }
    return out;
  }
  return value;
}

export function applyPlaceholdersToPages(
  pages: TemplatePage[],
  context: PlaceholderContext
): TemplatePage[] {
  return transformValue(pages, context) as TemplatePage[];
}
