import { ComponentType } from '@invogen/shared';
import type { CSSProperties } from 'react';
import { isImageComponentType } from './image-components';
import { isShapeComponentType } from './shape-components';

export function normalizeRotation(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return Math.round(((deg % 360) + 360) % 360);
}

export function rotateByDegrees(current: number, delta: number): number {
  return normalizeRotation(current + delta);
}

export function getElementRotation(props: Record<string, unknown> | undefined): number {
  const raw = props?.rotation;
  return typeof raw === 'number' ? normalizeRotation(raw) : 0;
}

export function supportsElementRotation(type: string): boolean {
  return (
    isImageComponentType(type) ||
    isShapeComponentType(type) ||
    type === ComponentType.DIVIDER
  );
}

export function getElementRotationTransformStyle(
  type: string,
  props: Record<string, unknown> | undefined
): CSSProperties | undefined {
  if (!supportsElementRotation(type)) return undefined;
  const rotation = getElementRotation(props);
  if (rotation === 0) return undefined;
  return {
    transform: `rotate(${rotation}deg)`,
    transformOrigin: 'center center',
  };
}

/** Canvas-space position for the rotate handle above a rotated element. */
export function getRotationHandlePosition(
  x: number,
  y: number,
  width: number,
  height: number,
  rotationDeg: number,
  offset = 36
): { centerX: number; centerY: number; handleX: number; handleY: number } {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const rad = (rotationDeg * Math.PI) / 180;
  const localX = 0;
  const localY = -(height / 2 + offset);
  return {
    centerX,
    centerY,
    handleX: centerX + localX * Math.cos(rad) - localY * Math.sin(rad),
    handleY: centerY + localX * Math.sin(rad) + localY * Math.cos(rad),
  };
}

export function snapRotationDegrees(deg: number, shiftKey: boolean): number {
  const normalized = normalizeRotation(deg);
  if (!shiftKey) return normalized;
  return normalizeRotation(Math.round(normalized / 15) * 15);
}

type Point = { x: number; y: number };

function rotatePoint(point: Point, cx: number, cy: number, rad: number): Point {
  const dx = point.x - cx;
  const dy = point.y - cy;
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

/** Corners of the element box after rotation (canvas coordinates). */
export function getRotatedElementCorners(
  x: number,
  y: number,
  width: number,
  height: number,
  rotationDeg: number
): [Point, Point, Point, Point] {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rad = (rotationDeg * Math.PI) / 180;
  return [
    rotatePoint({ x, y }, cx, cy, rad),
    rotatePoint({ x: x + width, y }, cx, cy, rad),
    rotatePoint({ x: x + width, y: y + height }, cx, cy, rad),
    rotatePoint({ x, y: y + height }, cx, cy, rad),
  ];
}

export function cornersToSvgPoints(corners: Point[], zoom: number): string {
  return corners.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ');
}
