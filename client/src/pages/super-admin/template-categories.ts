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
