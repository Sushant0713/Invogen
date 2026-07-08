import {
  groupPaletteItems,
  PALETTE_CATEGORY_LABELS,
  type PaletteItem,
} from '../palette-catalog';

export type AssetItem = PaletteItem & {
  tags?: string[];
  aliases?: string[];
};

/** Search metadata per palette id. */
export const ASSET_SEARCH_META: Record<string, { tags?: string[]; aliases?: string[] }> = {
  media_image: { tags: ['magic media', 'photo'], aliases: ['img'] },
  media_logo: { tags: ['magic media', 'brand'], aliases: [] },
  media_signature: { tags: ['magic media', 'sign'], aliases: [] },
  media_watermark: { tags: ['magic media', 'stamp', 'overlay'], aliases: ['draft', 'confidential'] },
  basic_divider: { tags: ['basic', 'line'], aliases: ['separator'] },
  basic_header: { tags: ['basic', 'title'], aliases: ['heading', 'h1'] },
  basic_text: { tags: ['basic'], aliases: ['paragraph'] },
  basic_table: { tags: ['basic', 'grid'], aliases: ['product table', 'items'] },
  shape_rectangle: { tags: ['shapes', 'box'], aliases: ['rect', 'square'] },
  shape_rounded: { tags: ['shapes', 'box'], aliases: ['rounded rectangle'] },
  shape_circle: { tags: ['shapes', 'round'], aliases: ['ellipse', 'oval'] },
  shape_triangle: { tags: ['shapes'], aliases: [] },
  shape_diamond: { tags: ['shapes'], aliases: ['rhombus'] },
  shape_star: { tags: ['shapes'], aliases: [] },
  shape_line: { tags: ['shapes', 'line'], aliases: ['divider line'] },
  shape_arrow: { tags: ['shapes', 'pointer'], aliases: ['arrow line'] },
  card_address: { tags: ['card', 'location'], aliases: [] },
  card_company: { tags: ['card', 'from'], aliases: [] },
  card_customer: { tags: ['card', 'bill to'], aliases: [] },
  card_payment: { tags: ['card', 'bank', 'payment'], aliases: ['payment details', 'bank details'] },
  field_gst: { tags: ['field', 'tax', 'gstin'], aliases: ['gst number', 'gstin'] },
  field_pan: { tags: ['field', 'tax'], aliases: ['pan card'] },
  field_invoice_no: { tags: ['field', 'invoice'], aliases: ['invoice number', 'inv'] },
  context_page_no: { tags: ['context', 'page'], aliases: ['page number'] },
  context_note: { tags: ['context'], aliases: ['notes'] },
  context_footer: { tags: ['context'], aliases: ['footer'] },
  context_term: { tags: ['context', 'legal'], aliases: ['terms', 'tnc'] },
};

export function enrichAssetItem(item: PaletteItem): AssetItem {
  const meta = ASSET_SEARCH_META[item.id] ?? ASSET_SEARCH_META[item.type] ?? {};
  return {
    ...item,
    tags: meta.tags,
    aliases: meta.aliases,
  };
}

export function enrichAssets(items: PaletteItem[]): AssetItem[] {
  return items.map(enrichAssetItem);
}

export function filterAssets(items: AssetItem[], query: string): AssetItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  return items.filter((item) => {
    const label = (item.label ?? item.name ?? item.type).toLowerCase();
    const category = (item.category ?? '').toLowerCase();
    const sectionLabel = (PALETTE_CATEGORY_LABELS[item.category] ?? '').toLowerCase();
    if (label.includes(q) || category.includes(q) || item.type.includes(q)) return true;
    if (sectionLabel.includes(q)) return true;
    if (item.tags?.some((t) => t.includes(q))) return true;
    if (item.aliases?.some((a) => a.includes(q))) return true;
    return false;
  });
}

export function groupAssetsByCategory(
  items: AssetItem[]
): { category: string; label: string; items: AssetItem[] }[] {
  return groupPaletteItems(items).map((g) => ({
    ...g,
    items: g.items as AssetItem[],
  }));
}
