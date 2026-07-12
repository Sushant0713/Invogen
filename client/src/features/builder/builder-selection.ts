import type { CanvasElement, TemplatePage } from '@invogen/shared';

/** Last selected id is treated as the primary (properties panel, inline edit). */
export function getPrimarySelectedId(selectedElementIds: string[]): string | null {
  return selectedElementIds.length > 0
    ? selectedElementIds[selectedElementIds.length - 1]
    : null;
}

export function isElementSelected(selectedElementIds: string[], id: string): boolean {
  return selectedElementIds.includes(id);
}

/** Find the selected element on any page (pagination may move segments off the active tab). */
export function resolveSelectedElementLocation(
  pages: TemplatePage[],
  selectedElementIds: string[]
): { element: CanvasElement; pageIndex: number } | null {
  const primarySelectedId = getPrimarySelectedId(selectedElementIds);
  if (!primarySelectedId) return null;

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const element = pages[pageIndex].elements.find((item) => item.id === primarySelectedId);
    if (element) return { element, pageIndex };
  }

  return null;
}
