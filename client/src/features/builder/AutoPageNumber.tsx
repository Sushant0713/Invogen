import { ComponentType } from '@invogen/shared';
import type { CanvasElement } from '@invogen/shared';
import { cn } from '@/lib/utils';

interface AutoPageNumberProps {
  pageIndex: number;
  /** Optional total — when > 1, shows "Page 1 of 3"; otherwise "Page 1". */
  pageCount?: number;
  /** When the template already has a Page no field, skip the automatic label. */
  elements?: CanvasElement[];
  className?: string;
}

function pageHasManualPageNumber(elements: CanvasElement[] | undefined): boolean {
  if (!elements?.length) return false;
  return elements.some(
    (el) => el.type === ComponentType.PAGE_NUMBER && el.visible !== false
  );
}

/**
 * Printable page number in the bottom-right corner of a template page.
 * Shown automatically in the builder canvas and live preview / PDF export.
 */
export function AutoPageNumber({
  pageIndex,
  pageCount = 1,
  elements,
  className,
}: AutoPageNumberProps) {
  if (pageHasManualPageNumber(elements)) return null;

  const n = Math.max(1, pageIndex + 1);
  const total = Math.max(1, pageCount);
  const label = total > 1 ? `Page ${n} of ${total}` : `Page ${n}`;

  return (
    <div
      className={cn(
        'pointer-events-none absolute bottom-5 right-6 z-[9998] select-none',
        className
      )}
      data-auto-page-number="true"
      aria-hidden
    >
      <div className="flex items-center gap-2">
        <span className="h-3 w-px bg-gray-300/90" aria-hidden />
        <p className="text-[11px] font-medium tracking-wide text-gray-500">
          <span className="text-gray-400">Page </span>
          <span className="tabular-nums font-semibold text-gray-700">{n}</span>
          {total > 1 ? (
            <>
              <span className="text-gray-300"> of </span>
              <span className="tabular-nums text-gray-500">{total}</span>
            </>
          ) : null}
        </p>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
