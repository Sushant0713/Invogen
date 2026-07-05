export const POSITION_PANEL_ACCENT = '#8b3dff';
export const LAYER_ROW_HEIGHT = 56;
export const LAYER_ROW_GAP = 8;
export const PANEL_WIDTH = 280;

export const MODAL_OPEN_TRANSITION = {
  duration: 0.25,
  ease: [0.22, 1, 0.36, 1] as const,
};

export const DROP_SPRING = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 35,
};

export const HOVER_TRANSITION = { duration: 0.15, ease: 'easeOut' as const };
