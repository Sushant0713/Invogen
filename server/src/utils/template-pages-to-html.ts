import { ComponentType, type CanvasElement, type TemplatePage } from '@invogen/shared';

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const PLACEHOLDER_SRC_RE = /^\{\{[\w.]+\}\}$/;
const PLACEHOLDER_TOKEN_RE = /^\{\{\w+\}\}$/;

type Branding = { logo?: string; signature?: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cssInline(style: Record<string, string | number | undefined>): string {
  return Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => {
      const prop = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      return `${prop}:${value}`;
    })
    .join(';');
}

function resolveAssetUrl(src: string | undefined, assetBase: string): string | undefined {
  if (!src?.trim()) return undefined;
  const trimmed = src.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) return `${assetBase}${trimmed}`;
  return trimmed;
}

function sortByLayer(elements: CanvasElement[]): CanvasElement[] {
  return [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

function getPageSize(page: TemplatePage): { width: number; height: number } {
  return {
    width: page.pageSize?.width ?? PAGE_WIDTH,
    height: page.pageSize?.height ?? PAGE_HEIGHT,
  };
}

function textStyleProps(props: Record<string, unknown>, type?: string): Record<string, string | number> {
  const fontSize = (props.fontSize as number) || (type === ComponentType.HEADING ? 24 : 14);
  const fontWeight = (props.fontWeight as number) || 400;
  const decorations: string[] = [];
  if (props.underline) decorations.push('underline');
  if (props.strikethrough) decorations.push('line-through');
  const family = typeof props.fontFamily === 'string' ? props.fontFamily.split(',')[0].trim() : '';
  return {
    fontFamily: family ? `"${family}", Arial, sans-serif` : 'Arial, sans-serif',
    fontSize: `${fontSize}px`,
    fontWeight,
    fontStyle: props.italic ? 'italic' : 'normal',
    color: (props.color as string) || '#000000',
    textAlign: (props.textAlign as string) || 'left',
    textTransform: (props.textTransform as string) || 'none',
    textDecoration: decorations.length ? decorations.join(' ') : 'none',
    lineHeight: typeof props.lineHeight === 'number' && props.lineHeight > 4 ? `${props.lineHeight}px` : '1.45',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    width: '100%',
    height: '100%',
  };
}

function getDataFieldValue(props: Record<string, unknown>, type: string): string {
  if (typeof props.value === 'string') return props.value;
  return '';
}

function getDisplayText(props: Record<string, unknown>, type: string): string {
  if (type === ComponentType.INVOICE_NUMBER || type === ComponentType.DATE || type === ComponentType.DUE_DATE
    || type === ComponentType.GST_NUMBER || type === ComponentType.PAN_NUMBER) {
    const label = typeof props.label === 'string' ? props.label : '';
    const value = getDataFieldValue(props, type);
    if (label && value) return `${label}: ${value}`;
    return value || label;
  }
  if (typeof props.text === 'string') return props.text;
  if (typeof props.content === 'string') return props.content;
  return '';
}

function isUnresolvedCardPlaceholder(value: string): boolean {
  return PLACEHOLDER_TOKEN_RE.test(value.trim());
}

function getCardFieldValue(props: Record<string, unknown>, key: string, placeholder: string): string {
  const raw = props[key];
  if (typeof raw === 'string') {
    if (isUnresolvedCardPlaceholder(raw)) return placeholder;
    return raw;
  }
  return placeholder;
}

const COMPANY_CARD_FIELDS = [
  { key: 'title', placeholder: 'From', multiline: false, prefix: '' },
  { key: 'name', placeholder: 'Company Name', multiline: false, prefix: '' },
  { key: 'address', placeholder: '', multiline: true, prefix: '' },
  { key: 'gst', placeholder: '', multiline: false, prefix: 'GST: ' },
  { key: 'pan', placeholder: '', multiline: false, prefix: 'PAN: ' },
  { key: 'email', placeholder: '', multiline: false, prefix: '' },
  { key: 'phone', placeholder: '', multiline: false, prefix: '' },
];

const CUSTOMER_CARD_FIELDS = [
  { key: 'title', placeholder: 'Bill To', multiline: false, prefix: '' },
  { key: 'name', placeholder: 'Customer Name', multiline: false, prefix: '' },
  { key: 'address', placeholder: '', multiline: true, prefix: '' },
  { key: 'gst', placeholder: '', multiline: false, prefix: 'GST: ' },
  { key: 'pan', placeholder: '', multiline: false, prefix: 'PAN: ' },
  { key: 'email', placeholder: '', multiline: false, prefix: '' },
  { key: 'phone', placeholder: '', multiline: false, prefix: '' },
];

const PAYMENT_FIELDS = [
  { key: 'title', placeholder: 'Payment Details', multiline: false, prefix: '' },
  { key: 'bankName', placeholder: '', multiline: false, prefix: '' },
  { key: 'accountName', placeholder: '', multiline: false, prefix: '' },
  { key: 'accountNumber', placeholder: '', multiline: false, prefix: '' },
  { key: 'ifsc', placeholder: '', multiline: false, prefix: '' },
  { key: 'branch', placeholder: '', multiline: false, prefix: '' },
  { key: 'upi', placeholder: '', multiline: false, prefix: '' },
];

function getCardFields(type: string) {
  if (type === ComponentType.COMPANY_CARD) return COMPANY_CARD_FIELDS;
  if (type === ComponentType.CUSTOMER_CARD) return CUSTOMER_CARD_FIELDS;
  if (type === ComponentType.PAYMENT_DETAILS) return PAYMENT_FIELDS;
  return [];
}

function renderCard(type: string, props: Record<string, unknown>): string {
  const style = textStyleProps(props, type);
  const hidden = new Set(
    Array.isArray(props.hiddenFields)
      ? props.hiddenFields.filter((item): item is string => typeof item === 'string')
      : []
  );
  const lines: string[] = [];

  for (const field of getCardFields(type)) {
    if (hidden.has(field.key)) continue;
    const value = getCardFieldValue(props, field.key, field.placeholder);
    if (!value.trim()) continue;
    if (field.multiline) {
      for (const line of value.split('\n')) {
        if (line.trim()) lines.push(`<div>${escapeHtml(line)}</div>`);
      }
      continue;
    }
    const text = field.prefix ? `${field.prefix}${value}` : value;
    const bold = field.key === 'title' ? 'font-weight:700;' : '';
    lines.push(`<div style="${bold}">${escapeHtml(text)}</div>`);
  }

  return `<div style="${cssInline(style)}">${lines.join('')}</div>`;
}

function renderTerms(props: Record<string, unknown>): string {
  const style = textStyleProps(props, ComponentType.TERMS);
  const title = typeof props.termsTitle === 'string' ? props.termsTitle : '';
  const items = Array.isArray(props.termsItems)
    ? props.termsItems.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0
      )
    : typeof props.content === 'string'
      ? props.content.split('\n').map((line) => line.trim()).filter(Boolean)
      : [];

  const titleHtml = title.trim()
    ? `<div style="font-weight:600;margin-bottom:0.45em;">${escapeHtml(title)}</div>`
    : '';
  const listHtml = items.length
    ? `<ul style="margin:0;padding:0;list-style:none;">${items
        .map(
          (text, index) =>
            `<li style="display:grid;grid-template-columns:2em 1fr;margin-bottom:0.2em;"><span style="text-align:right;padding-right:0.25em;">${index + 1}.</span><span>${escapeHtml(text)}</span></li>`
        )
        .join('')}</ul>`
    : '';

  return `<div style="${cssInline(style)}">${titleHtml}${listHtml}</div>`;
}

function renderTable(props: Record<string, unknown>): string {
  const columns = Array.isArray(props.columns)
    ? (props.columns as Array<{ id?: string; label?: string; visible?: boolean; widthPx?: number }>)
    : [];
  const rows = Array.isArray(props.rows)
    ? (props.rows as Array<{ cells?: Record<string, string>; heightPx?: number }>)
    : [];
  const visibleColumns = columns.filter((col) => col.visible !== false && col.id);
  if (!visibleColumns.length) return '';

  const tableColor = typeof props.tableColor === 'string' ? props.tableColor : '#111827';
  const borderWidth = typeof props.borderWidth === 'number' ? props.borderWidth : 1;
  const showHeader = props.showHeader !== false;
  const headerHeight = typeof props.headerHeightPx === 'number' ? props.headerHeightPx : 32;
  const headerBackground =
    typeof props.headerBackground === 'string' && props.headerBackground.trim()
      ? props.headerBackground
      : typeof props.headerBg === 'string' && props.headerBg.trim()
        ? props.headerBg
        : 'rgba(17,24,39,0.08)';

  const totalWidth = visibleColumns.reduce(
    (sum, col) => sum + (typeof col.widthPx === 'number' && col.widthPx > 0 ? col.widthPx : 80),
    0
  );

  const headerHtml = showHeader
    ? `<thead><tr>${visibleColumns
        .map((col) => {
          const width = typeof col.widthPx === 'number' && col.widthPx > 0 ? col.widthPx : 80;
          return `<th style="border:${borderWidth}px solid ${tableColor};padding:4px 6px;height:${headerHeight}px;width:${width}px;max-width:${width}px;background:${headerBackground};text-align:left;font-weight:600;overflow:hidden;">${escapeHtml(col.label || '')}</th>`;
        })
        .join('')}</tr></thead>`
    : '';

  const bodyHtml = rows
    .map((row) => {
      const cells = row.cells || {};
      const height = typeof row.heightPx === 'number' ? row.heightPx : 32;
      return `<tr>${visibleColumns
        .map((col) => {
          const width = typeof col.widthPx === 'number' && col.widthPx > 0 ? col.widthPx : 80;
          return `<td style="border:${borderWidth}px solid ${tableColor};padding:4px 6px;height:${height}px;width:${width}px;max-width:${width}px;vertical-align:top;overflow:hidden;">${escapeHtml(cells[col.id!] || '')}</td>`;
        })
        .join('')}</tr>`;
    })
    .join('');

  return `<table style="width:${totalWidth}px;max-width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px;color:#111827;">${headerHtml}<tbody>${bodyHtml}</tbody></table>`;
}

function isFullClipPolygon(points: { x: number; y: number }[]): boolean {
  if (points.length !== 4) return false;
  const expected = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  return points.every(
    (p, i) => Math.abs(p.x - expected[i].x) <= 0.008 && Math.abs(p.y - expected[i].y) <= 0.008
  );
}

function parseClipPolygonPoints(props: Record<string, unknown>): { x: number; y: number }[] | null {
  if (props.clipMode !== 'polygon') return null;
  const raw = props.clipPolygon;
  if (!Array.isArray(raw) || raw.length < 6) return null;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const x = raw[i];
    const y = raw[i + 1];
    if (typeof x !== 'number' || typeof y !== 'number') continue;
    points.push({
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    });
  }
  if (points.length < 3 || isFullClipPolygon(points)) return null;
  return points;
}

