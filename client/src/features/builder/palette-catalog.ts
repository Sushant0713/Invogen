import { ComponentType } from '@invogen/shared';
import { getCardDefaultProps } from './card-components';
import { getImageDefaultProps } from './image-components';
import { getShapeDefaultProps } from './shape-components';
import { getDefaultTermsProps } from './terms-content';
import { getDefaultAddressProps } from './address-content';
import {
  isTableElementType,
  normalizeProductTableProps,
  productTablePropsToRecord,
} from './product-table';
import {
  normalizeInvoiceTableProps,
  invoiceTablePropsToRecord,
} from './invoice-table';
import {
  normalizeInvoiceTable2Props,
  productTablePropsToRecord as invoice2PropsToRecord,
} from './invoice-table-2';
import {
  normalizeInvoiceTable3Props,
  productTablePropsToRecord as invoice3PropsToRecord,
} from './invoice-table-3';
import { normalizeTablePropsForType } from './table-props-normalize';
import { formatDisplayDate } from '@/lib/date-format';

export type PaletteItem = {
  /** Unique key for sidebar grid, favourites, and recent (supports duplicate types). */
  id: string;
  type: string;
  name?: string;
  label?: string;
  category: string;
  /** Optional icon override key — see asset-icons.ts */
  iconKey?: string;
  defaultProps?: Record<string, unknown>;
};

import {
  PALETTE_CATEGORY_ORDER,
  PALETTE_CATEGORY_LABELS,
  PALETTE_CATEGORY_ALIASES,
} from './palette-layout';

export { PALETTE_CATEGORY_ORDER, PALETTE_CATEGORY_LABELS, PALETTE_CATEGORY_ALIASES };

/**
 * Canonical sidebar assets — matches reference layout exactly.
 */
