import { memo, useCallback, type KeyboardEvent, type MouseEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import type { CanvasElement } from '@invogen/shared';
import { LayerRowContent } from './LayerRowContent';
import { DROP_SPRING, HOVER_TRANSITION } from './constants';

export interface LayerRowProps {
  element: CanvasElement;
  selected: boolean;
  isRenaming: boolean;
  renameValue: string;
  onSelect: (id: string, event: MouseEvent | KeyboardEvent) => void;
  onContextMenu: (element: CanvasElement, event: MouseEvent) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  focused?: boolean;
}

function LayerRowInner({
  element,
  selected,
  isRenaming,
  renameValue,
  onSelect,
  onContextMenu,
  onToggleVisible,
  onToggleLock,
  onTogglePin,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  focused = false,
}: LayerRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (isRenaming) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(element.id, e);
      }
    },
    [element.id, isRenaming, onSelect]
  );

  return (
    <motion.div
      ref={setNodeRef}
      layout={!isDragging}
      layoutId={`layer-row-${element.id}`}
      style={style}
      role="option"
      aria-selected={selected}
      tabIndex={focused ? 0 : -1}
      className="outline-none"
      onClick={(e) => {
        if (isRenaming) return;
        onSelect(element.id, e);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(element, e);
      }}
      onKeyDown={handleKeyDown}
      whileHover={isDragging ? undefined : { x: 2 }}
      transition={HOVER_TRANSITION}
    >
      <LayerRowContent
        element={element}
        selected={selected}
        isRenaming={isRenaming}
        renameValue={renameValue}
        isDraggingGhost={isDragging}
        dragHandleProps={{
          ...attributes,
          ...listeners,
        }}
        setActivatorRef={setActivatorNodeRef}
        onToggleVisible={onToggleVisible}
        onToggleLock={onToggleLock}
        onTogglePin={onTogglePin}
        onRenameChange={onRenameChange}
        onRenameCommit={onRenameCommit}
        onRenameCancel={onRenameCancel}
      />
    </motion.div>
  );
}

export const LayerRow = memo(LayerRowInner, (prev, next) =>
  prev.element === next.element
  && prev.selected === next.selected
  && prev.isRenaming === next.isRenaming
  && prev.renameValue === next.renameValue
  && prev.focused === next.focused
);

export function DragLayerPreview({
  element,
  selected,
}: {
  element: CanvasElement;
  selected: boolean;
}) {
  return (
    <motion.div
      initial={{ scale: 1, rotate: 0, opacity: 1 }}
      animate={{ scale: 1.03, rotate: 1, opacity: 0.92 }}
      transition={DROP_SPRING}
      className="w-full"
    >
      <LayerRowContent
        element={element}
        selected={selected}
        isRenaming={false}
        renameValue=""
        isDragOverlay
        onToggleVisible={() => {}}
        onToggleLock={() => {}}
        onTogglePin={() => {}}
        onRenameChange={() => {}}
        onRenameCommit={() => {}}
        onRenameCancel={() => {}}
      />
    </motion.div>
  );
}
