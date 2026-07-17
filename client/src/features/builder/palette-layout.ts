/** Sidebar section order — kept separate so prefs/store don't load the full palette catalog. */
export const PALETTE_CATEGORY_ORDER = [
  'media',
  'basic',
  'shapes',
  'cards',
  'fields',
  'fields_company',
  'fields_customer',
  'fields_payment',
  'context',
] as const;

export const PALETTE_CATEGORY_LABELS: Record<string, string> = {
  media: 'Magic Media',
  basic: 'Basic',
  shapes: 'Shapes',
  cards: 'Card',
  fields: 'Field',
  fields_company: 'Company fields',
  fields_customer: 'Customer fields',
  fields_payment: 'Payment fields',
  context: 'Context',
};

export const PALETTE_CATEGORY_ALIASES: Record<string, string> = {
  business: 'cards',
  finance: 'fields',
  content: 'context',
  data: 'basic',
  tables: 'basic',
};