export const BUILDER_PALETTE: PaletteItem[] = [
  // Magic Media
  { id: 'media_image', type: ComponentType.IMAGE, label: 'Image', category: 'media', defaultProps: getImageDefaultProps(ComponentType.IMAGE) },
  { id: 'media_logo', type: ComponentType.LOGO, label: 'Logo', category: 'media', defaultProps: getImageDefaultProps(ComponentType.LOGO) },
  { id: 'media_signature', type: ComponentType.SIGNATURE, label: 'Signature', category: 'media', defaultProps: getImageDefaultProps(ComponentType.SIGNATURE) },
  {
    id: 'media_watermark',
    type: ComponentType.WATERMARK,
    label: 'Watermark',
    category: 'media',
    iconKey: 'media_watermark',
    defaultProps: {
      text: 'DRAFT',
      opacity: 15,
      fontSize: 64,
      fontWeight: 700,
      textAlign: 'center',
      color: '#9ca3af',
    },
  },

  // Basic
  { id: 'basic_divider', type: ComponentType.DIVIDER, label: 'Divider', category: 'basic', defaultProps: { color: '#000000', thickness: 1, rotation: 0 } },
  { id: 'basic_header', type: ComponentType.HEADING, label: 'Header', category: 'basic', defaultProps: { content: 'Heading', fontSize: 24, fontWeight: 700 } },
  { id: 'basic_text', type: ComponentType.TEXT, label: 'Text', category: 'basic', defaultProps: { content: 'Text content' } },
  {
    id: 'basic_invoice_table',
    type: ComponentType.INVOICE_TABLE,
    label: 'Invoice Table 1',
    category: 'basic',
    defaultProps: invoiceTablePropsToRecord(normalizeInvoiceTableProps()),
  },
  {
    id: 'basic_invoice_table_2',
    type: ComponentType.INVOICE_TABLE_2,
    label: 'Invoice Table 2',
    category: 'basic',
    iconKey: 'basic_invoice_table_2',
    defaultProps: invoice2PropsToRecord(normalizeInvoiceTable2Props()),
  },
  {
    id: 'basic_invoice_table_3',
    type: ComponentType.INVOICE_TABLE_3,
    label: 'Invoice Table 3',
    category: 'basic',
    iconKey: 'basic_invoice_table_3',
    defaultProps: invoice3PropsToRecord(normalizeInvoiceTable3Props()),
  },
  {
    id: 'basic_table',
    type: ComponentType.PRODUCT_TABLE,
    label: 'Table',
    category: 'basic',
    defaultProps: productTablePropsToRecord(normalizeProductTableProps()),
  },

  // Shapes
  {
    id: 'shape_rectangle',
    type: ComponentType.RECTANGLE,
    label: 'Rectangle',
    category: 'shapes',
    iconKey: 'shape_rectangle',
    defaultProps: getShapeDefaultProps(ComponentType.RECTANGLE),
  },
  {
    id: 'shape_rounded',
    type: ComponentType.ROUNDED_RECT,
    label: 'Rounded',
    category: 'shapes',
    iconKey: 'shape_rounded',
    defaultProps: getShapeDefaultProps(ComponentType.ROUNDED_RECT),
  },
  {
    id: 'shape_circle',
    type: ComponentType.CIRCLE,
    label: 'Circle',
    category: 'shapes',
    iconKey: 'shape_circle',
    defaultProps: getShapeDefaultProps(ComponentType.CIRCLE),
  },
  {
    id: 'shape_triangle',
    type: ComponentType.TRIANGLE,
    label: 'Triangle',
    category: 'shapes',
    iconKey: 'shape_triangle',
    defaultProps: getShapeDefaultProps(ComponentType.TRIANGLE),
  },
  {
    id: 'shape_diamond',
    type: ComponentType.DIAMOND,
    label: 'Diamond',
    category: 'shapes',
    iconKey: 'shape_diamond',
    defaultProps: getShapeDefaultProps(ComponentType.DIAMOND),
  },
  {
    id: 'shape_star',
    type: ComponentType.STAR,
    label: 'Star',
    category: 'shapes',
    iconKey: 'shape_star',
    defaultProps: getShapeDefaultProps(ComponentType.STAR),
  },
  {
    id: 'shape_line',
    type: ComponentType.LINE,
    label: 'Line',
    category: 'shapes',
    iconKey: 'shape_line',
    defaultProps: getShapeDefaultProps(ComponentType.LINE),
  },
  {
    id: 'shape_arrow',
    type: ComponentType.ARROW,
    label: 'Arrow',
    category: 'shapes',
    iconKey: 'shape_arrow',
    defaultProps: getShapeDefaultProps(ComponentType.ARROW),
  },

  // Card
  {
    id: 'card_address',
    type: ComponentType.ADDRESS,
    label: 'Address',
    category: 'cards',
    iconKey: 'card_address',
    defaultProps: getDefaultAddressProps(),
  },
  {
    id: 'card_company',
    type: ComponentType.COMPANY_CARD,
    label: 'Company',
    category: 'cards',
    iconKey: 'card_company',
    defaultProps: getCardDefaultProps(ComponentType.COMPANY_CARD),
  },
  {
    id: 'card_customer',
    type: ComponentType.CUSTOMER_CARD,
    label: 'Customer',
    category: 'cards',
    iconKey: 'card_customer',
    defaultProps: getCardDefaultProps(ComponentType.CUSTOMER_CARD),
  },
  {
    id: 'card_payment',
    type: ComponentType.PAYMENT_DETAILS,
    label: 'Payment',
    category: 'cards',
    iconKey: 'card_payment',
    defaultProps: getCardDefaultProps(ComponentType.PAYMENT_DETAILS),
  },

  // Field
  {
    id: 'field_gst',
    type: ComponentType.GST_NUMBER,
    label: 'GST',
    category: 'fields',
    iconKey: 'field_gst',
    defaultProps: { label: 'GSTIN', value: '27XXXXXXXXXX1Z1' },
  },
  {
    id: 'field_pan',
    type: ComponentType.PAN_NUMBER,
    label: 'Pan',
    category: 'fields',
    iconKey: 'field_pan',
    defaultProps: { label: 'PAN', value: 'XXXXX9999X' },
  },
  {
    id: 'field_invoice_no',
    type: ComponentType.INVOICE_NUMBER,
    label: 'Invoice no',
    category: 'fields',
    iconKey: 'field_invoice',
    defaultProps: { label: 'Invoice', value: 'INV-001' },
  },
  {
    id: 'field_date',
    type: ComponentType.DATE,
    label: 'Date',
    category: 'fields',
    iconKey: 'field_date',
    defaultProps: {
      label: 'Date',
      value: formatDisplayDate(),
      useLiveDate: true,
    },
  },
  {
    id: 'field_due_date',
    type: ComponentType.DUE_DATE,
    label: 'Due date',
    category: 'fields',
    iconKey: 'field_due_date',
    defaultProps: {
      label: 'Due Date',
      value: '-',
      useLiveDate: false,
    },
  },

  // Context
  { id: 'context_page_no', type: ComponentType.PAGE_NUMBER, label: 'Page no', category: 'context', defaultProps: { label: 'Page', value: '1' } },
  { id: 'context_note', type: ComponentType.NOTES, label: 'Note', category: 'context', defaultProps: { content: 'Notes...' } },
  { id: 'context_footer', type: ComponentType.FOOTER, label: 'Footer text', category: 'context', defaultProps: { content: 'Thank you' } },
  { id: 'context_term', type: ComponentType.TERMS, label: 'Terms & Conditions', category: 'context', defaultProps: getDefaultTermsProps() },
];

