const DEFAULT_EMPTY_MAX = 1000;
const DEFAULT_TICK_COUNT = 4;

function getNiceCeiling(value: number): number {
  if (value <= 0) return DEFAULT_EMPTY_MAX;

  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const normalized = value / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 2.5) return 2.5 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

export type ChartYAxisScale = {
  max: number;
  ticks: number[];
};

export function getChartYAxisScale(
  values: number[],
  tickCount = DEFAULT_TICK_COUNT,
): ChartYAxisScale {
  const maxValue = values.length ? Math.max(0, ...values) : 0;
  const niceMax = maxValue === 0 ? DEFAULT_EMPTY_MAX : getNiceCeiling(maxValue * 1.05);
  const step = niceMax / tickCount;
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => index * step);

  return { max: niceMax, ticks };
}
