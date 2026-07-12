import type { TemplatePage } from '@invogen/shared';

/** Exact deep clone — preserves page/element ids and all nested table props. */
export function cloneTemplatePagesExact(pages: TemplatePage[]): TemplatePage[] {
  return JSON.parse(JSON.stringify(pages)) as TemplatePage[];
}

export function countTemplateElements(pages: TemplatePage[]): number {
  return pages.reduce((sum, page) => sum + (Array.isArray(page.elements) ? page.elements.length : 0), 0);
}
