import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';

const A4 = { width: 794, height: 1123 };
const margins = { top: 40, right: 40, bottom: 40, left: 40 };

function el(
  partial: Omit<CanvasElement, 'zIndex'> & { zIndex?: number }
): CanvasElement {
  return { zIndex: 1, ...partial };
}

/** Two-column Bill To — left labels, right phone/email that must keep authored width. */
export function fixtureBillToTwoColumn(): TemplatePage[] {
  return [
    {
      id: 'page-1',
      name: 'Page 1',
      margins: { ...margins },
      pageSize: { ...A4 },
      elements: [
        el({
          id: 'bill-to-title',
          type: ComponentType.FIELD,
          x: 50,
          y: 320,
          width: 200,
          height: 28,
          props: { label: 'Bill To', value: 'Acme Corp', dataKey: 'CustomerName' },
        }),
        el({
          id: 'billing-address',
          type: ComponentType.FIELD,
          x: 50,
          y: 360,
          width: 280,
          height: 72,
          props: {
            label: 'Billing Address',
            value: '123 Main Street\nSuite 100\nMumbai',
            dataKey: 'CustomerAddress',
            multiline: true,
            showIcon: true,
            iconKey: 'address',
          },
        }),
        el({
          id: 'customer-phone',
          type: ComponentType.FIELD,
          x: 420,
          y: 360,
          width: 220,
          height: 36,
          props: {
            label: 'Phone',
            value: '9876543210',
            dataKey: 'Phone',
            showIcon: true,
            iconKey: 'phone',
          },
        }),
        el({
          id: 'customer-email',
          type: ComponentType.FIELD,
          x: 420,
          y: 410,
          width: 220,
          height: 36,
          props: {
            label: 'Email',
            value: 'ops@acme.example.com',
            dataKey: 'Email',
            showIcon: true,
            iconKey: 'email',
          },
        }),
        el({
          id: 'divider',
          type: ComponentType.DIVIDER,
          x: 400,
          y: 340,
          width: 2,
          height: 140,
          props: { thickness: 1, color: '#1e3a8a' },
        }),
      ],
    },
  ];
}

/** Header with logo overlapping blank field padding — intentional design overlap. */
export function fixtureHeaderLogoFields(): TemplatePage[] {
  return [
    {
      id: 'page-1',
      name: 'Page 1',
      margins: { ...margins },
      pageSize: { ...A4 },
      elements: [
        el({
          id: 'logo',
          type: ComponentType.LOGO,
          x: 220,
          y: 40,
          width: 120,
          height: 60,
          props: {},
        }),
        el({
          id: 'company-name',
          type: ComponentType.FIELD,
          // Wide box intentionally overlaps logo; short sample text stays left of logo ink.
          x: 50,
          y: 50,
          width: 280,
          height: 36,
          props: { label: 'Company Name', value: 'Blue Dart Express', dataKey: 'CompanyName' },
        }),
        el({
          id: 'company-phone',
          type: ComponentType.FIELD,
          x: 50,
          y: 120,
          width: 240,
          height: 36,
          props: {
            label: 'Phone',
            value: '+91 22 1234 5678',
            dataKey: 'CompanyPhone',
            showIcon: true,
            iconKey: 'phone',
          },
        }),
        el({
          id: 'invoice-title',
          type: ComponentType.HEADING,
          x: 520,
          y: 40,
          width: 220,
          height: 40,
          props: { content: 'Tax Invoice', fontSize: 28, color: '#1e3a8a' },
        }),
      ],
    },
  ];
}

/** Minimal product table that can grow with many rows. */
export function fixtureGrowingTable(): TemplatePage[] {
  const rows = Array.from({ length: 18 }, (_, i) => ({
    id: `row-${i}`,
    cells: {
      sr: String(i + 1),
      product: `Item ${i + 1}`,
      qty: '1',
      rate: '100',
      total: '100',
    },
    heightPx: 32,
  }));

  return [
    {
      id: 'page-1',
      name: 'Page 1',
      margins: { ...margins },
      pageSize: { ...A4 },
      elements: [
        el({
          id: 'products',
          type: ComponentType.PRODUCT_TABLE,
          x: 50,
          y: 200,
          width: 694,
          height: 150,
          props: {
            columns: [
              { id: 'sr', label: 'Sr', width: 50 },
              { id: 'product', label: 'Product', width: 280 },
              { id: 'qty', label: 'Qty', width: 60 },
              { id: 'rate', label: 'Rate', width: 80 },
              { id: 'total', label: 'Total', width: 100 },
            ],
            rows,
            headerHeightPx: 32,
            borderWidth: 1,
          },
        }),
        el({
          id: 'totals',
          type: ComponentType.FIELD,
          x: 540,
          y: 380,
          width: 200,
          height: 28,
          props: { label: 'TOTAL', value: '1800', dataKey: 'GrandTotal' },
        }),
      ],
    },
  ];
}

export function geometryMap(pages: TemplatePage[]): Map<string, { x: number; y: number; width: number; height: number }> {
  const map = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const page of pages) {
    for (const element of page.elements) {
      map.set(element.id, {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
      });
    }
  }
  return map;
}

export function assertGeometryEqual(
  a: TemplatePage[],
  b: TemplatePage[],
  ids?: string[]
): void {
  const left = geometryMap(a);
  const right = geometryMap(b);
  const checkIds = ids ?? [...left.keys()];
  for (const id of checkIds) {
    const la = left.get(id);
    const rb = right.get(id);
    if (!la || !rb) throw new Error(`Missing element ${id}`);
    if (la.x !== rb.x || la.y !== rb.y || la.width !== rb.width || la.height !== rb.height) {
      throw new Error(
        `Geometry mismatch for ${id}: ${JSON.stringify(la)} vs ${JSON.stringify(rb)}`
      );
    }
  }
}
