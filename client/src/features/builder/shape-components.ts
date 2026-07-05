import { ComponentType } from '@invogen/shared';

export const SHAPE_TYPES = new Set<string>([
  ComponentType.RECTANGLE,
  ComponentType.ROUNDED_RECT,
  ComponentType.CIRCLE,
  ComponentType.LINE,
  ComponentType.TRIANGLE,
  ComponentType.ARROW,
  ComponentType.STAR,
  ComponentType.DIAMOND,
]);

export function isShapeComponentType(type: string): boolean {
  return SHAPE_TYPES.has(type);
}

export interface ShapeStyleProps {
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}

const BASE: ShapeStyleProps & { rotation: number } = {
  fill: '#FF7700',
  stroke: '#1f2937',
  strokeWidth: 2,
  cornerRadius: 8,
  rotation: 0,
};

export function getShapeDefaultProps(type: string): Record<string, unknown> {
  switch (type) {
    case ComponentType.RECTANGLE:
      return { ...BASE, fill: '#FF7700' };
    case ComponentType.ROUNDED_RECT:
      return { ...BASE, fill: '#3b82f6', cornerRadius: 12 };
    case ComponentType.CIRCLE:
      return { ...BASE, fill: '#10b981' };
    case ComponentType.TRIANGLE:
      return { ...BASE, fill: '#f59e0b' };
    case ComponentType.DIAMOND:
      return { ...BASE, fill: '#8b5cf6' };
    case ComponentType.STAR:
      return { ...BASE, fill: '#ec4899' };
    case ComponentType.LINE:
      return { fill: 'transparent', stroke: '#374151', strokeWidth: 3, cornerRadius: 0, rotation: 0 };
    case ComponentType.ARROW:
      return { fill: 'transparent', stroke: '#111827', strokeWidth: 3, cornerRadius: 0, rotation: 0 };
    default:
      return { ...BASE };
  }
}

export const SHAPE_COLOR_PRESETS = [
  '#FF7700',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#111827',
  '#ffffff',
  'transparent',
] as const;
