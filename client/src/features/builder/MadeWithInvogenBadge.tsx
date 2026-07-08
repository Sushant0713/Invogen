import { useMadeWithInvogen } from './MadeWithInvogenProvider';

/**
 * Bottom-right "Made with Invogen" advertisement badge.
 * Sized in page pixels so it stays readable when the page is CSS-scaled.
 */
export function MadeWithInvogenBadge({
  compact = false,
}: {
  /** Smaller chip for gallery thumbnails. */
  compact?: boolean;
}) {
  const { show, name, logoUrl } = useMadeWithInvogen();
  if (!show) return null;

  const brand = name || 'Invogen';

  if (compact) {
    return (
      <div
        className="pointer-events-none absolute bottom-1.5 right-1.5 z-[9999] flex max-w-[90%] items-center gap-1 rounded bg-white/95 px-1.5 py-0.5 shadow-sm ring-1 ring-black/10"
        data-made-with-invogen="true"
        aria-hidden
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="h-3 w-3 shrink-0 object-contain"
            draggable={false}
          />
        ) : (
          <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded bg-slate-800 text-[7px] font-bold text-white">
            {brand.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="truncate text-[9px] font-medium leading-none text-slate-700">
          Made with {brand}
        </span>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute bottom-4 right-4 z-[9999] flex items-center gap-2 rounded-lg bg-white/95 px-2.5 py-1.5 shadow-md ring-1 ring-black/10"
      data-made-with-invogen="true"
      style={{ fontSize: 11 }}
      aria-hidden
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className="h-5 w-5 shrink-0 object-contain"
          draggable={false}
        />
      ) : (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-800 text-[10px] font-bold text-white">
          {brand.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="whitespace-nowrap font-medium leading-none text-slate-700">
        Made with {brand}
      </span>
    </div>
  );
}
