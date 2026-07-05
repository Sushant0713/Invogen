import { useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  Eye,
  EyeOff,
  Group,
  Lock,
  LockOpen,
  Pencil,
  Trash2,
  Ungroup,
} from 'lucide-react';
import type { CanvasElement } from '@invogen/shared';
import { toast } from 'sonner';

export interface LayerContextMenuState {
  element: CanvasElement;
  x: number;
  y: number;
}

interface Props {
  menu: LayerContextMenuState | null;
  onClose: () => void;
  onRename: (element: CanvasElement) => void;
  onDuplicate: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveLayer: (id: string, layer: number) => void;
  layerIndex: number;
  maxLayer: number;
}

export function LayerContextMenu({
  menu,
  onClose,
  onRename,
  onDuplicate,
  onToggleVisible,
  onToggleLock,
  onDelete,
  onMoveLayer,
  layerIndex,
  maxLayer,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menu, onClose]);

  const item = (label: string, icon: ReactNode, onClick: () => void, disabled = false) => (
    <button
      key={label}
      type="button"
      disabled={disabled}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
      onClick={() => {
        if (disabled) return;
        onClick();
        onClose();
      }}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-500">{icon}</span>
      {label}
    </button>
  );

  return (
    <AnimatePresence>
      {menu && (
        <motion.div
          ref={ref}
          role="menu"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          className="fixed z-[13000] min-w-[11rem] rounded-xl border border-gray-200/80 bg-white p-1.5 shadow-xl"
          style={{ left: menu.x, top: menu.y }}
        >
          {item('Rename', <Pencil className="h-3.5 w-3.5" />, () => onRename(menu.element))}
          {item('Duplicate', <Copy className="h-3.5 w-3.5" />, () => onDuplicate(menu.element.id))}
          {item('Group', <Group className="h-3.5 w-3.5" />, () => toast.message('Grouping coming soon'), true)}
          {item('Ungroup', <Ungroup className="h-3.5 w-3.5" />, () => toast.message('Ungrouping coming soon'), true)}
          <div className="my-1 h-px bg-gray-100" />
          {item('Bring Forward', <ArrowUp className="h-3.5 w-3.5" />, () => onMoveLayer(menu.element.id, layerIndex + 1), layerIndex >= maxLayer)}
          {item('Send Backward', <ArrowDown className="h-3.5 w-3.5" />, () => onMoveLayer(menu.element.id, layerIndex - 1), layerIndex <= 0)}
          {item('Bring To Front', <ArrowUpToLine className="h-3.5 w-3.5" />, () => onMoveLayer(menu.element.id, maxLayer), layerIndex >= maxLayer)}
          {item('Send To Back', <ArrowDownToLine className="h-3.5 w-3.5" />, () => onMoveLayer(menu.element.id, 0), layerIndex <= 0)}
          <div className="my-1 h-px bg-gray-100" />
          {item(
            menu.element.visible === false ? 'Show' : 'Hide',
            menu.element.visible === false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />,
            () => onToggleVisible(menu.element.id)
          )}
          {item(
            menu.element.locked ? 'Unlock' : 'Lock',
            menu.element.locked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />,
            () => onToggleLock(menu.element.id)
          )}
          {item('Delete', <Trash2 className="h-3.5 w-3.5" />, () => onDelete(menu.element.id), !!menu.element.locked)}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
