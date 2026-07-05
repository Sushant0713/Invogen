import { useLayoutEffect, useRef, type ReactNode } from 'react';

const HEIGHT_PAD = 2;
const MIN_HEIGHT = 24;

interface Props {
  children: ReactNode;
  elementHeight: number;
  measureKey: string;
  onHeightChange?: (height: number) => void;
  disabled?: boolean;
}

export function StructuredContentSizer({
  children,
  elementHeight,
  measureKey,
  onHeightChange,
  disabled,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastReportedRef = useRef(elementHeight);

  useLayoutEffect(() => {
    lastReportedRef.current = elementHeight;
  }, [elementHeight]);

  useLayoutEffect(() => {
    if (disabled || !onHeightChange) return;
    const node = ref.current;
    if (!node) return;

    const report = () => {
      const measured = Math.max(MIN_HEIGHT, Math.ceil(node.getBoundingClientRect().height + HEIGHT_PAD));
      if (Math.abs(measured - lastReportedRef.current) <= 1) return;
      lastReportedRef.current = measured;
      onHeightChange(measured);
    };

    report();
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(report);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [disabled, onHeightChange, measureKey]);

  return (
    <div ref={ref} className="w-full">
      {children}
    </div>
  );
}
