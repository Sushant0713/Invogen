import { motion } from 'framer-motion';
import { DROP_SPRING } from './constants';
import type { LayerFilter } from './LayerFilterSegment';

interface Props {
  value: LayerFilter;
  onChange: (value: LayerFilter) => void;
}

const OPTIONS: { id: LayerFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'overlapping', label: 'Overlapping' },
];

export function LayerFilterSegment({ value, onChange }: Props) {
  const activeIndex = value === 'all' ? 0 : 1;

  return (
    <div
      className="relative flex rounded-full bg-[#ededed] p-1"
      role="tablist"
      aria-label="Layer filter"
    >
      <motion.div
        layoutId="layer-filter-pill"
        className="absolute top-1 bottom-1 rounded-full bg-white shadow-sm"
        style={{ width: 'calc(50% - 4px)' }}
        animate={{ left: activeIndex === 0 ? 4 : 'calc(50% + 0px)' }}
        transition={DROP_SPRING}
        aria-hidden
      />
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          className={`relative z-10 flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === opt.id ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
