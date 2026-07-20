import { v4 as uuidv4 } from 'uuid';
import type { CanvasElement } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import {
  isTableElementType,
  productTablePropsToRecord,
} from './product-table';
import { clampTableElementToPage } from './table-element-size';
import { normalizeTablePropsForType } from './table-props-normalize';
import { estimateStructuredBlockHeight, isStructuredContentType } from './structured-content-layout';

export const PALETTE_DRAG_MIME = 'application/x-invogen-component';

export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;

export type PageDimensions = { width: number; height: number };

export function getPageDimensions(page?: {
  pageSize?: { width: number; height: number };
}): PageDimensions {
  return {
    width: page?.pageSize?.width ?? PAGE_WIDTH,
    height: page?.pageSize?.height ?? PAGE_HEIGHT,
  };
}

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const clampElementPosition = (
  x: number,
  y: number,
  width: number,
  height: number,
  margins: PageMargins
) => ({
  x: Math.max(margins.left, Math.min(x, PAGE_WIDTH - margins.right - width)),
  y: Math.max(margins.top, Math.min(y, PAGE_HEIGHT - margins.bottom - height)),
});

export const clampElementSize = (
  x: number,
  y: number,
  width: number,
  height: number,
  margins: PageMargins,
  minSize = 24
) => {
  const maxWidth = PAGE_WIDTH - margins.right - x;
  const maxHeight = PAGE_HEIGHT - margins.bottom - y;
  return {
    width: Math.max(minSize, Math.min(width, maxWidth)),
    height: Math.max(minSize, Math.min(height, maxHeight)),
  };
};

export const rndBoundsFromMargins = (margins: PageMargins) => ({
  left: margins.left,
  top: margins.top,
  right: margins.right,
  bottom: margins.bottom,
});

export interface PaletteDragPayload {
  type: string;
  paletteId?: string;
  defaultProps?: Record<string, unknown>;
  label?: string;
}

let activePaletteDrag: PaletteDragPayload | null = null;

export function setActivePaletteDrag(payload: PaletteDragPayload | null) {
  activePaletteDrag = payload;
}

export function getActivePaletteDrag() {
  return activePaletteDrag;
}

export function getDefaultElementSize(type: string) {
  if (type.includes('table')) return { width: 500, height: 150 };
  if (type === ComponentType.ADDRESS) return { width: 280, height: 120 };
  if (type === ComponentType.TERMS) return { width: 320, height: 120 };
  if (type === ComponentType.FIELD) return { width: 220, height: 36 };
  if (type === ComponentType.ICON) return { width: 36, height: 36 };
  if (type === 'watermark') return { width: 360, height: 100 };
  if (type === 'image' || type.includes('image')) return { width: 200, height: 150 };
  if (type === 'barcode') return { width: 200, height: 80 };
  if (type.includes('logo') || type === 'stamp') return { width: 120, height: 60 };
  if (type === 'signature' || type === ComponentType.SIGNATURE) return { width: 180, height: 140 };
  if (type.includes('card')) return { width: 250, height: 120 };
  if (type === 'qr_code') return { width: 100, height: 100 };
  if (type === 'circle' || type === 'star') return { width: 80, height: 80 };
  if (type === 'line' || type === 'arrow') return { width: 120, height: 24 };
  if (
    type === 'triangle' ||
    type === 'rectangle' ||
    type === 'rounded_rectangle' ||
    type === 'diamond'
  ) {
    return { width: 120, height: 80 };
  }
  if (type === ComponentType.DIVIDER) return { width: 200, height: 12 };
  return { width: 200, height: 40 };
}

export function createCanvasElement(
  type: string,
  x: number,
  y: number,
  defaultProps: Record<string, unknown> = {},
  margins: PageMargins = { top: 0, right: 0, bottom: 0, left: 0 }
): CanvasElement {
  let { width, height } = getDefaultElementSize(type);
  const normalizedProps = isTableElementType(type)
    ? normalizeTablePropsForType(type, defaultProps)
    : null;
  const props = normalizedProps
    ? productTablePropsToRecord(normalizedProps)
    : defaultProps;
  // Multiline address-style fields need a taller default frame.
  if (
    type === ComponentType.FIELD
    && defaultProps.multiline === true
  ) {
    height = 72;
  }
  if (!normalizedProps && isStructuredContentType(type) && Object.keys(defaultProps).length > 0) {
    height = estimateStructuredBlockHeight(type, defaultProps, width);
  }
  if (normalizedProps) {
    const clamped = clampTableElementToPage(
      x,
      y,
      normalizedProps,
      PAGE_WIDTH,
      PAGE_HEIGHT,
      margins,
      type
    );
    return {
      id: uuidv4(),
      type,
      x: clamped.x,
      y: clamped.y,
      width: clamped.width,
      height: clamped.height,
      props: productTablePropsToRecord(clamped.table),
    };
  }

  return {
    id: uuidv4(),
    type,
    x,
    y,
    width,
    height,
    props,
  };
}

export function isPaletteDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).some(
    (type) => type === PALETTE_DRAG_MIME || type === 'text/plain'
  );
}

export function parsePaletteDrag(dataTransfer: DataTransfer): PaletteDragPayload | null {
  const raw =
    dataTransfer.getData(PALETTE_DRAG_MIME) ||
    dataTransfer.getData('text/plain');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PaletteDragPayload;
    return parsed?.type ? parsed : null;
  } catch {
    return null;
  }
}

export function canvasPointFromDrop(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  zoom: number,
  elementWidth: number,
  elementHeight: number
) {
  const visualX = clientX - canvasRect.left;
  const visualY = clientY - canvasRect.top;
  const logicalX = visualX / zoom - elementWidth / 2;
  const logicalY = visualY / zoom - elementHeight / 2;
  return { x: logicalX, y: logicalY };
}
