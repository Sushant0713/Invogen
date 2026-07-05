import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import { setElementLayer } from '@/store/slices/builderSlice';
import { getLayerIndex, sortByLayer } from './element-layers';
import { getPrimarySelectedId } from './builder-selection';
import { LayersPanel } from './layers-panel/LayersPanel';
import {
  DROP_SPRING,
  MODAL_OPEN_TRANSITION,
  PANEL_WIDTH,
  POSITION_PANEL_ACCENT,
} from './layers-panel/constants';

type PositionTab = 'arrange' | 'layers';

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`relative flex-1 px-2 py-3 text-sm font-semibold transition-colors ${
        active ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
      }`}
      onClick={onClick}
    >
      {label}
      {active && (
        <motion.span
          layoutId="position-tab-underline"
          className="absolute inset-x-4 bottom-0 h-[3px] rounded-full"
          style={{ backgroundColor: POSITION_PANEL_ACCENT }}
          transition={DROP_SPRING}
        />
      )}
    </button>
  );
}

function ArrangeControls() {
  const dispatch = useAppDispatch();
  const { pages, activePageIndex, selectedElementIds } = useAppSelector((s) => s.builder);
  const primarySelectedId = getPrimarySelectedId(selectedElementIds);
  const page = pages[activePageIndex];
  const element = primarySelectedId
    ? page.elements.find((el) => el.id === primarySelectedId)
    : undefined;

  if (!element) {
    return (
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-1 text-center text-sm text-gray-500"
      >
        Select an element to arrange its position in the stack.
      </motion.p>
    );
  }

  const layerIndex = getLayerIndex(page.elements, element.id);
  const maxLayer = Math.max(0, sortByLayer(page.elements).length - 1);

  const move = (layer: number) => {
    dispatch(setElementLayer({ id: element.id, layer }));
  };

  const btn =
    'rounded-xl bg-[#ededed] px-3 py-3 text-xs font-semibold text-gray-700 transition-colors hover:bg-[#e4e6e9] disabled:opacity-40';

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.2 }}
      className="grid grid-cols-2 gap-2"
    >
      <button type="button" className={btn} disabled={layerIndex >= maxLayer} onClick={() => move(layerIndex + 1)}>
        <ArrowUp className="mx-auto mb-1 h-4 w-4" />
        Forward
      </button>
      <button type="button" className={btn} disabled={layerIndex <= 0} onClick={() => move(layerIndex - 1)}>
        <ArrowDown className="mx-auto mb-1 h-4 w-4" />
        Backward
      </button>
      <button type="button" className={btn} disabled={layerIndex >= maxLayer} onClick={() => move(maxLayer)}>
        <ArrowUpToLine className="mx-auto mb-1 h-4 w-4" />
        To front
      </button>
      <button type="button" className={btn} disabled={layerIndex <= 0} onClick={() => move(0)}>
        <ArrowDownToLine className="mx-auto mb-1 h-4 w-4" />
        To back
      </button>
    </motion.div>
  );
}

export function PositionPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<PositionTab>('layers');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={MODAL_OPEN_TRANSITION}
      className="flex flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_12px_48px_rgba(0,0,0,0.14)] ring-1 ring-black/5"
      style={{ width: PANEL_WIDTH }}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <h2 className="text-[15px] font-bold tracking-tight text-gray-900">Position</h2>
        <motion.button
          type="button"
          whileHover={{ scale: 1.08, rotate: 90 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          onClick={onClose}
          aria-label="Close position panel"
        >
          <X className="h-4 w-4" />
        </motion.button>
      </div>

      <div className="flex border-b border-gray-100 px-2">
        <TabButton active={tab === 'arrange'} label="Arrange" onClick={() => setTab('arrange')} />
        <TabButton active={tab === 'layers'} label="Layers" onClick={() => setTab('layers')} />
      </div>

      <div className="flex min-h-0 flex-col p-3">
        <AnimatePresence mode="wait">
          {tab === 'arrange' ? (
            <ArrangeControls key="arrange-tab" />
          ) : (
            <motion.div
              key="layers-tab"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <LayersPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function PositionFloatingPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-[12000] sm:left-4 sm:top-4">
      <AnimatePresence>
        {open && (
          <div className="pointer-events-auto">
            <PositionPanel onClose={onClose} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
