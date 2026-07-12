export const SUPER_ADMIN_TEMPLATE_CATEGORY = 'Super Admin';

/** Legacy select value — normalize to {@link SUPER_ADMIN_TEMPLATE_CATEGORY} when saving. */
export const LEGACY_SUPER_ADMIN_TEMPLATE_CATEGORY = '__super_admin__';

export function isSuperAdminTemplateCategory(category: string): boolean {
  const trimmed = category.trim();
  return (
    trimmed === SUPER_ADMIN_TEMPLATE_CATEGORY || trimmed === LEGACY_SUPER_ADMIN_TEMPLATE_CATEGORY
  );
}

export function formatTemplateCategoryLabel(category: string): string {
  return isSuperAdminTemplateCategory(category) ? SUPER_ADMIN_TEMPLATE_CATEGORY : category;
}

export const TEMPLATE_CATEGORIES = [
  'Retail', 'GST', 'Tax', 'Restaurant', 'Hotel', 'Medical', 'Clinic', 'Hospital',
  'Pharmacy', 'Jewellery', 'Automobile', 'Construction', 'Transport', 'Courier',
  'Wholesale', 'Manufacturing', 'Service', 'Freelancer', 'Consultant',
  'Interior Designer', 'Architect', 'Education', 'School', 'College', 'Gym', 'Salon',
  'Spa', 'Fashion Boutique', 'Electronics', 'Furniture', 'Export', 'Import',
  'Corporate', 'Agency', 'Real Estate', 'Printing', 'Food Industry', 'Agriculture',
  'Chemical Industry', 'Logistics', 'Travel Agency', 'Repair Service', 'Custom Blank',
] as const;

export function defaultTemplateName(category: string): string {
  const trimmed = category.trim();
  if (!trimmed) return '';
  return trimmed.toLowerCase().endsWith('invoice') ? trimmed : `${trimmed} Invoice`;
}
