import type { CSSProperties } from 'react';
import { ComponentType } from '@invogen/shared';
import { isShapeComponentType } from '@/features/builder/shape-components';

export function isShapeType(type: string): boolean {
  return isShapeComponentType(type);
}

interface Props {
  type: string;
  props: Record<string, unknown>;
}

export function ShapeView({ type, props }: Props) {
  const fill = typeof props.fill === 'string' ? props.fill : 'transparent';
  const stroke = typeof props.stroke === 'string' ? props.stroke : '#111827';
  const strokeWidth = typeof props.strokeWidth === 'number' ? props.strokeWidth : 2;
  const cornerRadius =
    typeof props.cornerRadius === 'number'
      ? props.cornerRadius
      : typeof props.borderRadius === 'number'
        ? props.borderRadius
        : 0;

  const base: CSSProperties = {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    pointerEvents: 'none',
  };

  if (type === ComponentType.CIRCLE) {
    return (
      <div
        style={{
          ...base,
          borderRadius: '50%',
          background: fill,
          border: `${strokeWidth}px solid ${stroke}`,
        }}
      />
    );
  }

  if (type === ComponentType.LINE) {
    return (
      <div className="flex h-full w-full items-center">
        <div style={{ width: '100%', height: strokeWidth, background: stroke, borderRadius: 1 }} />
      </div>
    );
  }

  if (type === ComponentType.ARROW) {
    return (
      <svg
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        className="h-full w-full"
        style={{ pointerEvents: 'none' }}
        aria-hidden
      >
        <line x1="4" y1="12" x2="76" y2="12" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
        <polygon points="76,4 96,12 76,20" fill={stroke} />
      </svg>
    );
  }

  if (type === ComponentType.TRIANGLE) {
    return (
      <div
        style={{
          ...base,
          background: fill,
          clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
          border: 'none',
          boxShadow: strokeWidth > 0 ? `inset 0 0 0 ${strokeWidth}px ${stroke}` : undefined,
        }}
      />
    );
  }

  if (type === ComponentType.DIAMOND) {
    return (
      <div
        style={{
          ...base,
          background: fill,
          clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
          border: `${strokeWidth}px solid ${stroke}`,
        }}
      />
    );
  }

  if (type === ComponentType.STAR) {
    return (
      <div
        style={{
          ...base,
          background: fill,
          clipPath:
            'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
          border: 'none',
        }}
      />
    );
  }

  return (
    <div
      style={{
        ...base,
        background: fill,
        border: `${strokeWidth}px solid ${stroke}`,
        borderRadius: type === ComponentType.ROUNDED_RECT ? cornerRadius || 8 : cornerRadius,
      }}
    />
  );
}
