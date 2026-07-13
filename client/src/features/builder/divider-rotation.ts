/** Smooth rotation while dragging (no integer rounding). */
export function normalizeDividerRotationLive(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return ((deg % 360) + 360) % 360;
}

/** Commit rotation to whole degrees for storage. */
export function normalizeDividerRotation(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return Math.round(normalizeDividerRotationLive(deg));
}

export function getDividerLineSvgTransform(
  rotationDeg: number,
  width: number,
  height: number
): string | undefined {
  if (!rotationDeg) return undefined;
  const cx = width / 2;
  const cy = height / 2;
  return `rotate(${rotationDeg} ${cx} ${cy})`;
}
