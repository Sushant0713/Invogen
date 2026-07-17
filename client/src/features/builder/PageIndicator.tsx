import { cn } from '@/lib/utils';

interface PageIndicatorProps {
  pageIndex: number;
  pageCount: number;
  /** Compact chip under/above a page preview. */
  variant?: 'chip' | 'bar';
  className?: string;
}

/** Non-print chrome: shows which page you’re on (builder / live preview). */
export function PageIndicator({
  pageIndex,
  pageCount,
  variant = 'chip',
  className,
}: PageIndicatorProps) {
  const n = pageIndex + 1;
  const total = Math.max(1, pageCount);

  if (variant === 'bar') {
    return (
      <div
        className={cn(
          'pointer-events-none flex items-center justify-center gap-2 text-[11px] font-medium tracking-wide text-gray-500',
          className
        )}
        aria-label={`Page ${n} of ${total}`}
      >
        <span className="h-px w-6 bg-gray-300" />
        <span className="rounded-full bg-white/90 px-2.5 py-0.5 shadow-sm ring-1 ring-gray-200/80">
          Page <span className="tabular-nums text-gray-800">{n}</span>
          <span className="text-gray-400"> / </span>
          <span className="tabular-nums">{total}</span>
        </span>
        <span className="h-px w-6 bg-gray-300" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-gray-900/90 px-3 py-1 text-[11px] font-semibold tracking-wide text-white shadow-md backdrop-blur-sm',
        className
      )}
      aria-label={`Page ${n} of ${total}`}
    >
      <span className="opacity-70">Page</span>
      <span className="tabular-nums">{n}</span>
      <span className="opacity-40">of</span>
      <span className="tabular-nums opacity-80">{total}</span>
    </div>
  );
}
