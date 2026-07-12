import { useCallback } from 'react';
import { ComponentType } from '@invogen/shared';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import { addElement } from '@/store/slices/builderSlice';
import {
  createCanvasElement,
  getDefaultElementSize,
  getPageDimensions,
} from '../builder-dnd';
import { createDefaultFooterPlacement } from '../document-footer';
import { normalizePaletteDragProps, type PaletteItem } from '../palette-catalog';
import { recordAssetUse } from './sidebar-store';

export function useInsertAsset() {
  const dispatch = useAppDispatch();
  const { pages, activePageIndex } = useAppSelector((s) => s.builder);

  return useCallback(
    (item: PaletteItem) => {
      const page = pages[activePageIndex];
      if (!page) return;

      const margins = page.margins;
      const pageSize = getPageDimensions(page);
      const props = normalizePaletteDragProps(item.type, item.defaultProps ?? {});
      const { width, height } = getDefaultElementSize(item.type);

      const innerW = pageSize.width - margins.left - margins.right;
      const innerH = pageSize.height - margins.top - margins.bottom;
      let x = margins.left + Math.max(0, (innerW - width) / 2);
      let y = margins.top + 48;

      if (item.type === ComponentType.WATERMARK) {
        y = margins.top + Math.max(0, (innerH - height) / 2);
      } else if (item.type === ComponentType.FOOTER) {
        const placement = createDefaultFooterPlacement(page);
        x = placement.x;
        y = placement.y;
      }

      const element = createCanvasElement(item.type, x, y, props, margins);
      dispatch(addElement(element));
      recordAssetUse(item.id);
    },
    [dispatch, pages, activePageIndex]
  );
}
