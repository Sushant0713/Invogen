import type { CanvasElement, DocumentObject, DocumentPage, TemplatePage } from '@invogen/shared';
import { v4 as uuidv4 } from 'uuid';

/** Builder element → canonical document object. */
export function elementToObject(el: CanvasElement, pageId: string): DocumentObject {
  const props = el.props ?? {};
  const rotation = typeof props.rotation === 'number' ? props.rotation : 0;
  const opacityRaw = props.opacity;
  const opacity =
    typeof opacityRaw === 'number'
      ? opacityRaw > 1
        ? opacityRaw / 100
        : opacityRaw
      : 1;

  return {
    id: el.id,
    type: el.type,
    page: pageId,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    rotation,
    opacity,
    visible: el.visible !== false,
    locked: !!el.locked,
    zIndex: el.zIndex,
    data: { ...props },
  };
}

/** Canonical document object → builder canvas element. */
export function objectToElement(obj: DocumentObject): CanvasElement {
  const opacityPercent = Math.round(Math.min(1, Math.max(0, obj.opacity)) * 100);
  return {
    id: obj.id,
    type: obj.type,
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    zIndex: obj.zIndex,
    locked: obj.locked,
    visible: obj.visible,
    props: {
      ...obj.data,
      rotation: obj.rotation,
      opacity: opacityPercent,
    },
  };
}

export function templatePageToDocumentPage(page: TemplatePage): DocumentPage {
  return {
    id: page.id,
    name: page.name,
    margins: page.margins,
    pageSize: page.pageSize,
    objects: page.elements.map((el) => elementToObject(el, page.id)),
  };
}

export function documentPageToTemplatePage(page: DocumentPage): TemplatePage {
  const sorted = [...page.objects].sort((a, b) => a.zIndex - b.zIndex);
  return {
    id: page.id,
    name: page.name,
    margins: page.margins,
    pageSize: page.pageSize,
    elements: sorted.map(objectToElement),
  };
}

export function createDocumentPage(name: string, objects: DocumentObject[] = []): DocumentPage {
  return {
    id: uuidv4(),
    name,
    margins: { top: 40, right: 40, bottom: 40, left: 40 },
    objects: objects.map((o, i) => ({ ...o, zIndex: o.zIndex ?? i })),
  };
}

export function createTextObject(
  text: string,
  box: { x: number; y: number; width: number; height: number },
  style: Partial<{
    fontSize: number;
    fontFamily: string;
    color: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    alignment: string;
    lineHeight: number;
    letterSpacing: number;
    href: string;
  }> = {},
  pageId = ''
): DocumentObject {
  const isHeading = (style.fontSize ?? 14) >= 16;
  return {
    id: uuidv4(),
    type: isHeading ? 'heading' : 'text',
    page: pageId,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    data: {
      content: text,
      text,
      fontSize: style.fontSize ?? 14,
      fontFamily: style.fontFamily,
      color: style.color ?? '#000000',
      fontWeight: style.bold ? 700 : 400,
      italic: !!style.italic,
      underline: !!style.underline,
      textAlign: style.alignment ?? 'left',
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      href: style.href,
    },
  };
}

export function createImageObject(
  src: string,
  box: { x: number; y: number; width: number; height: number },
  opts: { naturalW?: number; naturalH?: number; isLogo?: boolean; rasterFallback?: boolean } = {},
  pageId = ''
): DocumentObject {
  return {
    id: uuidv4(),
    type: opts.isLogo ? 'logo' : 'image',
    page: pageId,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    data: {
      src,
      objectFit: 'contain',
      opacity: 100,
      imageNaturalW: opts.naturalW,
      imageNaturalH: opts.naturalH,
      rasterFallback: !!opts.rasterFallback,
    },
  };
}

export function createShapeObject(
  shapeType: string,
  box: { x: number; y: number; width: number; height: number },
  style: { fill?: string; stroke?: string; strokeWidth?: number; cornerRadius?: number } = {},
  pageId = ''
): DocumentObject {
  return {
    id: uuidv4(),
    type: shapeType,
    page: pageId,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    data: {
      fill: style.fill ?? 'transparent',
      stroke: style.stroke ?? '#000000',
      strokeWidth: style.strokeWidth ?? 1,
      cornerRadius: style.cornerRadius,
    },
  };
}
