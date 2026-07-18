import type { CanvasElement } from '@invogen/shared';
import { isLayoutFixedChrome } from './layout-policy';

/** How the element participates in live document flow. */
export type LayoutMode = 'flow' | 'fixed';

/**
 * What happens when live text exceeds the authored box.
 * - wrapGrow: wrap and grow height (default for fields)
 * - wrap: wrap inside box, clip extra lines
 * - clip: do not wrap/grow — keep authored height
 */
export type OverflowPolicy = 'wrapGrow' | 'wrap' | 'clip';

/**
 * How collisions with growing neighbors are handled in live preview.
 * - pushRelated: move when a related element above grows (default)
 * - allowOverlap: keep position even if ink overlaps (design intent)
 * - warnOnly: same as allow for layout; builder shows a warning
 */
export type CollisionPolicy = 'pushRelated' | 'allowOverlap' | 'warnOnly';

export const LAYOUT_MODE_KEY = 'layoutMode';
export const OVERFLOW_POLICY_KEY = 'overflowPolicy';
export const COLLISION_POLICY_KEY = 'collisionPolicy';
export const FLOW_GROUP_ID_KEY = 'flowGroupId';

export function readLayoutMode(props: Record<string, unknown>): LayoutMode {
  if (props.fixedInFlow === true || props[LAYOUT_MODE_KEY] === 'fixed') return 'fixed';
  return 'flow';
}

export function readOverflowPolicy(props: Record<string, unknown>): OverflowPolicy {
  const raw = props[OVERFLOW_POLICY_KEY];
  if (raw === 'wrap' || raw === 'clip' || raw === 'wrapGrow') return raw;
  return 'wrapGrow';
}

export function readCollisionPolicy(props: Record<string, unknown>): CollisionPolicy {
  const raw = props[COLLISION_POLICY_KEY];
  if (raw === 'allowOverlap' || raw === 'warnOnly' || raw === 'pushRelated') return raw;
  return 'pushRelated';
}

export function readFlowGroupId(props: Record<string, unknown>): string | null {
  const raw = props[FLOW_GROUP_ID_KEY];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return null;
}

export function getElementLayoutMode(element: CanvasElement): LayoutMode {
  if (isLayoutFixedChrome(element)) return 'fixed';
  return readLayoutMode((element.props ?? {}) as Record<string, unknown>);
}

export function getElementOverflowPolicy(element: CanvasElement): OverflowPolicy {
  return readOverflowPolicy((element.props ?? {}) as Record<string, unknown>);
}

export function getElementCollisionPolicy(element: CanvasElement): CollisionPolicy {
  return readCollisionPolicy((element.props ?? {}) as Record<string, unknown>);
}

export function getElementFlowGroupId(element: CanvasElement): string | null {
  return readFlowGroupId((element.props ?? {}) as Record<string, unknown>);
}

/**
 * True when a growing `anchor` should push `element` in live layout.
 * Explicit flow groups win over inferred column stacking when both sides are grouped.
 */
export function shouldPushRelatedElement(
  anchor: CanvasElement,
  element: CanvasElement
): boolean {
  if (element.id === anchor.id || element.visible === false) return false;
  if (isLayoutFixedChrome(element) || getElementLayoutMode(element) === 'fixed') return false;

  const collision = getElementCollisionPolicy(element);
  if (collision === 'allowOverlap' || collision === 'warnOnly') return false;

  const anchorGroup = getElementFlowGroupId(anchor);
  const elementGroup = getElementFlowGroupId(element);

  // Both explicitly grouped: only move within the same group.
  if (anchorGroup && elementGroup) return anchorGroup === elementGroup;

  // Growing grouped block should not drag ungrouped neighbors (e.g. title beside address).
  if (anchorGroup && !elementGroup) return false;

  // Ungrouped growable (table/card/field): legacy callers still apply column/stack checks.
  return true;
}

export function buildLayoutIntentProps(patch: {
  layoutMode?: LayoutMode;
  overflowPolicy?: OverflowPolicy;
  collisionPolicy?: CollisionPolicy;
  flowGroupId?: string | null;
}): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  if (patch.layoutMode !== undefined) {
    next[LAYOUT_MODE_KEY] = patch.layoutMode;
    next.fixedInFlow = patch.layoutMode === 'fixed';
  }
  if (patch.overflowPolicy !== undefined) {
    next[OVERFLOW_POLICY_KEY] = patch.overflowPolicy;
  }
  if (patch.collisionPolicy !== undefined) {
    next[COLLISION_POLICY_KEY] = patch.collisionPolicy;
  }
  if (patch.flowGroupId !== undefined) {
    next[FLOW_GROUP_ID_KEY] = patch.flowGroupId && patch.flowGroupId.trim()
      ? patch.flowGroupId.trim()
      : null;
  }
  return next;
}

/** Suggest a shared group id for multi-select (stable, short). */
export function suggestFlowGroupId(label = 'group'): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'group';
  return `${slug}-${Math.random().toString(36).slice(2, 7)}`;
}
