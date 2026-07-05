import type { ElementBounds } from '../element-resize';
import type { PageMargins } from '../builder-dnd';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../builder-dnd';
import type { SnapGuide } from './types';

const SNAP_THRESHOLD = 6;

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

function near(a: number, b: number, threshold = SNAP_THRESHOLD): boolean {
  return Math.abs(a - b) <= threshold;
}

/** Snap element bounds to canvas center, margins, grid, and peer elements. */
export function snapElementBounds(
  bounds: ElementBounds,
  others: ElementBounds[],
  margins: PageMargins,
  snapToGrid: boolean,
  gridSize: number
): SnapResult {
  const guides: SnapGuide[] = [];
  let { x, y, width, height } = bounds;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const right = x + width;
  const bottom = y + height;

  const pageCx = PAGE_WIDTH / 2;
  const pageCy = PAGE_HEIGHT / 2;

  if (near(cx, pageCx)) {
    x = pageCx - width / 2;
    guides.push({ orientation: 'vertical', position: pageCx, label: 'center' });
  }
  if (near(cy, pageCy)) {
    y = pageCy - height / 2;
    guides.push({ orientation: 'horizontal', position: pageCy, label: 'center' });
  }

  if (near(x, margins.left)) {
    x = margins.left;
    guides.push({ orientation: 'vertical', position: margins.left, label: 'margin' });
  }
  if (near(right, PAGE_WIDTH - margins.right)) {
    x = PAGE_WIDTH - margins.right - width;
    guides.push({ orientation: 'vertical', position: PAGE_WIDTH - margins.right, label: 'margin' });
  }
  if (near(y, margins.top)) {
    y = margins.top;
    guides.push({ orientation: 'horizontal', position: margins.top, label: 'margin' });
  }
  if (near(bottom, PAGE_HEIGHT - margins.bottom)) {
    y = PAGE_HEIGHT - margins.bottom - height;
    guides.push({ orientation: 'horizontal', position: PAGE_HEIGHT - margins.bottom, label: 'margin' });
  }

  for (const peer of others) {
    const peerCx = peer.x + peer.width / 2;
    const peerCy = peer.y + peer.height / 2;
    const peerRight = peer.x + peer.width;
    const peerBottom = peer.y + peer.height;

    if (near(x, peer.x)) {
      x = peer.x;
      guides.push({ orientation: 'vertical', position: peer.x });
    }
    if (near(right, peerRight)) {
      x = peerRight - width;
      guides.push({ orientation: 'vertical', position: peerRight });
    }
    if (near(cx, peerCx)) {
      x = peerCx - width / 2;
      guides.push({ orientation: 'vertical', position: peerCx });
    }
    if (near(y, peer.y)) {
      y = peer.y;
      guides.push({ orientation: 'horizontal', position: peer.y });
    }
    if (near(bottom, peerBottom)) {
      y = peerBottom - height;
      guides.push({ orientation: 'horizontal', position: peerBottom });
    }
    if (near(cy, peerCy)) {
      y = peerCy - height / 2;
      guides.push({ orientation: 'horizontal', position: peerCy });
    }
  }

  if (snapToGrid) {
    const snap = (v: number) => Math.round(v / gridSize) * gridSize;
    x = snap(x);
    y = snap(y);
  }

  return { x, y, guides };
}
