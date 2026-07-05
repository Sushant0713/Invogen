export { TEMPLATE_CATEGORIES, defaultTemplateName } from '@/pages/super-admin/template-categories';

export const TEMPLATE_CATEGORY_ALL = 'All';

export function getTemplateCategoryOptions(categories: string[]): string[] {
  const unique = new Set(categories.filter(Boolean));
  return [TEMPLATE_CATEGORY_ALL, ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
}
