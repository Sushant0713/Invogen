import { describe, expect, it } from 'vitest';
import { ComponentType } from '@invogen/shared';
import { tablePropsNeedDocumentLayout } from '../table-props-normalize';
import { normalizeInvoiceTable3Props, productTablePropsToRecord } from '../invoice-table-3';

function invoice3Props(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...productTablePropsToRecord(normalizeInvoiceTable3Props({})),
    ...overrides,
  };
}

describe('tablePropsNeedDocumentLayout — height-affecting toggles need layout', () => {
  it('amount-in-words toggle changes computed height → layout required', () => {
    const on = invoice3Props({ showAmountInWords: true, showTotalFooter: true });
    const off = invoice3Props({ showAmountInWords: false, showTotalFooter: true });
    expect(
      tablePropsNeedDocumentLayout(ComponentType.INVOICE_TABLE_3, on, off)
    ).toBe(true);
    expect(
      tablePropsNeedDocumentLayout(ComponentType.INVOICE_TABLE_3, off, on)
    ).toBe(true);
  });

  it('total footer toggle → layout required', () => {
    const on = invoice3Props({ showTotalFooter: true });
    const off = invoice3Props({ showTotalFooter: false });
    expect(
      tablePropsNeedDocumentLayout(ComponentType.INVOICE_TABLE_3, on, off)
    ).toBe(true);
  });

  it('cosmetic changes (color, border) do not force layout', () => {
    const base = invoice3Props({ tableColor: '#000000' });
    const recolored = invoice3Props({ tableColor: '#ff0000' });
    expect(
      tablePropsNeedDocumentLayout(ComponentType.INVOICE_TABLE_3, base, recolored)
    ).toBe(false);
  });
});
