import { describe, expect, it } from 'vitest';
import { ComponentType } from '@invogen/shared';
import { shouldPreserveDesignOverlap } from '../content-overlap';
import { makeElement } from './layout-fixtures';

function textField(id: string, y: number, height: number, value: string) {
  return makeElement({
    id,
    type: ComponentType.FIELD,
    x: 80,
    y,
    width: 220,
    height,
    props: { value, dataKey: 'ClientName', fontSize: 14 },
  });
}

describe('shouldPreserveDesignOverlap — authored overlaps are design', () => {
  it('preserves an ink overlap that live data did not worsen', () => {
    // "Bill To" title box lapping the field below by ~5px — the real case
    // from a production template that used to cascade the column +17px.
    const title = textField('title', 277, 24, 'Bill To');
    const name = textField('name', 296, 36, 'Customer Name');
    const originals = [title, name].map((el) => ({ ...el }));
    expect(shouldPreserveDesignOverlap(title, name, originals)).toBe(true);
  });

  it('pushes when growth made the overlap worse', () => {
    const originalTitle = textField('title', 277, 24, 'Bill To');
    const originalName = textField('name', 296, 36, 'Customer Name');
    // Live data made the title long: box grew 24 → 60 AND its ink now fills
    // the box, colliding through the field below. Overlap went 5px → 41px.
    const grownTitle = {
      ...originalTitle,
      height: 60,
      props: { ...originalTitle.props, value: 'A very long injected client title '.repeat(4) },
    };
    expect(
      shouldPreserveDesignOverlap(grownTitle, originalName, [originalTitle, originalName])
    ).toBe(false);
  });

  it('does not preserve overlaps that did not exist in the authored design', () => {
    const a = textField('a', 100, 24, 'Alpha');
    const b = textField('b', 200, 24, 'Beta');
    // Authored: fully separated. Current: b moved up into a.
    const collidedB = { ...b, y: 110 };
    expect(shouldPreserveDesignOverlap(a, collidedB, [a, b])).toBe(false);
  });
});
