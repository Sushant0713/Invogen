import { describe, expect, it } from 'vitest';
import { ComponentType } from '@invogen/shared';
import type { CanvasElement } from '@invogen/shared';
import {
  shouldPushRelatedElement,
  buildLayoutIntentProps,
  getElementOverflowPolicy,
} from '../layout-intent';
import { detectLayoutWarnings, applyStressDataToElements } from '../layout-warnings';
import { fixtureBillToTwoColumn } from './layout-fixtures';

function field(
  id: string,
  y: number,
  props: Record<string, unknown> = {}
): CanvasElement {
  return {
    id,
    type: ComponentType.FIELD,
    x: 50,
    y,
    width: 200,
    height: 36,
    zIndex: 1,
    props: { label: id, value: 'x', ...props },
  };
}

describe('layout intent flow groups', () => {
  it('pushes only same flow group when both are grouped', () => {
    const address = field('a', 100, { flowGroupId: 'bill-to' });
    const phone = field('p', 150, { flowGroupId: 'bill-to' });
    const payment = field('pay', 200, { flowGroupId: 'payment' });
    expect(shouldPushRelatedElement(address, phone)).toBe(true);
    expect(shouldPushRelatedElement(address, payment)).toBe(false);
  });

  it('does not push ungrouped neighbors when the growing element is grouped', () => {
    const address = field('a', 100, { flowGroupId: 'bill-to' });
    const title = field('t', 40, {});
    expect(shouldPushRelatedElement(address, title)).toBe(false);
  });

  it('respects allowOverlap collision policy', () => {
    const a = field('a', 100);
    const b = field('b', 120, { collisionPolicy: 'allowOverlap' });
    expect(shouldPushRelatedElement(a, b)).toBe(false);
  });

  it('maps fixed layout mode to fixedInFlow', () => {
    const props = buildLayoutIntentProps({ layoutMode: 'fixed' });
    expect(props.fixedInFlow).toBe(true);
    expect(props.layoutMode).toBe('fixed');
  });
});

describe('layout warnings + stress data', () => {
  it('flags text overflow under long stress data', () => {
    const pages = fixtureBillToTwoColumn();
    const stressed = {
      ...pages[0],
      elements: applyStressDataToElements(pages[0].elements).map((el) =>
        el.id === 'customer-email' ? { ...el, width: 40, height: 20 } : el
      ),
    };
    const warnings = detectLayoutWarnings(stressed, { stress: false });
    expect(warnings.some((w) => w.kind === 'text_overflow')).toBe(true);
  });

  it('defaults overflow policy to wrapGrow', () => {
    expect(getElementOverflowPolicy(field('x', 0))).toBe('wrapGrow');
  });
});
