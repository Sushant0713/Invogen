import type { CanvasElement } from '@invogen/shared';

function layerValue(zIndex: number | undefined): number {
  return typeof zIndex === 'number' && Number.isFinite(zIndex) ? zIndex : 0;
}

export function sortByLayer(elements: CanvasElement[]) {
  return [...elements].sort((a, b) => layerValue(a.zIndex) - layerValue(b.zIndex));
}

/** Back-to-front order with contiguous zIndex values (0 = bottom). */
export function normalizeElementLayers(elements: CanvasElement[]): CanvasElement[] {
  return sortByLayer(elements).map((el, index) => ({ ...el, zIndex: index }));
}

export function getLayerIndex(elements: CanvasElement[], id: string) {
  const sorted = sortByLayer(elements);
  const index = sorted.findIndex((el) => el.id === id);
  return index === -1 ? 0 : index;
}

export function getNextZIndex(elements: CanvasElement[]) {
  if (elements.length === 0) return 0;
  return Math.max(...elements.map((el) => layerValue(el.zIndex))) + 1;
}

export function reorderElementLayer(
  elements: CanvasElement[],
  id: string,
  targetLayer: number
): CanvasElement[] {
  const sorted = sortByLayer(elements);
  const currentIndex = sorted.findIndex((el) => el.id === id);
  if (currentIndex === -1) return elements;

  const clamped = Math.max(0, Math.min(targetLayer, sorted.length - 1));
  const [item] = sorted.splice(currentIndex, 1);
  sorted.splice(clamped, 0, item);

  return sorted.map((el, index) => ({ ...el, zIndex: index }));
}

/** Reorder all page elements; ids are back-to-front (index 0 = bottom layer). */
export function reorderPageElements(
  elements: CanvasElement[],
  orderedIdsBackToFront: string[]
): CanvasElement[] {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const next: CanvasElement[] = [];
  for (const id of orderedIdsBackToFront) {
    const el = byId.get(id);
    if (el) next.push(el);
  }
  for (const el of elements) {
    if (!orderedIdsBackToFront.includes(el.id)) next.push(el);
  }
  return next.map((el, index) => ({ ...el, zIndex: index }));
}

function elementBounds(el: CanvasElement): Rect {
  return { x: el.x, y: el.y, width: el.width, height: el.height };
}

export function elementsOverlap(a: CanvasElement, b: CanvasElement): boolean {
  if (a.id === b.id) return false;
  return intersectionArea(elementBounds(a), elementBounds(b)) > 0;
}

/** Layers that overlap the selected element, or any mutually overlapping set. */
export function filterOverlappingLayers(
  elements: CanvasElement[],
  selectedId: string | null
): CanvasElement[] {
  const visible = elements.filter((el) => el.visible !== false);
  const sorted = sortByLayer(visible);

  if (selectedId) {
    const selected = sorted.find((el) => el.id === selectedId);
    if (!selected) return sorted;
    const sel = elementBounds(selected);
    return sorted.filter((el) => {
      if (el.id === selectedId) return true;
      return intersectionArea(sel, elementBounds(el)) > 0;
    });
  }

  return sorted.filter((el, i) =>
    sorted.some((other, j) => i !== j && elementsOverlap(el, other))
  );
}

const LAYER_TYPE_LABELS: Record<string, string> = {
  rectangle: 'Rectangle',
  rounded_rect: 'Rounded rectangle',
  circle: 'Circle',
  triangle: 'Triangle',
  diamond: 'Diamond',
  star: 'Star',
  line: 'Line',
  arrow: 'Arrow',
  image: 'Image',
  logo: 'Logo',
  signature: 'Signature',
  text: 'Text',
  heading: 'Heading',
  divider: 'Divider',
  product_table: 'Product table',
  invoice_table: 'Invoice table 1',
  invoice_table_2: 'Invoice table 2',
  invoice_table_3: 'Invoice table 3',
  table: 'Table',
  watermark: 'Watermark',
  footer: 'Footer',
  notes: 'Note',
  terms: 'Terms & conditions',
};

