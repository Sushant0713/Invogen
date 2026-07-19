import { describe, expect, it } from 'vitest';
import { ComponentType } from '@invogen/shared';
import type { TemplatePage } from '@invogen/shared';
import { fitOverflowingDataFields } from '../fit-preview-data-fields';
import { findById, makeElement, makePage } from './layout-fixtures';

function field(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  value: string
) {
  return makeElement({
    id,
    type: ComponentType.FIELD,
    x,
    y,
    width: w,
    height: h,
    props: { value, dataKey: id, fontSize: 14 },
  });
}

describe('fitOverflowingDataFields — grown fields push whole rows, not columns', () => {
  it('carries the push across columns via full-width elements', () => {
    // Replicates the live bug: a company-address field (left column) grows;
    // the divider below spans both columns; under it sits a two-column row
    // (customer name | billing address) with the email tucked BESIDE the
    // billing block. Everything below the grown field must shift by ONE
    // delta — previously the right column stayed put, tearing the row.
    const sixLines = 'Suryanagar\nLine two\nLine three\nLine four\nLine five\nIndia 400059';
    const authored: TemplatePage[] = [
      makePage([
        field('address', 60, 133, 350, 24, sixLines), // grows ~24 → ~122
        field('phone', 65, 155, 220, 36, '+91 98765 43210'),
        makeElement({
          id: 'divider',
          type: ComponentType.DIVIDER,
          x: 90,
          y: 233,
          width: 620,
          height: 24,
          props: {},
        }),
        field('name', 65, 272, 220, 36, 'Customer Name'),
        field('billing', 430, 277, 250, 84, 'Billing Address\nCity, State\nCountry'),
        field('email', 65, 303, 230, 36, 'customer@email.com'),
      ]),
    ];
    const originals = authored.flatMap((p) => p.elements.map((el) => ({ ...el })));

    const result = fitOverflowingDataFields(authored, originals);

    const address = findById(result, 'address')!;
    const phone = findById(result, 'phone')!;
    const divider = findById(result, 'divider')!;
    const name = findById(result, 'name')!;
    const billing = findById(result, 'billing')!;
    const email = findById(result, 'email')!;

    expect(address.height).toBeGreaterThan(24);

    const dPhone = phone.y - 155;
    expect(dPhone).toBeGreaterThan(0);
    // One delta for the whole region — including the right-column billing
    // block (reached transitively through the full-width divider).
    expect(divider.y - 233).toBe(dPhone);
    expect(name.y - 272).toBe(dPhone);
    expect(billing.y - 277).toBe(dPhone);
    expect(email.y - 303).toBe(dPhone);

    // The authored side-by-side tuck (email beside billing) is intact.
    expect(email.y - billing.y).toBe(303 - 277);
  });

  it('does not drag elements beside the grown field itself', () => {
    // Right-column header meta sits BESIDE the growing address (starts above
    // the first pushed element) — it must not move.
    const authored: TemplatePage[] = [
      makePage([
        field('address', 60, 133, 350, 24, 'a\nb\nc\nd\ne\nf'),
        field('due', 465, 152, 200, 31, 'Due: 02 Aug'),
        field('phone', 65, 155, 220, 36, '+91 98765 43210'),
      ]),
    ];
    const originals = authored.flatMap((p) => p.elements.map((el) => ({ ...el })));
    const result = fitOverflowingDataFields(authored, originals);

    expect(findById(result, 'phone')!.y).toBeGreaterThan(155);
    expect(findById(result, 'due')!.y).toBe(152);
  });
});
