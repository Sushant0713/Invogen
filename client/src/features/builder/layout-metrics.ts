/**
 * Shared layout constants — single source for every layout pass.
 *
 * Reflow, data-field fitting, and footer placement previously used different
 * gap values (12 / 10 / 12), so spacing depended on WHICH pass moved an
 * element. Every pass must import from here.
 */
export const FLOW_GAP_PX = 12;