export function getLayerLabel(element: CanvasElement): string {
  const typeLabel = LAYER_TYPE_LABELS[element.type];
  if (element.type === 'footer' || element.type === 'notes' || element.type === 'heading' || element.type === 'terms') {
    return typeLabel ?? element.type.replace(/_/g, ' ');
  }
  const props = (element.props ?? {}) as Record<string, unknown>;
  if (typeof props.alt === 'string' && props.alt.trim()) return props.alt.trim();
  if (typeof props.text === 'string' && props.text.trim()) {
    const t = props.text.trim();
    return t.length > 24 ? `${t.slice(0, 24)}…` : t;
  }
  if (typeof props.label === 'string' && props.label.trim()) return props.label.trim();
  if (typeof props.content === 'string' && props.content.trim()) {
    const t = props.content.trim();
    return t.length > 24 ? `${t.slice(0, 24)}…` : t;
  }
  return LAYER_TYPE_LABELS[element.type] ?? element.type.replace(/_/g, ' ');
}

type Rect = { x: number; y: number; width: number; height: number };

const MIN_OPACITY_PERCENT = 10;
const MAX_OPACITY_PERCENT = 100;

export function getStoredOpacityPercent(element: CanvasElement): number | null {
  const raw = (element.props ?? {}).opacity;
  if (typeof raw !== 'number' || Number.isNaN(raw)) return null;
  // Legacy image props used 0–1; canvas opacity slider uses 0–100.
  const percent = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
  return Math.min(MAX_OPACITY_PERCENT, Math.max(MIN_OPACITY_PERCENT, percent));
}

/** Manual opacity from slider, or full (100%) by default. */
export function getBaseOpacity(element: CanvasElement): number {
  const stored = getStoredOpacityPercent(element);
  if (stored !== null) return stored / MAX_OPACITY_PERCENT;
  return 1;
}

export function getOpacityPercent(element: CanvasElement): number {
  return Math.round(getBaseOpacity(element) * MAX_OPACITY_PERCENT);
}

function intersectionArea(a: Rect, b: Rect): number {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return xOverlap * yOverlap;
}

/** Canvas opacity: uses the element's opacity slider value only (no automatic overlap fade). */
export function getDisplayOpacity(
  element: CanvasElement,
  _elements: CanvasElement[],
  _options?: {
    isSelected?: boolean;
    isDragging?: boolean;
    dragPosition?: { id: string; x: number; y: number } | null;
  }
): number {
  return getBaseOpacity(element);
}

/** @deprecated Use getDisplayOpacity */
export function getLayerOpacity(
  element: CanvasElement,
  elements: CanvasElement[],
  options?: {
    isSelected?: boolean;
    isDragging?: boolean;
    dragPosition?: { id: string; x: number; y: number } | null;
  }
): number {
  return getDisplayOpacity(element, elements, options);
}

/** Base z-index for the scaled page canvas stacking context. */
export const BUILDER_CANVAS_Z = 1;

/** Floating toolbars, crop controls, and handles — always above canvas elements. */
export const BUILDER_OVERLAY_Z = 10_000;

/** Rotation handle must sit above the duplicate/lock/delete floating bar. */
export const BUILDER_ROTATION_HANDLE_Z = BUILDER_OVERLAY_Z + 20;

export function getCanvasZIndex(
  element: CanvasElement,
  elements: CanvasElement[],
  options: { isSelected: boolean; isDragging: boolean; isShapeCrop?: boolean; isTableEditing?: boolean }
) {
  const layerIndex = getLayerIndex(elements, element.id);
  const layerBase = layerIndex + 1;
  const editLift = elements.length + 1;
  if (options.isShapeCrop) return editLift + 50;
  if (options.isDragging) return editLift + 1;
  if (options.isTableEditing) return editLift + 2;
  if (options.isSelected) return editLift;
  return layerBase;
}

export function getToolbarZIndex(_elements: CanvasElement[]) {
  return BUILDER_OVERLAY_Z;
}

