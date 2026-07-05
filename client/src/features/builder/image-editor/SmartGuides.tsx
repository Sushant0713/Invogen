import type { SnapGuide } from './types';

interface Props {
  guides: SnapGuide[];
}

export function SmartGuides({ guides }: Props) {
  if (!guides.length) return null;

  return (
    <>
      {guides.map((guide, i) =>
        guide.orientation === 'vertical' ? (
          <div
            key={`v-${guide.position}-${i}`}
            className="pointer-events-none absolute top-0 z-[9997] w-px bg-pink-500"
            style={{ left: guide.position, height: '100%' }}
          />
        ) : (
          <div
            key={`h-${guide.position}-${i}`}
            className="pointer-events-none absolute left-0 z-[9997] h-px bg-pink-500"
            style={{ top: guide.position, width: '100%' }}
          />
        )
      )}
    </>
  );
}
