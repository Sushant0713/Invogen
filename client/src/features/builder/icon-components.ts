import { ComponentType } from '@invogen/shared';
import type { CanvasElement } from '@invogen/shared';

export type IconCatalogEntry = {
  id: string;
  label: string;
  iconKey: string;
  /** Accent for the soft tile background / glyph. */
  accent: string;
  accentSoft: string;
};

/** Polished icon set for the asset library (dual-tone tiles, not plain strokes). */
export const BUILDER_ICON_CATALOG: IconCatalogEntry[] = [
  {
    id: 'icon_phone',
    label: 'Phone',
    iconKey: 'phone',
    accent: '#0F766E',
    accentSoft: '#CCFBF1',
  },
  {
    id: 'icon_mobile',
    label: 'Mobile',
    iconKey: 'mobile',
    accent: '#0369A1',
    accentSoft: '#E0F2FE',
  },
  {
    id: 'icon_email',
    label: 'Email',
    iconKey: 'email',
    accent: '#C2410C',
    accentSoft: '#FFEDD5',
  },
  {
    id: 'icon_at',
    label: 'At / handle',
    iconKey: 'at',
    accent: '#7C3AED',
    accentSoft: '#EDE9FE',
  },
  {
    id: 'icon_address',
    label: 'Address',
    iconKey: 'address',
    accent: '#B45309',
    accentSoft: '#FEF3C7',
  },
  {
    id: 'icon_person',
    label: 'Person',
    iconKey: 'person',
    accent: '#1D4ED8',
    accentSoft: '#DBEAFE',
  },
  {
    id: 'icon_building',
    label: 'Company',
    iconKey: 'building',
    accent: '#334155',
    accentSoft: '#E2E8F0',
  },
  {
    id: 'icon_bank',
    label: 'Bank',
    iconKey: 'bank',
    accent: '#0F766E',
    accentSoft: '#D1FAE5',
  },
  {
    id: 'icon_card',
    label: 'Card',
    iconKey: 'card',
    accent: '#BE185D',
    accentSoft: '#FCE7F3',
  },
  {
    id: 'icon_wallet',
    label: 'Wallet',
    iconKey: 'wallet',
    accent: '#047857',
    accentSoft: '#D1FAE5',
  },
  {
    id: 'icon_gst',
    label: 'GST',
    iconKey: 'gst',
    accent: '#B45309',
    accentSoft: '#FEF3C7',
  },
  {
    id: 'icon_pan',
    label: 'ID / PAN',
    iconKey: 'pan',
    accent: '#4338CA',
    accentSoft: '#E0E7FF',
  },
  {
    id: 'icon_calendar',
    label: 'Date',
    iconKey: 'calendar',
    accent: '#C2410C',
    accentSoft: '#FFEDD5',
  },
  {
    id: 'icon_globe',
    label: 'Website',
    iconKey: 'globe',
    accent: '#0369A1',
    accentSoft: '#E0F2FE',
  },
  {
    id: 'icon_upi',
    label: 'UPI / QR',
    iconKey: 'upi',
    accent: '#6D28D9',
    accentSoft: '#EDE9FE',
  },
  {
    id: 'icon_verified',
    label: 'Verified',
    iconKey: 'verified',
    accent: '#15803D',
    accentSoft: '#DCFCE7',
  },
];

const catalogByKey = new Map(BUILDER_ICON_CATALOG.map((entry) => [entry.iconKey, entry]));

export function getIconCatalogEntry(iconKey: string | undefined | null): IconCatalogEntry | null {
  if (!iconKey) return null;
  return catalogByKey.get(iconKey) ?? null;
}

export function isIconComponentType(type: string): boolean {
  return type === ComponentType.ICON;
}

/** Glyph key (see LibraryIconTile) for a given card field line. */
export function resolveCardLineGlyphKey(type: string, fieldKey: string): string {
  if (type === ComponentType.COMPANY_CARD && fieldKey === 'name') return 'building';
  const map: Record<string, string> = {
    name: 'person',
    address: 'address',
    gst: 'gst',
    pan: 'pan',
    email: 'email',
    phone: 'phone',
    bankName: 'bank',
    accountName: 'person',
    accountNumber: 'card',
    ifsc: 'bank',
    upi: 'upi',
  };
  return map[fieldKey] ?? 'verified';
}

/** True when a card field key supports a leading icon (title/section headers don't). */
export function cardFieldSupportsIcon(fieldKey: string): boolean {
  return fieldKey !== 'title';
}