/** Locked layers are click-through unless selected (so unlock controls stay reachable). */
export function getElementPointerEvents(
  element: CanvasElement,
  options?: {
    isSelected?: boolean;
    isReferenceBg?: boolean;
    /** While a table cell is being edited, pass the table bounds so overlays don't steal clicks. */
    tableEditBounds?: { tableId: string; x: number; y: number; width: number; height: number };
  }
): 'none' | undefined {
  if (element.locked && !options?.isSelected) return 'none';
  if (options?.isReferenceBg && !options?.isSelected) return 'none';

  const block = options?.tableEditBounds;
  if (block && element.id !== block.tableId) {
    const overlap =
      element.x < block.x + block.width
      && element.x + element.width > block.x
      && element.y < block.y + block.height
      && element.y + element.height > block.y;
    if (overlap) return 'none';
  }

  return undefined;
}

function isPointInElement(el: CanvasElement, x: number, y: number): boolean {
  return (
    x >= el.x &&
    x <= el.x + el.width &&
    y >= el.y &&
    y <= el.y + el.height
  );
}

/** All elements at page coordinates, highest z-index first. */
export function findElementsAtPoint(
  elements: CanvasElement[],
  x: number,
  y: number,
  options?: { includeLocked?: boolean }
): CanvasElement[] {
  const hits: CanvasElement[] = [];
  for (const el of sortByLayer(elements).reverse()) {
    if (el.visible === false) continue;
    if (!options?.includeLocked && el.locked) continue;
    if (isPointInElement(el, x, y)) hits.push(el);
  }
  return hits;
}

/**
 * Whether pointer-down should use geometric stack picking instead of normal hit testing.
 * Used for locked layers and cycling through overlapping elements on repeated clicks.
 */
export function shouldUseStackedClickSelection(
  stack: CanvasElement[],
  currentSelectedId: string | null
): boolean {
  if (stack.length === 0) return false;
  if (stack.length === 1) return !!stack[0].locked;

  const currentIndex = currentSelectedId
    ? stack.findIndex((el) => el.id === currentSelectedId)
    : -1;

  if (currentIndex >= 0) return true;

  return stack.some((el) => el.locked);
}

/**
 * Pick the next element when clicking through a stack: cycle when the current
 * selection is in the stack, otherwise prefer the topmost unlocked layer so
 * locked overlays (click-through) do not block elements underneath.
 */
export function pickStackedClickTarget(
  stack: CanvasElement[],
  currentSelectedId: string | null
): CanvasElement | null {
  if (stack.length === 0) return null;
  if (stack.length === 1) return stack[0];

  const currentIndex = currentSelectedId
    ? stack.findIndex((el) => el.id === currentSelectedId)
    : -1;

  if (currentIndex >= 0) {
    return stack[(currentIndex + 1) % stack.length];
  }

  return (
    stack.find((el) => {
      if (el.locked) return false;
      if ((el.props as Record<string, unknown> | undefined)?.isReferenceBackground === true) {
        return false;
      }
      return true;
    }) ?? stack[0]
  );
}

/** Topmost element at page coordinates (highest z-index first). */
export function findTopElementAtPoint(
  elements: CanvasElement[],
  x: number,
  y: number,
  options?: { includeLocked?: boolean }
): CanvasElement | null {
  return findElementsAtPoint(elements, x, y, options)[0] ?? null;
}

/** Topmost unlocked, selectable element at a point (skips locked click-through overlays). */
export function findTopSelectableElementAtPoint(
  elements: CanvasElement[],
  x: number,
  y: number
): CanvasElement | null {
  const stack = findElementsAtPoint(elements, x, y, { includeLocked: true });
  return (
    stack.find((el) => {
      if (el.locked) return false;
      if ((el.props as Record<string, unknown> | undefined)?.isReferenceBackground === true) {
        return false;
      }
      return true;
    }) ?? null
  );
}

export { MIN_OPACITY_PERCENT, MAX_OPACITY_PERCENT };
