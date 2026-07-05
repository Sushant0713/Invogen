import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import type { CanvasElement } from '@invogen/shared';
import { LAYER_ROW_GAP, LAYER_ROW_HEIGHT } from './constants';
import { LayerRow, type LayerRowProps } from './LayerRow';
import { PageLayerRow } from './PageLayerRow';

type RowCallbacks = Omit<
  LayerRowProps,
  'element' | 'selected' | 'isRenaming' | 'renameValue' | 'focused'
>;

interface Props extends RowCallbacks {
  elements: CanvasElement[];
  selectedElementIds: string[];
  showPageRow: boolean;
  focusedId: string | null;
  renamingId: string | null;
  renameValue: string;
}

export function VirtualLayerList({
  elements,
  selectedElementIds,
  showPageRow,
  focusedId,
  renamingId,
  renameValue,
  ...rowProps
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const totalCount = elements.length + (showPageRow ? 1 : 0);

  const virtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => LAYER_ROW_HEIGHT + LAYER_ROW_GAP,
    overscan: 10,
  });

  return (
    <div
      ref={parentRef}
      className="max-h-[min(420px,50vh)] min-h-0 overflow-y-auto overflow-x-hidden pr-0.5"
      role="listbox"
      aria-label="Layers"
      aria-multiselectable
    >
      <motion.div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const isPageRow = showPageRow && virtualRow.index === elements.length;
          const element = isPageRow ? null : elements[virtualRow.index];

          return (
            <div
              key={isPageRow ? 'page-layer' : element!.id}
              className="absolute left-0 top-0 w-full"
              style={{
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div style={{ paddingBottom: LAYER_ROW_GAP }}>
                {isPageRow ? (
                  <PageLayerRow />
                ) : (
                  <LayerRow
                    element={element!}
                    selected={selectedElementIds.includes(element!.id)}
                    focused={focusedId === element!.id}
                    isRenaming={renamingId === element!.id}
                    renameValue={renamingId === element!.id ? renameValue : ''}
                    {...rowProps}
                  />
                )}
              </div>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
