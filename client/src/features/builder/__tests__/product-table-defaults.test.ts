import { describe, expect, it } from 'vitest';
import { createEmptyRow, type ProductTableColumn } from '../product-table';

describe('table row defaults', () => {
  it('defaults qty cells to 1 by column id', () => {
    const columns: ProductTableColumn[] = [
      { id: 'col_qty', label: 'QTY', widthPx: 60 },
      { id: 'col_rate', label: 'Rate', widthPx: 100 },
    ];
    const row = createEmptyRow(columns, 1);
    expect(row.cells.col_qty).toBe('1');
    expect(row.cells.col_rate).toBe('');
  });

  it('defaults qty cells to 1 by label match (Quantity / Units)', () => {
    const columns: ProductTableColumn[] = [
      { id: 'custom_a', label: 'Quantity', widthPx: 60 },
      { id: 'custom_b', label: 'Units', widthPx: 60 },
      { id: 'custom_c', label: 'Description', widthPx: 200 },
    ];
    const row = createEmptyRow(columns, 1);
    expect(row.cells.custom_a).toBe('1');
    expect(row.cells.custom_b).toBe('1');
    expect(row.cells.custom_c).toBe('');
  });
});
