export function LayerDragDots({ className = '' }: { className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="h-[3px] w-[3px] rounded-full bg-gray-500/70" />
      ))}
    </div>
  );
}