/** Match client `shapeClipPath` so PDF keeps diagonal / polygon shape crops. */
function shapeClipCssFromProps(props: Record<string, unknown>): string {
  const poly = parseClipPolygonPoints(props);
  if (poly) {
    const pts = poly.map((p) => `${p.x * 100}% ${p.y * 100}%`).join(', ');
    const path = `polygon(${pts})`;
    return `clip-path:${path};-webkit-clip-path:${path};`;
  }

  if (props.clipMode === 'polygon') return '';

  const x = typeof props.clipX === 'number' ? props.clipX : 0;
  const y = typeof props.clipY === 'number' ? props.clipY : 0;
  const width = typeof props.clipW === 'number' ? props.clipW : 1;
  const height = typeof props.clipH === 'number' ? props.clipH : 1;
  if (x <= 0.008 && y <= 0.008 && width >= 0.992 && height >= 0.992) return '';

  const top = y * 100;
  const right = (1 - x - width) * 100;
  const bottom = (1 - y - height) * 100;
  const left = x * 100;
  const path = `inset(${top}% ${right}% ${bottom}% ${left}%)`;
  return `clip-path:${path};-webkit-clip-path:${path};`;
}

/**
 * Render a filled rectangle (or rounded rect) as an SVG polygon when cropped.
 * SVG paths survive Chromium PDF more reliably than CSS clip-path alone.
 */
