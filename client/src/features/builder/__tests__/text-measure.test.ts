import { describe, expect, it } from 'vitest';
import { canMeasureText, countWrappedLines, measureTextWidth } from '../text-measure';

// Mock canvas (vitest.setup.ts): char width = fontSize * 0.5 px.
const FONT = { fontSize: 10 }; // → 5px per char

describe('text-measure (mock canvas: char = fontSize/2 px)', () => {
  it('uses the mocked canvas context', () => {
    expect(canMeasureText()).toBe(true);
    expect(measureTextWidth('abcd', FONT)).toBe(20);
  });

  it('counts a fitting line as 1', () => {
    expect(countWrappedLines('hello', FONT, 100)).toBe(1);
  });

  it('wraps at word boundaries like the browser greedy breaker', () => {
    // 'aaaa bbbb' = 45px fits at 45; ' cccc' overflows → 2 lines.
    expect(countWrappedLines('aaaa bbbb cccc', FONT, 45)).toBe(2);
  });

  it('breaks an unbreakable word char-by-char (word-break: break-word)', () => {
    // 30 chars * 5px = 150px at width 50 → 10 chars per line → 3 lines.
    expect(countWrappedLines('a'.repeat(30), FONT, 50)).toBe(3);
  });

  it('counts blank paragraphs as lines (pre-wrap)', () => {
    expect(countWrappedLines('a\n\nb', FONT, 100)).toBe(3);
  });

  it('returns 0 for empty text', () => {
    expect(countWrappedLines('', FONT, 100)).toBe(0);
  });

  it('is deterministic across repeated calls (cache)', () => {
    const first = countWrappedLines('repeatable text with words', FONT, 60);
    const second = countWrappedLines('repeatable text with words', FONT, 60);
    expect(second).toBe(first);
  });

  it('wider fonts wrap sooner', () => {
    const narrow = countWrappedLines('word '.repeat(10).trim(), { fontSize: 10 }, 100);
    const wide = countWrappedLines('word '.repeat(10).trim(), { fontSize: 20 }, 100);
    expect(wide).toBeGreaterThan(narrow);
  });
});
