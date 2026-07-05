import type { CSSProperties } from 'react';
import { ComponentType } from '@invogen/shared';
import type { CanvasElement } from '@invogen/shared';
import type { CropRect, CropCorner } from './image-editor/types';
import { FULL_CROP_RECT } from './image-editor/types';
import {
  applyCropEdge,
  clampCropRect,
  rectToPixels,
} from './image-editor/cropRect';

export type ShapeClipMode = 'rect' | 'polygon';

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface ShapeClip {
  mode: ShapeClipMode;
  rect: CropRect;
  polygon: NormalizedPoint[];
}

export const FULL_SHAPE_POLYGON: NormalizedPoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

export const SLANT_CUT_PRESETS: {
  id: string;
  label: string;
  title: string;
  polygon: NormalizedPoint[];
}[] = [
  {
    id: 'slant-top',
    label: '⌁',
    title: 'Slant top edge',
    polygon: [
      { x: 0, y: 0.22 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
  },
  {
    id: 'slant-bottom',
    label: '⌁',
    title: 'Slant bottom edge',
    polygon: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.78 },
      { x: 0, y: 1 },
    ],
  },
  {
    id: 'slant-left',
    label: '⟋',
    title: 'Slant left edge',
    polygon: [
      { x: 0.22, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
  },
  {
    id: 'slant-right',
    label: '⟍',
    title: 'Slant right edge',
    polygon: [
      { x: 0, y: 0 },
      { x: 0.78, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
  },
  {
    id: 'diag-tl',
    label: '◤',
    title: 'Diagonal — keep top-left',
    polygon: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
  },
  {
    id: 'diag-br',
    label: '◢',
    title: 'Diagonal — keep bottom-right',
    polygon: [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
  },
  {
    id: 'diag-tr',
    label: '◥',
    title: 'Diagonal — keep top-right',
    polygon: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ],
  },
  {
    id: 'diag-bl',
    label: '◣',
    title: 'Diagonal — keep bottom-left',
    polygon: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
  },
];

const EPS = 0.008;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampPoint(point: NormalizedPoint): NormalizedPoint {
  return { x: clamp01(point.x), y: clamp01(point.y) };
}

function parsePolygon(raw: unknown): NormalizedPoint[] {
  if (!Array.isArray(raw) || raw.length < 6) return [...FULL_SHAPE_POLYGON];
  const points: NormalizedPoint[] = [];
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const x = raw[i];
    const y = raw[i + 1];
    if (typeof x !== 'number' || typeof y !== 'number') continue;
    points.push(clampPoint({ x, y }));
  }
  return points.length >= 3 ? points : [...FULL_SHAPE_POLYGON];
}

export function polygonToFlat(points: NormalizedPoint[]): number[] {
  return points.flatMap((p) => [p.x, p.y]);
}

export function getShapeClipFromProps(props: Record<string, unknown>): ShapeClip {
  const x = typeof props.clipX === 'number' ? props.clipX : 0;
  const y = typeof props.clipY === 'number' ? props.clipY : 0;
  const width = typeof props.clipW === 'number' ? props.clipW : 1;
  const height = typeof props.clipH === 'number' ? props.clipH : 1;
  const mode: ShapeClipMode = props.clipMode === 'polygon' ? 'polygon' : 'rect';
  return {
    mode,
    rect: clampCropRect({ x, y, width, height }),
    polygon: parsePolygon(props.clipPolygon),
  };
}

export function shapeClipToProps(clip: ShapeClip): Record<string, unknown> {
  const rect = clampCropRect(clip.rect);
  return {
    clipMode: clip.mode,
    clipX: rect.x,
    clipY: rect.y,
    clipW: rect.width,
    clipH: rect.height,
    clipPolygon: polygonToFlat(clip.polygon.map(clampPoint)),
  };
}

export function isFullShapeClipRect(rect: CropRect): boolean {
  return (
    rect.x <= EPS
    && rect.y <= EPS
    && rect.width >= 1 - EPS
    && rect.height >= 1 - EPS
  );
}

export function isFullShapePolygon(polygon: NormalizedPoint[]): boolean {
  if (polygon.length !== 4) return false;
  const expected = FULL_SHAPE_POLYGON;
  return polygon.every(
    (p, i) => Math.abs(p.x - expected[i].x) <= EPS && Math.abs(p.y - expected[i].y) <= EPS
  );
}

export function isDefaultShapeClip(clip: ShapeClip): boolean {
  if (clip.mode === 'polygon') return isFullShapePolygon(clip.polygon);
  return isFullShapeClipRect(clip.rect);
}

/** @deprecated use isDefaultShapeClip */
export function isFullShapeClip(rect: CropRect): boolean {
  return isFullShapeClipRect(rect);
}

export function rectToPolygon(rect: CropRect): NormalizedPoint[] {
  const r = clampCropRect(rect);
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ];
}

export function polygonBoundingRect(polygon: NormalizedPoint[]): CropRect {
  if (polygon.length === 0) return { ...FULL_CROP_RECT };
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return clampCropRect({
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  });
}

export function shapeClipPath(clip: ShapeClip): string | undefined {
  if (isDefaultShapeClip(clip)) return undefined;

  if (clip.mode === 'polygon') {
    const pts = clip.polygon.map((p) => `${p.x * 100}% ${p.y * 100}%`).join(', ');
    return `polygon(${pts})`;
  }

  const rect = clip.rect;
  const top = rect.y * 100;
  const right = (1 - rect.x - rect.width) * 100;
  const bottom = (1 - rect.y - rect.height) * 100;
  const left = rect.x * 100;
  return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
}

export function shapeClipStyle(clip: ShapeClip): CSSProperties | undefined {
  const path = shapeClipPath(clip);
  if (!path) return undefined;
  return {
    clipPath: path,
    WebkitClipPath: path,
    width: '100%',
    height: '100%',
  };
}

/** @deprecated use shapeClipPath */
export function shapeClipPathInset(rect: CropRect): string | undefined {
  return shapeClipPath({ mode: 'rect', rect, polygon: [...FULL_SHAPE_POLYGON] });
}

export function polygonToPixelPoints(
  polygon: NormalizedPoint[],
  frameW: number,
  frameH: number
): { x: number; y: number }[] {
  return polygon.map((p) => ({ x: p.x * frameW, y: p.y * frameH }));
}

export function movePolygonPoint(
  polygon: NormalizedPoint[],
  index: number,
  dx: number,
  dy: number,
  frameW: number,
  frameH: number
): NormalizedPoint[] {
  if (index < 0 || index >= polygon.length) return polygon;
  const next = polygon.map((p) => ({ ...p }));
  next[index] = clampPoint({
    x: next[index].x + dx / Math.max(frameW, 1),
    y: next[index].y + dy / Math.max(frameH, 1),
  });
  return next;
}

export function applyCropCorner(
  rect: CropRect,
  corner: CropCorner,
  dx: number,
  dy: number,
  frameW: number,
  frameH: number
): CropRect {
  switch (corner) {
    case 'nw':
      return applyCropEdge(
        applyCropEdge(rect, 'left', dx, frameW, frameH),
        'top',
        dy,
        frameW,
        frameH
      );
    case 'ne':
      return applyCropEdge(
        applyCropEdge(rect, 'right', dx, frameW, frameH),
        'top',
        dy,
        frameW,
        frameH
      );
    case 'sw':
      return applyCropEdge(
        applyCropEdge(rect, 'left', dx, frameW, frameH),
        'bottom',
        dy,
        frameW,
        frameH
      );
    case 'se':
      return applyCropEdge(
        applyCropEdge(rect, 'right', dx, frameW, frameH),
        'bottom',
        dy,
        frameW,
        frameH
      );
  }
}

function renormalizePolygon(
  polygon: NormalizedPoint[],
  bounds: CropRect
): NormalizedPoint[] {
  const w = Math.max(bounds.width, EPS);
  const h = Math.max(bounds.height, EPS);
  return polygon.map((p) =>
    clampPoint({
      x: (p.x - bounds.x) / w,
      y: (p.y - bounds.y) / h,
    })
  );
}

/** Bake crop into element bounds on apply — only when the visual result is preserved. */
export function shouldBakeShapeClipOnApply(element: CanvasElement): boolean {
  const clip = getShapeClipFromProps((element.props ?? {}) as Record<string, unknown>);
  if (isDefaultShapeClip(clip)) return false;

  if (clip.mode === 'polygon') return true;

  return (
    element.type === ComponentType.RECTANGLE
    || element.type === ComponentType.ROUNDED_RECT
    || element.type === ComponentType.LINE
    || element.type === ComponentType.ARROW
  );
}

/** Bake clip into element bounds and reset clip to full frame. */
export function applyClipToElementBounds(element: CanvasElement): CanvasElement {
  const props = (element.props ?? {}) as Record<string, unknown>;
  const clip = getShapeClipFromProps(props);
  if (isDefaultShapeClip(clip)) return element;

  if (clip.mode === 'polygon') {
    const bounds = polygonBoundingRect(clip.polygon);
    const clipProps = shapeClipToProps({
      mode: 'polygon',
      rect: { ...FULL_CROP_RECT },
      polygon: clip.polygon,
    });

    if (isFullShapeClipRect(bounds)) {
      return {
        ...element,
        props: { ...props, ...clipProps },
      };
    }

    const newX = element.x + bounds.x * element.width;
    const newY = element.y + bounds.y * element.height;
    const newW = Math.max(24, element.width * bounds.width);
    const newH = Math.max(24, element.height * bounds.height);
    const nextPolygon = renormalizePolygon(clip.polygon, bounds);

    const baked: ShapeClip = {
      mode: 'polygon',
      rect: { ...FULL_CROP_RECT },
      polygon: nextPolygon,
    };

    if (isDefaultShapeClip(baked)) {
      return {
        ...element,
        x: newX,
        y: newY,
        width: newW,
        height: newH,
        props: {
          ...props,
          clipMode: 'rect',
          clipX: FULL_CROP_RECT.x,
          clipY: FULL_CROP_RECT.y,
          clipW: FULL_CROP_RECT.width,
          clipH: FULL_CROP_RECT.height,
          clipPolygon: polygonToFlat(FULL_SHAPE_POLYGON),
        },
      };
    }

    return {
      ...element,
      x: newX,
      y: newY,
      width: newW,
      height: newH,
      props: {
        ...props,
        ...shapeClipToProps(baked),
      },
    };
  }

  const rect = clip.rect;
  return {
    ...element,
    x: element.x + rect.x * element.width,
    y: element.y + rect.y * element.height,
    width: Math.max(24, element.width * rect.width),
    height: Math.max(24, element.height * rect.height),
    props: {
      ...props,
      clipMode: 'rect',
      clipX: FULL_CROP_RECT.x,
      clipY: FULL_CROP_RECT.y,
      clipW: FULL_CROP_RECT.width,
      clipH: FULL_CROP_RECT.height,
      clipPolygon: polygonToFlat(FULL_SHAPE_POLYGON),
    },
  };
}

export { rectToPixels };
