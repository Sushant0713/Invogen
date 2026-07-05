/** Last selected id is treated as the primary (properties panel, inline edit). */
export function getPrimarySelectedId(selectedElementIds: string[]): string | null {
  return selectedElementIds.length > 0
    ? selectedElementIds[selectedElementIds.length - 1]
    : null;
}

export function isElementSelected(selectedElementIds: string[], id: string): boolean {
  return selectedElementIds.includes(id);
}
