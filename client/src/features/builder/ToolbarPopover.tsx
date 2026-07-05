import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

export type PopoverPosition = {
  top: number;
  left: number;
  minWidth: number;
};

export function useToolbarPopover() {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PopoverPosition>({ top: 0, left: 0, minWidth: 0 });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
      minWidth: rect.width,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: globalThis.MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const toggle = () => setOpen((v) => !v);
  const close = () => setOpen(false);

  return { open, setOpen, toggle, close, anchorRef, panelRef, position };
}

interface ToolbarPopoverPanelProps {
  open: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
  position: PopoverPosition;
  children: ReactNode;
  className?: string;
  width?: number;
}

export function ToolbarPopoverPanel({
  open,
  panelRef,
  position,
  children,
  className = '',
  width,
}: ToolbarPopoverPanelProps) {
  if (!open) return null;

  const panelWidth = width ?? Math.max(position.minWidth, 0);

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: panelWidth || undefined,
        zIndex: 10000,
        transform: 'translateX(-50%)',
      }}
      className={className}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}