function renderCroppedRectSvg(
  props: Record<string, unknown>,
  fill: string,
  stroke: string,
  strokeWidth: number
): string | null {
  const poly = parseClipPolygonPoints(props);
  if (!poly) return null;
  const points = poly.map((p) => `${p.x * 100},${p.y * 100}`).join(' ');
  const strokeAttr =
    strokeWidth > 0
      ? ` stroke="${escapeHtml(stroke)}" stroke-width="${strokeWidth}" stroke-linejoin="round"`
      : '';
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;display:block;overflow:visible;"><polygon points="${points}" fill="${escapeHtml(fill)}"${strokeAttr} /></svg>`;
}

function renderShape(type: string, props: Record<string, unknown>): string {
  const fill = typeof props.fill === 'string' ? props.fill : 'transparent';
  const stroke = typeof props.stroke === 'string' ? props.stroke : '#111827';
  const strokeWidth = typeof props.strokeWidth === 'number' ? props.strokeWidth : 2;
  const cornerRadius =
    typeof props.cornerRadius === 'number'
      ? props.cornerRadius
      : typeof props.borderRadius === 'number'
        ? props.borderRadius
        : 0;
  const base = 'width:100%;height:100%;box-sizing:border-box;';
  const cropClip = shapeClipCssFromProps(props);

  // Polygon-cropped rectangles → SVG (INVOICE banner diagonal cuts, etc.)
  if (
    type === ComponentType.RECTANGLE
    || type === ComponentType.ROUNDED_RECT
    || type === 'rectangle'
    || type === 'rounded_rect'
  ) {
    const svg = renderCroppedRectSvg(props, fill, stroke, strokeWidth);
    if (svg) return svg;
  }

  let inner = '';
  switch (type) {
    case ComponentType.CIRCLE:
      inner = `<div style="${base}border-radius:50%;background:${fill};border:${strokeWidth}px solid ${stroke};"></div>`;
      break;
    case ComponentType.LINE:
      inner = `<div style="display:flex;align-items:center;width:100%;height:100%;"><div style="width:100%;height:${strokeWidth}px;background:${stroke};"></div></div>`;
      break;
    case ComponentType.TRIANGLE:
      inner = `<div style="${base}background:${fill};clip-path:polygon(50% 0%,0% 100%,100% 100%);-webkit-clip-path:polygon(50% 0%,0% 100%,100% 100%);"></div>`;
      break;
    case ComponentType.DIAMOND:
      inner = `<div style="${base}background:${fill};clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);-webkit-clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);border:${strokeWidth}px solid ${stroke};"></div>`;
      break;
    case ComponentType.ARROW:
      inner = `<svg viewBox="0 0 100 24" preserveAspectRatio="none" style="width:100%;height:100%;"><line x1="4" y1="12" x2="76" y2="12" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"/><polygon points="76,4 96,12 76,20" fill="${stroke}"/></svg>`;
      break;
    case ComponentType.ROUNDED_RECT:
      inner = `<div style="${base}background:${fill};border:${strokeWidth}px solid ${stroke};border-radius:${cornerRadius}px;"></div>`;
      break;
    default:
      inner = `<div style="${base}background:${fill};border:${strokeWidth}px solid ${stroke};border-radius:${cornerRadius}px;"></div>`;
      break;
  }

  if (!cropClip) return inner;
  return `<div style="width:100%;height:100%;overflow:hidden;${cropClip}">${inner}</div>`;
}

