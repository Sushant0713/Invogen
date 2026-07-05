export function PageLayerRow() {
  return (
    <div className="flex h-14 items-center gap-1.5 rounded-xl bg-[#ededed] px-1.5">
      <div className="w-8 shrink-0" />
      <div className="flex h-9 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200/50 bg-white">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: 'radial-gradient(circle, #c4c8cc 1px, transparent 1px)',
            backgroundSize: '7px 7px',
          }}
        />
      </div>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-500">Page</span>
      <div className="flex w-14 shrink-0 items-center justify-end pr-1">
        <svg width="16" height="16" viewBox="0 0 16 16" className="text-gray-400" aria-hidden>
          <rect x="2" y="2" width="12" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M2 14L14 2" stroke="currentColor" strokeWidth="1" />
          <path d="M6 14L14 6" stroke="currentColor" strokeWidth="1" />
          <path d="M10 14L14 10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}
