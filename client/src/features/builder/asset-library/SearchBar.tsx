import { Search, X } from 'lucide-react';
import { setSidebarSearch } from './sidebar-store';

interface SearchBarProps {
  value: string;
}

export function SearchBar({ value }: SearchBarProps) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
      <input
        type="search"
        value={value}
        onChange={(e) => setSidebarSearch(e.target.value)}
        placeholder="Search assets…"
        className="w-full rounded-xl border border-gray-200 bg-gray-50/80 py-2.5 pl-9 pr-9 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/15 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-primary/40 dark:focus:bg-gray-800"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setSidebarSearch('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-gray-400 hover:bg-gray-200/60 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
