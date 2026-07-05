import { ChevronDown } from 'lucide-react';

interface CategoryHeaderProps {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}

export function CategoryHeader({ label, count, collapsed, onToggle }: CategoryHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
        <span className="ml-1.5 font-normal text-gray-400 dark:text-gray-500">({count})</span>
      </span>
      <ChevronDown
        className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
      />
    </button>
  );
}