function resolveImageSrc(
  type: string,
  props: Record<string, unknown>,
  branding: Branding,
  assetBase: string
): string | undefined {
  const src = typeof props.src === 'string' ? props.src : '';
  const isBranding = type === ComponentType.LOGO || type === ComponentType.SIGNATURE;
  if (isBranding && (!src.trim() || PLACEHOLDER_SRC_RE.test(src.trim()))) {
    const key = type === ComponentType.LOGO ? branding.logo : branding.signature;
    return resolveAssetUrl(key, assetBase);
  }
  return resolveAssetUrl(src, assetBase);
}

function normalizeCssOpacity(raw: unknown, fallback = 1): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  if (raw <= 0) return 0;
  // Slider stores 0–100; legacy / CSS uses 0–1.
  const normalized = raw > 1 ? raw / 100 : raw;
  return Math.min(1, Math.max(0, normalized));
}

function normalizeCropTransform(raw: unknown): {
  rect: { x: number; y: number; width: number; height: number };
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
} {
  if (!raw || typeof raw !== 'object') {
    return { rect: { x: 0, y: 0, width: 1, height: 1 }, offsetX: 0, offsetY: 0, scale: 1, rotation: 0 };
  }
  const o = raw as Record<string, unknown>;
  const rectRaw = o.rect && typeof o.rect === 'object' ? (o.rect as Record<string, unknown>) : {};
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  const x = typeof rectRaw.x === 'number' ? clamp01(rectRaw.x) : 0;
  const y = typeof rectRaw.y === 'number' ? clamp01(rectRaw.y) : 0;
  const width = typeof rectRaw.width === 'number' ? Math.min(1 - x, Math.max(0.01, rectRaw.width)) : 1;
  const height = typeof rectRaw.height === 'number' ? Math.min(1 - y, Math.max(0.01, rectRaw.height)) : 1;
  return {
    rect: { x, y, width, height },
    offsetX: typeof o.offsetX === 'number' ? o.offsetX : 0,
    offsetY: typeof o.offsetY === 'number' ? o.offsetY : 0,
    scale: typeof o.scale === 'number' && o.scale > 0 ? o.scale : 1,
    rotation: typeof o.rotation === 'number' ? o.rotation : 0,
  };
}

