import { Eye, EyeOff, Lock, LockOpen } from 'lucide-react';
import type { CanvasElement } from '@invogen/shared';
import { getLayerLabel } from '../element-layers';
import { LayerDragDots } from './LayerDragDots';
import { LayerThumbnail } from './LayerThumbnail';
import { POSITION_PANEL_ACCENT } from './constants';

interface ContentProps {
  element: CanvasElement;
  selected: boolean;
  isRenaming: boolean;
  renameValue: string;
  dragHandleProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  setActivatorRef?: (node: HTMLButtonElement | null) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  isDragOverlay?: boolean;
  isDraggingGhost?: boolean;
}

export function LayerRowContent({
  element,
  selected,
  isRenaming,
  renameValue,
  dragHandleProps,
  setActivatorRef,
  onToggleVisible,
  onToggleLock,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  isDragOverlay = false,
  isDraggingGhost = false,
}: ContentProps) {
  const label = getLayerLabel(element);
  const hidden = element.visible === false;
  const locked = !!element.locked;

  return (
    <div
      className={`group/layer relative flex h-14 items-center gap-1.5 rounded-xl bg-[#ededed] px-1.5 transition-all duration-150 hover:bg-[#f3f4f6] ${
        isDragOverlay ? 'cursor-grabbing shadow-2xl' : isDraggingGhost ? 'opacity-40' : ''
      } ${hidden ? 'opacity-60' : ''}`}
      style={
        selected
          ? {
              boxShadow: `0 0 0 2px ${POSITION_PANEL_ACCENT}, 0 0 12px ${POSITION_PANEL_ACCENT}33`,
              transform: selected && !isDragOverlay ? 'scale(1.01)' : undefined,
            }
          : undefined
      }
    >
      <button
        type="button"
        ref={setActivatorRef}
        className="flex h-10 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-black/[0.04] active:cursor-grabbing"
        aria-label={`Drag to reorder ${label}`}
        onClick={(e) => e.stopPropagation()}
        {...dragHandleProps}
      >
        <LayerDragDots />
      </button>

      <LayerThumbnail element={element} />

      <div className="min-w-0 flex-1">
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') onRenameCommit();
              if (e.key === 'Escape') onRenameCancel();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-md border border-violet-300 bg-white px-2 py-1 text-xs text-gray-800 outline-none ring-2 ring-violet-200"
            aria-label="Rename layer"
          />
        ) : (
          <span className="block truncate text-xs font-medium text-gray-700">{label}</span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 pr-0.5">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 opacity-0 transition-all hover:bg-white/80 hover:text-gray-600 group-hover/layer:opacity-100 focus:opacity-100"
          aria-label={hidden ? 'Show layer' : 'Hide layer'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisible(element.id);
          }}
        >
          {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:bg-white/80 hover:text-gray-600 ${
            locked ? 'text-amber-600 opacity-100' : 'text-gray-400 opacity-0 group-hover/layer:opacity-100 focus:opacity-100'
          }`}
          aria-label={locked ? 'Unlock layer' : 'Lock layer'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock(element.id);
          }}
        >
          {locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
