import { describe, expect, it } from 'vitest';
import { ComponentType } from '@invogen/shared';
import type { TemplatePage } from '@invogen/shared';
import { reflowPagesForPreview } from '../preview-page-reflow';
import { pagesGeometrySignature } from '../layout-parity-debug';
import { findById, makeElement, makePage } from './layout-fixtures';

const PAGE_HEIGHT = 1123;
const CONTENT_BOTTOM = PAGE_HEIGHT - 40; // bottom margin

function paymentField(y: number) {
  return makeElement({
    id: 'payment',
    type: ComponentType.FIELD,
    x: 80,
    y,
    width: 200,
    height: 40,
    props: { value: 'Payment Details', dataKey: 'PaymentTitle', fontSize: 16 },
  });
}

/** Terms authored at 45px that measures ~72px (mock canvas), so it grows +27. */
function growingTerms(y: number) {
  return makeElement({
    id: 'terms',
    type: ComponentType.TERMS,
    x: 400,
    y,
    width: 320,
    height: 45,
    props: { fontSize: 14, termsTitle: 'Terms', termsItems: ['x'.repeat(60)] },
  });
}

describe('reflowPagesForPreview — invariants', () => {
  it('is idempotent: laying out its own output changes nothing', () => {
    const pages: TemplatePage[] = [
      makePage([
        paymentField(690),
        growingTerms(720),
        makeElement({
          id: 'below',
          type: ComponentType.TEXT,
          x: 80,
          y: 820,
          width: 640,
          height: 30,
          props: { content: 'Next section', fontSize: 14 },
        }),
        makeElement({
          id: 'footer',
          type: ComponentType.FOOTER,
          x: 140,
          y: 1058,
          width: 300,
          height: 25,
          props: { content: 'Thank you' },
        }),
      ]),
    ];

    const once = reflowPagesForPreview(pages);
    const twice = reflowPagesForPreview(once);
    expect(pagesGeometrySignature(twice)).toBe(pagesGeometrySignature(once));
  });

  it('keeps a staggered two-column row top-aligned when the right column grows', () => {
    // Payment (left, y=690) | Terms (right, y=720): 30px stagger — past the
    // 24px same-row tolerance, but vertically overlapping. Terms grows +27.
    const pages: TemplatePage[] = [
      makePage([
        paymentField(690),
        growingTerms(720),
        makeElement({
          id: 'below',
          type: ComponentType.TEXT,
          x: 80,
          y: 790,
          width: 640,
          height: 30,
          props: { content: 'Next section', fontSize: 14 },
        }),
      ]),
    ];

    const result = reflowPagesForPreview(pages);
    const payment = findById(result, 'payment')!;
    const terms = findById(result, 'terms')!;
    const below = findById(result, 'below')!;

    // Row-mate must NOT move; only the next section moves below the row.
    expect(payment.y).toBe(690);
    expect(terms.height).toBeGreaterThan(45);
    expect(below.y).toBeGreaterThanOrEqual(terms.y + terms.height);
  });

  it('pushes a signature below grown terms instead of leaving it fixed', () => {
    const pages: TemplatePage[] = [
      makePage([
        growingTerms(700),
        makeElement({
          id: 'sig',
          type: ComponentType.SIGNATURE,
          x: 420,
          y: 760,
          width: 150,
          height: 50,
          props: { src: '' },
        }),
      ]),
    ];

    const result = reflowPagesForPreview(pages);
    const terms = findById(result, 'terms')!;
    const sig = findById(result, 'sig')!;
    expect(sig.y).toBeGreaterThanOrEqual(terms.y + terms.height);
  });

  it('keeps a footer that is authored on page 2 only (footer master ≠ page 1)', () => {
    const pages: TemplatePage[] = [
      makePage([
        makeElement({
          id: 'body1',
          type: ComponentType.TEXT,
          x: 80,
          y: 100,
          width: 400,
          height: 30,
          props: { content: 'Page one body', fontSize: 14 },
        }),
      ]),
      makePage(
        [
          makeElement({
            id: 'body2',
            type: ComponentType.TEXT,
            x: 80,
            y: 60,
            width: 400,
            height: 30,
            props: { content: 'Spilled body', fontSize: 14 },
          }),
          makeElement({
            id: 'footer2',
            type: ComponentType.FOOTER,
            x: 140,
            y: 1058,
            width: 300,
            height: 25,
            props: { content: 'Thank you' },
          }),
        ],
        { userAuthored: false }
      ),
    ];

    const result = reflowPagesForPreview(pages);
    // Every result page carries the footer, positioned in the bottom band.
    for (const page of result) {
      const footer = page.elements.find((el) => el.type === ComponentType.FOOTER);
      expect(footer, `footer missing on ${page.name}`).toBeTruthy();
      expect(footer!.y).toBeGreaterThanOrEqual(1000);
      expect(footer!.y + footer!.height).toBeLessThanOrEqual(CONTENT_BOTTOM + 2);
    }
  });

  it('spills content past the page bottom to a new page instead of clipping', () => {
    // 60-line text block (~1234px) cannot fit any single page (content area
    // is 1043px) — it MUST split across pages. A shorter block would simply
    // be compacted upward by the document-flow restack, which is fine.
    const longContent = Array.from({ length: 60 }, (_, i) => `line number ${i}`).join('\n');
    const pages: TemplatePage[] = [
      makePage([
        makeElement({
          id: 'tall',
          type: ComponentType.TEXT,
          x: 80,
          y: 950,
          width: 300,
          height: 200,
          props: { content: longContent, fontSize: 14 },
        }),
      ]),
    ];

    const result = reflowPagesForPreview(pages);
    expect(result.length).toBeGreaterThanOrEqual(2);
    // Nothing (except band-positioned footers) may extend past the content bottom.
    for (const page of result) {
      for (const el of page.elements) {
        if (el.visible === false || el.type === ComponentType.FOOTER) continue;
        expect(
          el.y + el.height,
          `${el.type}#${el.id} extends past page bottom on ${page.name}`
        ).toBeLessThanOrEqual(CONTENT_BOTTOM + 3);
      }
    }
  });

  it('does not move elements on an already-fitting page with no growth', () => {
    const pages: TemplatePage[] = [
      makePage([
        makeElement({
          id: 'a',
          type: ComponentType.TEXT,
          x: 80,
          y: 100,
          width: 300,
          height: 30,
          props: { content: 'Short', fontSize: 14 },
        }),
        makeElement({
          id: 'b',
          type: ComponentType.TEXT,
          x: 80,
          y: 200,
          width: 300,
          height: 30,
          props: { content: 'Also short', fontSize: 14 },
        }),
      ]),
    ];
    const result = reflowPagesForPreview(pages);
    expect(findById(result, 'a')!.y).toBe(100);
    expect(findById(result, 'b')!.y).toBe(200);
  });
});