function getFitBaseSize(
  frameW: number,
  frameH: number,
  naturalW: number,
  naturalH: number,
  objectFit: string
): { width: number; height: number } {
  if (frameW <= 0 || frameH <= 0 || naturalW <= 0 || naturalH <= 0) {
    return { width: frameW, height: frameH };
  }
  if (objectFit === 'fill') return { width: frameW, height: frameH };
  const scale =
    objectFit === 'cover'
      ? Math.max(frameW / naturalW, frameH / naturalH)
      : Math.min(frameW / naturalW, frameH / naturalH);
  return { width: naturalW * scale, height: naturalH * scale };
}

function buildImageFilter(props: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  const brightness = typeof props.brightness === 'number' ? props.brightness : 100;
  const contrast = typeof props.contrast === 'number' ? props.contrast : 100;
  const saturate = typeof props.saturate === 'number' ? props.saturate : 100;
  const blur = typeof props.blur === 'number' ? props.blur : 0;
  if (brightness !== 100) parts.push(`brightness(${brightness}%)`);
  if (contrast !== 100) parts.push(`contrast(${contrast}%)`);
  if (saturate !== 100) parts.push(`saturate(${saturate}%)`);
  if (blur > 0) parts.push(`blur(${blur}px)`);
  if (props.shadowEnabled) {
    const sx = typeof props.shadowX === 'number' ? props.shadowX : 4;
    const sy = typeof props.shadowY === 'number' ? props.shadowY : 4;
    const sb = typeof props.shadowBlur === 'number' ? props.shadowBlur : 8;
    const sc = typeof props.shadowColor === 'string' ? props.shadowColor : '#00000040';
    parts.push(`drop-shadow(${sx}px ${sy}px ${sb}px ${sc})`);
  }
  return parts.length ? parts.join(' ') : undefined;
}