/** Best-guess glyph key for a standalone FIELD from its label / data binding. */
export function inferFieldGlyphKey(props: Record<string, unknown>): string {
  if (typeof props.iconKey === 'string' && getIconCatalogEntry(props.iconKey)) {
    return props.iconKey;
  }
  const dataKey = typeof props.dataKey === 'string' ? props.dataKey.toLowerCase() : '';
  const label = typeof props.label === 'string' ? props.label.toLowerCase() : '';
  // Prefer dataKey (more specific) over label — avoids every Company* field becoming "building".
  const hay = `${dataKey} ${label}`;
  const rules: Array<[RegExp, string]> = [
    [/gst/, 'gst'],
    [/pan/, 'pan'],
    [/ifsc|swift/, 'bank'],
    [/accountnumber|account.?number|acc(?:ount)?(?:\s*no)?/, 'card'],
    [/bankname|bank.?name/, 'bank'],
    [/accountname|account.?name/, 'person'],
    [/upi|qr/, 'upi'],
    [/wallet/, 'wallet'],
    [/e-?mail/, 'email'],
    [/mobile|cell/, 'mobile'],
    [/phone|tel/, 'phone'],
    [/address|street|city/, 'address'],
    [/web|site|url|www/, 'globe'],
    [/date|due|calendar/, 'calendar'],
    [/companyname|company.?name|firm|org/, 'building'],
    [/clientname|customer.?name|person|contact/, 'person'],
    [/title/, 'verified'],
  ];
  for (const [re, key] of rules) {
    if (re.test(hay)) return key;
  }
  return 'verified';
}

export function getIconDefaultProps(iconKey: string): Record<string, unknown> {
  const entry = getIconCatalogEntry(iconKey) ?? BUILDER_ICON_CATALOG[0];
  return {
    iconKey: entry.iconKey,
    accent: entry.accent,
    accentSoft: entry.accentSoft,
    variant: 'soft',
    // Attachment (set when dropped onto / linked with a host component)
    attachedToId: null,
    attachRelX: 0,
    attachRelY: 0,
    attachRelW: 1,
    attachRelH: 1,
  };
}

export function getAttachedToId(props: Record<string, unknown>): string | null {
  const id = props.attachedToId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export function isIconAttached(element: CanvasElement): boolean {
  return isIconComponentType(element.type) && !!getAttachedToId((element.props ?? {}) as Record<string, unknown>);
}

/** Capture relative placement of an icon inside a host element. */
export function captureIconAttachment(
  host: CanvasElement,
  icon: Pick<CanvasElement, 'x' | 'y' | 'width' | 'height'>
): Record<string, unknown> {
  const w = Math.max(host.width, 1);
  const h = Math.max(host.height, 1);
  return {
    attachedToId: host.id,
    attachRelX: (icon.x - host.x) / w,
    attachRelY: (icon.y - host.y) / h,
    attachRelW: icon.width / w,
    attachRelH: icon.height / h,
  };
}

/** Place icon from stored relative ratios on a host. */
export function layoutIconOnHost(
  host: CanvasElement,
  icon: CanvasElement
): CanvasElement {
  const props = (icon.props ?? {}) as Record<string, unknown>;
  if (getAttachedToId(props) !== host.id) return icon;

  const relX = typeof props.attachRelX === 'number' ? props.attachRelX : 0;
  const relY = typeof props.attachRelY === 'number' ? props.attachRelY : 0;
  const relW = typeof props.attachRelW === 'number' ? props.attachRelW : 0.2;
  const relH = typeof props.attachRelH === 'number' ? props.attachRelH : 0.8;

  const width = Math.max(16, host.width * relW);
  const height = Math.max(16, host.height * relH);
  return {
    ...icon,
    x: host.x + host.width * relX,
    y: host.y + host.height * relY,
    width,
    height,
  };
}

/** Default nest: icon sits on the left inside the host, vertically centered. */
export function nestIconInsideHost(
  host: CanvasElement,
  iconSize?: number
): { x: number; y: number; width: number; height: number } {
  const size = Math.max(
    18,
    Math.min(iconSize ?? Math.round(Math.min(host.height * 0.78, host.width * 0.28)), 56)
  );
  const pad = Math.max(4, Math.round(size * 0.12));
  return {
    x: host.x + pad,
    y: host.y + (host.height - size) / 2,
    width: size,
    height: size,
  };
}

export function findAttachHostAtPoint(
  elements: CanvasElement[],
  x: number,
  y: number,
  excludeId?: string
): CanvasElement | null {
  const hits = [...elements]
    .filter((el) => {
      if (el.visible === false) return false;
      if (el.id === excludeId) return false;
      if (isIconComponentType(el.type)) return false;
      return (
        x >= el.x
        && x <= el.x + el.width
        && y >= el.y
        && y <= el.y + el.height
      );
    })
    .sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
  return hits[0] ?? null;
}

/** After a host moves/resizes, return updated attached icons. */
export function syncIconsAttachedToHost(
  elements: CanvasElement[],
  host: CanvasElement
): CanvasElement[] {
  return elements.map((el) => {
    if (!isIconComponentType(el.type)) return el;
    const props = (el.props ?? {}) as Record<string, unknown>;
    if (getAttachedToId(props) !== host.id) return el;
    return layoutIconOnHost(host, el);
  });
}

/** Icons currently attached to any of the given host ids. */
export function collectAttachedIconIds(
  pages: { elements: CanvasElement[] }[],
  hostIds: Iterable<string>
): string[] {
  const hosts = new Set(hostIds);
  const ids: string[] = [];
  for (const page of pages) {
    for (const el of page.elements) {
      if (!isIconComponentType(el.type)) continue;
      const attached = getAttachedToId((el.props ?? {}) as Record<string, unknown>);
      if (attached && hosts.has(attached)) ids.push(el.id);
    }
  }
  return ids;
}