const paletteById = new Map(BUILDER_PALETTE.map((item) => [item.id, item]));
const paletteByType = new Map(BUILDER_PALETTE.map((item) => [item.type, item]));
const paletteOrder = new Map(BUILDER_PALETTE.map((item, index) => [item.id, index]));

export function getPaletteItemId(item: Pick<PaletteItem, 'id' | 'type'>): string {
  return item.id ?? item.type;
}

export function normalizePaletteCategory(category: string): string {
  return PALETTE_CATEGORY_ALIASES[category] ?? category;
}

/** Keep canonical sidebar list; merge defaultProps from API when types match. */
export function mergePaletteWithApi(
  apiComponents: Array<Record<string, unknown>> | undefined
): PaletteItem[] {
  if (!apiComponents?.length) return BUILDER_PALETTE;

  const apiByType = new Map<string, Record<string, unknown>>();
  for (const api of apiComponents) {
    const type = String(api.type ?? '');
    if (type) apiByType.set(type, api);
  }

  return BUILDER_PALETTE.map((item) => {
    const api = apiByType.get(item.type);
    if (!api) return item;
    const apiProps = (api.defaultProps ?? {}) as Record<string, unknown>;
    return {
      ...item,
      defaultProps: { ...item.defaultProps, ...apiProps },
    };
  });
}

export function groupPaletteItems(items: PaletteItem[]): { category: string; label: string; items: PaletteItem[] }[] {
  const groups = new Map<string, PaletteItem[]>();
  for (const item of items) {
    const cat = normalizePaletteCategory(item.category || 'basic');
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push({ ...item, category: cat });
  }

  const sortByPaletteOrder = (a: PaletteItem, b: PaletteItem) =>
    (paletteOrder.get(a.id) ?? 0) - (paletteOrder.get(b.id) ?? 0);

  const ordered: { category: string; label: string; items: PaletteItem[] }[] = [];
  for (const cat of PALETTE_CATEGORY_ORDER) {
    const catItems = groups.get(cat);
    if (catItems?.length) {
      ordered.push({
        category: cat,
        label: PALETTE_CATEGORY_LABELS[cat] ?? cat,
        items: [...catItems].sort(sortByPaletteOrder),
      });
      groups.delete(cat);
    }
  }
  for (const [cat, catItems] of groups) {
    ordered.push({
      category: cat,
      label: PALETTE_CATEGORY_LABELS[cat] ?? cat,
      items: [...catItems].sort(sortByPaletteOrder),
    });
  }
  return ordered;
}

export function normalizePaletteDragProps(
  type: string,
  defaultProps: Record<string, unknown> = {}
): Record<string, unknown> {
  if (!isTableElementType(type)) return defaultProps;
  return productTablePropsToRecord(normalizeTablePropsForType(type, defaultProps));
}

export function getPaletteItem(type: string): PaletteItem | undefined {
  return paletteByType.get(type);
}

export function getPaletteItemById(id: string): PaletteItem | undefined {
  return paletteById.get(id);
}
