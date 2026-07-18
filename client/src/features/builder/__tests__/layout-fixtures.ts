import type { CanvasElement, TemplatePage } from '@invogen/shared';

let counter = 0;

/** A4 page with 40px margins — the app default. */
export function makePage(
  elements: CanvasElement[],
  overrides: Partial<TemplatePage> = {}
): TemplatePage {
  counter += 1;
  return {
    id: overrides.id ?? `page-${counter}`,
    name: overrides.name ?? `Page ${counter}`,
    margins: { top: 40, right: 40, bottom: 40, left: 40 },
    elements,
    ...overrides,
  };
}

export function makeElement(
  partial: Partial<CanvasElement> & Pick<CanvasElement, 'id' | 'type'>
): CanvasElement {
  return {
    x: 40,
    y: 40,
    width: 200,
    height: 40,
    zIndex: 1,
    ...partial,
    props: { ...(partial.props ?? {}) },
  };
}

export function findById(pages: TemplatePage[], id: string): CanvasElement | undefined {
  for (const page of pages) {
    const hit = page.elements.find((el) => el.id === id);
    if (hit) return hit;
  }
  return undefined;
}

export function pageIndexOf(pages: TemplatePage[], id: string): number {
  return pages.findIndex((page) => page.elements.some((el) => el.id === id));
}
