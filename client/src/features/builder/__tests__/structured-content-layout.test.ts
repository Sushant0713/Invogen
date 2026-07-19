import { describe, expect, it } from 'vitest';
import { ComponentType } from '@invogen/shared';
import {
  estimateStructuredBlockHeight,
  estimateTextBlockHeight,
} from '../structured-content-layout';

/**
 * These heights pin the CSS contract of TermsDisplay / AddressDisplay:
 * line-height 1.45, title margins in em, 3.5em terms number gutter, NO
 * vertical padding, +2px sizer pad. If a display component's CSS changes,
 * these tests must change in lockstep — that is the point.
 */
describe('estimateStructuredBlockHeight — TERMS (mirrors TermsDisplay CSS)', () => {
  const fontSize = 14; // mock char width 7px
  const line = fontSize * 1.45;

  it('single-line title + single-line item', () => {
    const height = estimateStructuredBlockHeight(
      ComponentType.TERMS,
      { fontSize, termsTitle: 'Terms', termsItems: ['Pay now'] },
      320
    );
    // title line + 0.45em margin + max(item line, 1.45em) + 0.2em margin + 2
    const expected = Math.ceil(line + 0.45 * fontSize + line + 0.2 * fontSize + 2);
    expect(height).toBe(Math.max(40, expected));
  });

  it('item wraps inside the 3.5em number gutter width', () => {
    // Item width = 320 - 3.5*14 = 271px → 38 chars per line at 7px.
    // 60 chars → 2 lines.
    const height = estimateStructuredBlockHeight(
      ComponentType.TERMS,
      { fontSize, termsTitle: 'Terms', termsItems: ['x'.repeat(60)] },
      320
    );
    const expected = Math.ceil(line + 0.45 * fontSize + 2 * line + 0.2 * fontSize + 2);
    expect(height).toBe(expected);
  });

  it('blank items are skipped (composer keeps an empty trailing editor row)', () => {
    const withBlank = estimateStructuredBlockHeight(
      ComponentType.TERMS,
      { fontSize, termsTitle: 'Terms', termsItems: ['Pay now', ''] },
      320
    );
    const without = estimateStructuredBlockHeight(
      ComponentType.TERMS,
      { fontSize, termsTitle: 'Terms', termsItems: ['Pay now'] },
      320
    );
    expect(withBlank).toBe(without);
  });
});

describe('estimateStructuredBlockHeight — ADDRESS (mirrors AddressDisplay CSS)', () => {
  const fontSize = 14;
  const line = fontSize * 1.45;

  it('title + two body lines, no phantom padding', () => {
    const height = estimateStructuredBlockHeight(
      ComponentType.ADDRESS,
      {
        fontSize,
        addressTitle: 'Bill To',
        addressLines: ['Street 1'],
        addressCity: 'Mumbai',
        addressState: '',
        addressPostalCode: '',
        addressCountry: '',
      },
      280
    );
    // The body is short — whatever line count formatAddressValue produces,
    // height must be lines*line + title + 0.35em margin + 2, and definitely
    // NOT carry the old +16 padding. Upper bound: 4 lines worth.
    expect(height).toBeLessThanOrEqual(Math.ceil(4 * line + 0.35 * fontSize + 2));
    expect(height).toBeGreaterThanOrEqual(Math.ceil(2 * line));
  });
});

describe('estimateTextBlockHeight', () => {
  it('matches lines * lineHeight + 2px sizer pad — no phantom padding', () => {
    // fontSize 14 (mock char 7px), width 300 → 42 chars/line.
    // Three explicit lines → ceil(3 * 14*1.45 + 2) = 63.
    const height = estimateTextBlockHeight(
      ComponentType.TEXT,
      { fontSize: 14, content: 'one\ntwo\nthree' },
      300
    );
    expect(height).toBe(Math.ceil(3 * 14 * 1.45 + 2));
  });

  it('grows with wrapped lines', () => {
    const short = estimateTextBlockHeight(ComponentType.TEXT, { fontSize: 14, content: 'hi' }, 300);
    const long = estimateTextBlockHeight(
      ComponentType.TEXT,
      { fontSize: 14, content: 'word '.repeat(40).trim() },
      300
    );
    expect(long).toBeGreaterThan(short);
  });

  it('respects explicit px lineHeight', () => {
    const loose = estimateTextBlockHeight(
      ComponentType.TEXT,
      { fontSize: 14, lineHeight: 30, content: 'word '.repeat(40).trim() },
      300
    );
    const tight = estimateTextBlockHeight(
      ComponentType.TEXT,
      { fontSize: 14, lineHeight: 16, content: 'word '.repeat(40).trim() },
      300
    );
    expect(loose).toBeGreaterThan(tight);
  });
});
