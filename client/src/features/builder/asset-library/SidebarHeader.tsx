import { Layers } from 'lucide-react';

export function SidebarHeader() {
  return (
    <div className="flex items-center gap-2.5 px-1 pb-1">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Layers className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Asset Library</h2>
        <p className="text-[10px] text-gray-500 dark:text-gray-400">Drag, click, or double-click to add</p>
      </div>
    </div>
  );
}