function renderImage(
  type: string,
  props: Record<string, unknown>,
  branding: Branding,
  assetBase: string,
  frameW: number,
  frameH: number
): string {
  const src = resolveImageSrc(type, props, branding, assetBase);
  if (!src || PLACEHOLDER_SRC_RE.test(src.trim())) return '';

  const fit = props.objectFit === 'cover' || props.objectFit === 'fill' ? props.objectFit : 'contain';
  const borderRadius = typeof props.borderRadius === 'number' ? props.borderRadius : 0;
  const naturalW = typeof props.imageNaturalW === 'number' ? props.imageNaturalW : 0;
  const naturalH = typeof props.imageNaturalH === 'number' ? props.imageNaturalH : 0;
  const crop = normalizeCropTransform(props.imageCrop);
  const base = getFitBaseSize(frameW, frameH, naturalW, naturalH, fit);
  const displayW = base.width * crop.scale;
  const displayH = base.height * crop.scale;
  const rectX = crop.rect.x * frameW;
  const rectY = crop.rect.y * frameH;
  const rectW = crop.rect.width * frameW;
  const rectH = crop.rect.height * frameH;
  const flipX = !!props.flipX;
  const flipY = !!props.flipY;
  const flip =
    flipX && flipY ? ' scale(-1,-1)' : flipX ? ' scaleX(-1)' : flipY ? ' scaleY(-1)' : '';
  const imgTransform = `rotate(${crop.rotation}deg)${flip}`;
  const filter = buildImageFilter(props);
  const onError =
    "this.style.display='none';this.parentElement&&(this.parentElement.style.display='none');";

  // Match CroppedImageDisplay: crop window + positioned/scaled image inside.
  return `<div style="position:relative;width:100%;height:100%;overflow:hidden;border-radius:${borderRadius}px;">
    <div style="position:absolute;left:${rectX}px;top:${rectY}px;width:${rectW}px;height:${rectH}px;overflow:hidden;border-radius:${borderRadius}px;">
      <img src="${escapeHtml(src)}" alt="" onerror="${onError}" style="position:absolute;left:${crop.offsetX - rectX}px;top:${crop.offsetY - rectY}px;width:${displayW}px;height:${displayH}px;max-width:none;transform:${imgTransform};transform-origin:center center;${filter ? `filter:${filter};` : ''}display:block;" />
    </div>
  </div>`;
}

