import { useMadeWithInvogen } from './MadeWithInvogenProvider';

/**
 * "Made with" advertisement badge (super-admin image replaces brand name).
 * Bottom-left so it never collides with the auto page number (bottom-right).
 */
export function MadeWithInvogenBadge({
  compact = false,
}: {
  /** Smaller chip for gallery thumbnails. */
  compact?: boolean;
}) {
  const { show, imageUrl } = useMadeWithInvogen();
  if (!show || !imageUrl) return null;

  if (compact) {
    return (
      <div
        className="pointer-events-none absolute bottom-1.5 left-1.5 z-[9999] flex max-w-[92%] items-center gap-1 rounded bg-white/95 px-1.5 py-0.5 shadow-sm ring-1 ring-black/10"
        data-made-with-invogen="true"
        aria-hidden
      >
        <span className="shrink-0 text-[9px] font-medium leading-none text-slate-600">
          Made with
        </span>
        <img
          src={imageUrl}
          alt=""
          className="h-3.5 max-w-[72px] shrink object-contain object-left"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute bottom-2 left-3 z-[9999] flex items-center gap-2 rounded-lg bg-white/95 px-2.5 py-1.5 shadow-md ring-1 ring-black/10"
      data-made-with-invogen="true"
      aria-hidden
    >
      <span className="shrink-0 text-[11px] font-medium leading-none text-slate-600">
        Made with
      </span>
      <img
        src={imageUrl}
        alt=""
        className="h-5 max-w-[120px] shrink object-contain object-left"
        draggable={false}
      />
    </div>
  );
}
