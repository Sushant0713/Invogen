import { describe, expect, it } from 'vitest';
import { ComponentType } from '@invogen/shared';
import { cloneTemplatePages, prepareInvoiceLivePreviewPages } from '@/features/invoice-composer/invoice-document';
import { applyPreviewPageNumbers } from '@/features/builder/preview-page-reflow';
import { fitOverflowingDataFields } from '@/features/builder/fit-preview-data-fields';
import {
  clampFieldAgainstChrome,
  contentRectsCollide,
  shouldPreserveDesignOverlap,
} from '@/features/builder/layout-policy';
import {
  assertGeometryEqual,
  fixtureBillToTwoColumn,
  fixtureHeaderLogoFields,
  geometryMap,
} from './layout-fixtures';

describe('template preview geometry freeze', () => {
  it('keeps authored Bill To column widths without reflow/fit', () => {
    const authored = fixtureBillToTwoColumn();
    const preview = applyPreviewPageNumbers(cloneTemplatePages(authored));
    assertGeometryEqual(authored, preview, [
      'bill-to-title',
      'billing-address',
      'customer-phone',
      'customer-email',
    ]);
  });

  it('does not crush side-by-side phone width via chrome clamp', () => {
    const pages = fixtureBillToTwoColumn();
    const phone = pages[0].elements.find((el) => el.id === 'customer-phone')!;
    const clamped = clampFieldAgainstChrome(phone, pages[0].elements, 754);
    expect(clamped.x).toBe(phone.x);
    expect(clamped.width).toBe(phone.width);
  });
});

describe('live field fit preserves Bill To columns', () => {
  it('keeps right-column field width after fitOverflowingDataFields', () => {
    const authored = fixtureBillToTwoColumn();
    const original = authored.flatMap((p) => p.elements);
    const fitted = fitOverflowingDataFields(cloneTemplatePages(authored), original);
    const before = geometryMap(authored).get('customer-phone')!;
    const after = geometryMap(fitted).get('customer-phone')!;
    expect(after.width).toBe(before.width);
    expect(after.x).toBe(before.x);
  });
});

describe('content-aware overlap policy', () => {
  it('preserves intentional blank logo overlap when ink clears', () => {
    const pages = fixtureHeaderLogoFields();
    const logo = pages[0].elements.find((el) => el.id === 'logo')!;
    const name = {
      ...pages[0].elements.find((el) => el.id === 'company-name')!,
      props: { label: 'Company Name', value: 'AB', dataKey: 'CompanyName', showIcon: true },
    };
    // showIcon display is value-only; short "AB" stays left of logo at x=220.
    const original = pages[0].elements;
    expect(shouldPreserveDesignOverlap(name, logo, original)).toBe(true);
  });

  it('detects ink collision for long text overlapping logo box', () => {
    const pages = fixtureHeaderLogoFields();
    const logo = pages[0].elements.find((el) => el.id === 'logo')!;
    const name = {
      ...pages[0].elements.find((el) => el.id === 'company-name')!,
      props: {
        label: 'Company Name',
        value: 'Blue Dart Express Logistics Private Limited Worldwide Services',
        dataKey: 'CompanyName',
        showIcon: true,
      },
    };
    expect(contentRectsCollide(name, logo)).toBe(true);
    expect(shouldPreserveDesignOverlap(name, logo, pages[0].elements)).toBe(false);
  });
});

describe('prepareInvoiceLivePreviewPages', () => {
  it('returns pages without crushing Bill To phone column', () => {
    const authored = fixtureBillToTwoColumn();
    const live = prepareInvoiceLivePreviewPages(authored);
    const before = geometryMap(authored).get('customer-phone')!;
    const after = geometryMap(live).get('customer-phone')!;
    expect(after.width).toBeGreaterThanOrEqual(before.width - 1);
    expect(after.x).toBe(before.x);
  });

  it('does not change logo position (fixed chrome)', () => {
    const authored = fixtureHeaderLogoFields();
    const live = prepareInvoiceLivePreviewPages(authored);
    const before = geometryMap(authored).get('logo')!;
    const after = geometryMap(live).get('logo')!;
    expect(after).toEqual(before);
  });

  it('ignores decorative divider as horizontal chrome', () => {
    expect(
      clampFieldAgainstChrome(
        {
          id: 'f',
          type: ComponentType.FIELD,
          x: 420,
          y: 360,
          width: 220,
          height: 36,
          zIndex: 1,
          props: { value: 'test' },
        },
        [
          {
            id: 'd',
            type: ComponentType.DIVIDER,
            x: 500,
            y: 340,
            width: 2,
            height: 100,
            zIndex: 0,
            props: {},
          },
        ],
        754
      ).width
    ).toBe(220);
  });
});