function renderElement(
  element: CanvasElement,
  branding: Branding,
  assetBase: string
): string {
  const props = (element.props ?? {}) as Record<string, unknown>;
  const rotation = typeof props.rotation === 'number' ? props.rotation : 0;
  const rotationStyle =
    element.type === ComponentType.DIVIDER
      ? ''
      : rotation !== 0
        ? `transform:rotate(${rotation}deg);transform-origin:center center;`
        : '';

  let inner = '';

  switch (element.type) {
    case ComponentType.TEXT:
    case ComponentType.HEADING:
    case ComponentType.NOTES:
    case ComponentType.FOOTER:
    case ComponentType.WATERMARK:
      inner = `<div style="${cssInline(textStyleProps(props, element.type))}">${escapeHtml(getDisplayText(props, element.type))}</div>`;
      break;
    case ComponentType.INVOICE_NUMBER:
    case ComponentType.DATE:
    case ComponentType.DUE_DATE:
    case ComponentType.GST_NUMBER:
    case ComponentType.PAN_NUMBER:
    case ComponentType.ADDRESS:
      inner = `<div style="${cssInline(textStyleProps(props, element.type))}">${escapeHtml(getDisplayText(props, element.type))}</div>`;
      break;
    case ComponentType.TERMS:
      inner = renderTerms(props);
      break;
    case ComponentType.COMPANY_CARD:
    case ComponentType.CUSTOMER_CARD:
    case ComponentType.PAYMENT_DETAILS:
      inner = renderCard(element.type, props);
      break;
    case ComponentType.LOGO:
    case ComponentType.IMAGE:
    case ComponentType.SIGNATURE:
    case ComponentType.STAMP:
      inner = renderImage(
        element.type,
        props,
        branding,
        assetBase,
        element.width,
        element.height
      );
      break;
    case ComponentType.DIVIDER: {
      const thickness = (props.thickness as number) || 1;
      const color = (props.color as string) || '#000';
      const midY = element.height / 2;
      const cx = element.width / 2;
      const transform =
        rotation !== 0
          ? ` transform="rotate(${rotation} ${cx} ${midY})"`
          : '';
      inner = `<svg width="100%" height="100%" viewBox="0 0 ${element.width} ${element.height}" preserveAspectRatio="none" style="display:block;overflow:visible;" aria-hidden="true"><line x1="0" y1="${midY}" x2="${element.width}" y2="${midY}"${transform} stroke="${escapeHtml(color)}" stroke-width="${thickness}" vector-effect="non-scaling-stroke" /></svg>`;
      break;
    }
    case ComponentType.PRODUCT_TABLE:
    case ComponentType.TABLE:
    case ComponentType.INVOICE_TABLE:
    case ComponentType.INVOICE_TABLE_2:
    case ComponentType.INVOICE_TABLE_3:
      inner = renderTable(props);
      break;
    case ComponentType.CUSTOM_HTML:
      inner = typeof props.html === 'string' ? props.html : '';
      break;
    default:
      if (
        element.type === ComponentType.RECTANGLE
        || element.type === ComponentType.ROUNDED_RECT
        || element.type === ComponentType.CIRCLE
        || element.type === ComponentType.LINE
        || element.type === ComponentType.TRIANGLE
        || element.type === ComponentType.ARROW
        || element.type === ComponentType.STAR
        || element.type === ComponentType.DIAMOND
      ) {
        inner = renderShape(element.type, props);
      }
      break;
  }

  if (!inner) return '';

  return `<div style="width:100%;height:100%;overflow:visible;${rotationStyle}">${inner}</div>`;
}

function renderPage(page: TemplatePage, branding: Branding, assetBase: string): string {
  const { width, height } = getPageSize(page);
  const elements = sortByLayer(page.elements)
    .filter((element) => element.visible !== false)
    .map((element) => {
      const opacity = normalizeCssOpacity(element.props?.opacity, 1);
      const content = renderElement(element, branding, assetBase);
      if (!content) return '';
      return `<div style="position:absolute;left:${element.x}px;top:${element.y}px;width:${element.width}px;height:${element.height}px;z-index:${element.zIndex ?? 0};opacity:${opacity};overflow:hidden;">${content}</div>`;
    })
    .join('');

  return `<div class="invoice-page" style="position:relative;width:${width}px;height:${height}px;background:#fff;overflow:hidden;page-break-after:always;">${elements}</div>`;
}

export function renderTemplatePagesToHtml(
  pages: TemplatePage[],
  branding: Branding,
  options?: { assetBase?: string }
): string {
  const assetBase = (options?.assetBase || 'http://127.0.0.1:5000').replace(/\/$/, '');
  const pageHtml = pages.map((page) => renderPage(page, branding, assetBase)).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 0; size: A4; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .invoice-page:last-child { page-break-after: auto; }
  </style>
</head>
<body>
  ${pageHtml}
  <script>
    (function () {
      function markReady() {
        document.documentElement.setAttribute('data-platform-invoice-pdf-ready', 'true');
      }
      var images = Array.prototype.slice.call(document.images || []);
      if (!images.length) { markReady(); return; }
      var pending = images.length;
      function done() {
        pending -= 1;
        if (pending <= 0) markReady();
      }
      images.forEach(function (img) {
        if (img.complete) done();
        else {
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }
      });
    })();
  </script>
</body>
</html>`;
}
