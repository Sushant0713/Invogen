import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { v4 as uuidv4 } from 'uuid';
import {
  isTableElementType,
  mergeTablePaginationProps,
  productTablePropsToRecord,
  isSameTableCell,
  resolveBuilderTablePropsForEdit,
  syncPaginatedTableRowsAcrossSegments,
  resolvePaginationTableId,
  isTableContinuationSegment,
  collectConnectedTableElementIds,
} from '@/features/builder/product-table';
import {
  clampTableElementToPage,
  fitTableHeightsPreservingWidths,
} from '@/features/builder/table-element-size';
import { normalizeTablePropsForType, tablePropsNeedDocumentLayout } from '@/features/builder/table-props-normalize';
import { getPageDimensions, PAGE_WIDTH, PAGE_HEIGHT } from '@/features/builder/builder-dnd';
import { getPrimarySelectedId } from '@/features/builder/builder-selection';
import { getNextZIndex, normalizeElementLayers, reorderElementLayer, reorderPageElements } from '@/features/builder/element-layers';
import { applyClipToElementBounds, shouldBakeShapeClipOnApply } from '@/features/builder/shape-clip';
import { layoutBuilderPages, touchLogicalFlowY, normalizeBuilderPagesForEditor, applyContinuationTableStructuralEdit, absorbPaginationAfterPageDelete } from '@/features/builder/document-layout';
import {
  appendFootersFromMasterPage,
  collectLinkedFooterElementIds,
  isDocumentFooterElement,
  normalizeDocumentFooters,
  prepareNewFooterElement,
  syncSharedFooterAcrossPages,
} from '@/features/builder/document-footer';
import { enforceInvoiceDueDateOrderOnPages } from '@/features/builder/invoice-date-order';

export interface SelectedTableCell {
  elementId: string;
  rowId: string | null;
  columnId: string;
  isHeader: boolean;
}

interface BuilderState {
  templateId: string | null;
  templateName: string;
  pages: TemplatePage[];
  activePageIndex: number;
  selectedElementIds: string[];
  selectedTableCell: SelectedTableCell | null;
  selectedTableCells: SelectedTableCell[];
  imageCropElementId: string | null;
  shapeCropElementId: string | null;
  zoom: number;
  snapToGrid: boolean;
  history: TemplatePage[][];
  historyIndex: number;
  isDirty: boolean;
}

const defaultPage = (): TemplatePage => ({
  id: uuidv4(),
  name: 'Page 1',
  margins: { top: 40, right: 40, bottom: 40, left: 40 },
  elements: [],
});

const normalizeElement = (
  el: CanvasElement,
  margins: TemplatePage['margins']
): CanvasElement => {
  if (isTableElementType(el.type)) {
    const table = normalizeTablePropsForType(el.type, (el.props ?? {}) as Record<string, unknown>);
    const clamped = clampTableElementToPage(
      el.x || 0,
      el.y || 0,
      table,
      PAGE_WIDTH,
      PAGE_HEIGHT,
      margins,
      el.type
    );
    return {
      ...el,
      x: clamped.x,
      y: clamped.y,
      width: clamped.width,
      height: clamped.height,
      props: productTablePropsToRecord(clamped.table),
    };
  }

  const contentW = PAGE_WIDTH - margins.left - margins.right;
  const contentH = PAGE_HEIGHT - margins.top - margins.bottom;
  const width = Math.min(Math.max(el.width ?? 100, 24), contentW);
  const height = Math.min(Math.max(el.height ?? 40, 24), contentH);
  const x = Math.max(margins.left, Math.min(el.x || 0, PAGE_WIDTH - margins.right - width));
  const y = Math.max(margins.top, Math.min(el.y || 0, PAGE_HEIGHT - margins.bottom - height));
  return { ...el, x, y, width, height, props: el.props ?? {} };
};

const initialState: BuilderState = {
  templateId: null,
  templateName: 'Untitled Template',
  pages: [defaultPage()],
  activePageIndex: 0,
  selectedElementIds: [],
  selectedTableCell: null,
  selectedTableCells: [],
  imageCropElementId: null,
  shapeCropElementId: null,
  zoom: 1,
  snapToGrid: false,
  history: [],
  historyIndex: -1,
  isDirty: false,
};

const pushHistory = (state: BuilderState) => {
  const snapshot = JSON.parse(JSON.stringify(state.pages)) as TemplatePage[];
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }
  state.history.push(snapshot);
  if (state.history.length > 50) {
    state.history.shift();
  }
  state.historyIndex = state.history.length - 1;
};

const seedHistory = (state: BuilderState) => {
  state.history = [JSON.parse(JSON.stringify(state.pages)) as TemplatePage[]];
  state.historyIndex = 0;
};

const withNormalizedLayers = (pages: TemplatePage[]): TemplatePage[] =>
  pages.map((page) => ({
    ...page,
    elements: normalizeElementLayers(page.elements),
  }));

function findElementLocation(
  pages: TemplatePage[],
  elementId: string,
  preferredPageIndex: number
): { pageIndex: number; elementIndex: number } | null {
  const preferred = pages[preferredPageIndex]?.elements.findIndex((e) => e.id === elementId) ?? -1;
  if (preferred >= 0) return { pageIndex: preferredPageIndex, elementIndex: preferred };
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const elementIndex = pages[pageIndex].elements.findIndex((e) => e.id === elementId);
    if (elementIndex >= 0) return { pageIndex, elementIndex };
  }
  return null;
}

/** True when this table id only appears on one page (not a split across pages). */
function tableExistsOnlyOnPage(
  pages: TemplatePage[],
  tableId: string,
  pageIndex: number
): boolean {
  for (let i = 0; i < pages.length; i += 1) {
    if (i === pageIndex) continue;
    const hit = pages[i].elements.some(
      (element) =>
        isTableElementType(element.type)
        && resolvePaginationTableId(
          (element.props ?? {}) as Record<string, unknown>,
          element.id
        ) === tableId
    );
    if (hit) return false;
  }
  return true;
}

function clonePages(pages: TemplatePage[]): TemplatePage[] {
  return JSON.parse(JSON.stringify(pages)) as TemplatePage[];
}

function remapSelectionAfterDocumentLayout(
  state: BuilderState,
  previousPages: TemplatePage[],
  nextPages: TemplatePage[]
) {
  // Page tabs can shrink (e.g. empty page-2 table continuation removed after delete).
  if (state.activePageIndex >= nextPages.length) {
    state.activePageIndex = Math.max(0, nextPages.length - 1);
  }

  const primaryId = getPrimarySelectedId(state.selectedElementIds);
  if (!primaryId) return;

  for (const page of nextPages) {
    if (page.elements.some((element) => element.id === primaryId)) return;
  }

  let oldElement: CanvasElement | undefined;
  for (const page of previousPages) {
    oldElement = page.elements.find((element) => element.id === primaryId);
    if (oldElement) break;
  }
  if (!oldElement) {
    state.selectedElementIds = [];
    return;
  }

  if (!isTableElementType(oldElement.type)) {
    state.selectedElementIds = [];
    return;
  }

  const tableId = resolvePaginationTableId(
    (oldElement.props ?? {}) as Record<string, unknown>,
    oldElement.id
  );
  const anchor = nextPages[0]?.elements.find(
    (element) =>
      isTableElementType(element.type)
      && resolvePaginationTableId((element.props ?? {}) as Record<string, unknown>, element.id)
        === tableId
  );
  if (anchor) {
    state.selectedElementIds = [anchor.id];
    state.activePageIndex = 0;
    return;
  }

  for (let pageIndex = 0; pageIndex < nextPages.length; pageIndex += 1) {
    const page = nextPages[pageIndex];
    const match = page.elements.find(
      (element) =>
        isTableElementType(element.type)
        && resolvePaginationTableId((element.props ?? {}) as Record<string, unknown>, element.id)
          === tableId
    );
    if (match) {
      state.selectedElementIds = [match.id];
      state.activePageIndex = pageIndex;
      return;
    }
  }

  state.selectedElementIds = [];
}

function findElementAcrossPages(pages: TemplatePage[], id: string): CanvasElement | undefined {
  for (const page of pages) {
    const hit = page.elements.find((element) => element.id === id);
    if (hit) return hit;
  }
  return undefined;
}

function removeDocumentElements(state: BuilderState, elementIds: string[]) {
  const removeIds = new Set(elementIds);
  state.pages = state.pages.map((page) => ({
    ...page,
    elements: normalizeElementLayers(
      page.elements.filter((element) => !removeIds.has(element.id) || element.locked)
    ),
  }));
  state.pages = normalizeBuilderPagesForEditor(state.pages);
  if (state.activePageIndex >= state.pages.length) {
    state.activePageIndex = Math.max(0, state.pages.length - 1);
  }
  state.selectedElementIds = state.selectedElementIds.filter((id) => !removeIds.has(id));
  if (state.imageCropElementId && removeIds.has(state.imageCropElementId)) {
    state.imageCropElementId = null;
  }
  if (state.shapeCropElementId && removeIds.has(state.shapeCropElementId)) {
    state.shapeCropElementId = null;
  }
}

function resolveDeletableElementIds(state: BuilderState, seedIds: string[]): string[] {
  const removeIds = new Set<string>();
  for (const id of seedIds) {
    const target = findElementAcrossPages(state.pages, id);
    if (!target || target.locked) continue;
    const connected =
      isTableElementType(target.type)
        ? collectConnectedTableElementIds(state.pages, id)
        : isDocumentFooterElement(target)
          ? collectLinkedFooterElementIds(state.pages, id)
          : [id];
    for (const connectedId of connected) {
      const element = findElementAcrossPages(state.pages, connectedId);
      if (element && !element.locked) removeIds.add(connectedId);
    }
  }
  return [...removeIds];
}

function commitDocumentLayout(state: BuilderState, plain: TemplatePage[]) {
  const previousPages = clonePages(state.pages);
  const next = layoutBuilderPages(plain);
  state.pages = next;
  if (state.activePageIndex >= state.pages.length) {
    state.activePageIndex = Math.max(0, state.pages.length - 1);
  }
  remapSelectionAfterDocumentLayout(state, previousPages, next);
}

function isGeometryOnlyChange(changes: Partial<CanvasElement>): boolean {
  const keys = Object.keys(changes);
  return (
    keys.length > 0
    && keys.every((key) => key === 'x' || key === 'y' || key === 'width' || key === 'height')
  );
}

/** True when a mutation should re-run document flow layout (not manual drag/resize/crop). */
function shouldTriggerDocumentLayout(
  changes: Partial<CanvasElement>,
  skipDocumentLayout?: boolean
): boolean {
  if (skipDocumentLayout) return false;
  if (isGeometryOnlyChange(changes)) return false;
  if (changes.props !== undefined) return true;
  if (
    changes.height !== undefined
    && changes.width === undefined
    && changes.x === undefined
    && changes.y === undefined
  ) {
    return true;
  }
  return false;
}

function applyManualElementUpdate(elements: CanvasElement[], idx: number, merged: CanvasElement) {
  elements[idx] = touchLogicalFlowY(merged);
}

function applyDocumentLayout(pages: TemplatePage[]): TemplatePage[] {
  return layoutBuilderPages(pages);
}

const builderSlice = createSlice({
  name: 'builder',
  initialState,
  reducers: {
    loadTemplate: (
      state,
      action: PayloadAction<{ id: string; name: string; pages: TemplatePage[] }>
    ) => {
      state.templateId = action.payload.id;
      state.templateName = action.payload.name;
      const sourcePages =
        Array.isArray(action.payload.pages) && action.payload.pages.length > 0
          ? action.payload.pages
          : [defaultPage()];
      const normalizedPages = sourcePages.map((page, pageIndex) => {
        const normalized = (page.elements ?? []).map((el) => normalizeElement(el, page.margins));
        const flowTables = (page.elements ?? []).filter(
          (el) => el.visible !== false && isTableElementType(el.type)
        );
        const looksLikeAutoContinuation =
          pageIndex > 0
          && (
            flowTables.length === 0
            || flowTables.every((el) =>
              isTableContinuationSegment((el.props ?? {}) as Record<string, unknown>)
            )
          );
        return {
          ...page,
          // Only keep explicit user pages; clear stale flags on auto-spilled pages.
          userAuthored: page.userAuthored === true && !looksLikeAutoContinuation,
          elements: normalizeElementLayers(normalized),
        };
      });
      // Keep authored positions on open — preview/composer reflow, not the canvas editor.
      // Also fix sample due dates that are earlier than the invoice date.
      state.pages = normalizeBuilderPagesForEditor(
        enforceInvoiceDueDateOrderOnPages(normalizeDocumentFooters(normalizedPages)).pages
      );
      state.activePageIndex = 0;
      state.selectedElementIds = [];
      state.imageCropElementId = null;
      state.shapeCropElementId = null;
      seedHistory(state);
      state.isDirty = false;
    },
    setActivePage: (state, action: PayloadAction<number>) => {
      state.activePageIndex = action.payload;
      state.selectedElementIds = [];
      state.imageCropElementId = null;
      state.shapeCropElementId = null;
    },
    addPage: (state) => {
      const masterPage = state.pages[0];
      const blank: TemplatePage = {
        ...defaultPage(),
        name: `Page ${state.pages.length + 1}`,
        userAuthored: true,
      };
      state.pages.push({
        ...blank,
        elements: appendFootersFromMasterPage(masterPage, blank),
      });
      state.activePageIndex = state.pages.length - 1;
      state.isDirty = true;
      pushHistory(state);
    },
    deletePage: (state, action: PayloadAction<number | undefined>) => {
      if (state.pages.length <= 1) return;
      const index = action.payload ?? state.activePageIndex;
      // Page 1 (index 0) is never deletable.
      if (index <= 0 || index >= state.pages.length) return;

      state.pages.splice(index, 1);
      state.pages = absorbPaginationAfterPageDelete(clonePages(state.pages));
      state.pages = normalizeBuilderPagesForEditor(state.pages);
      if (state.activePageIndex > index) {
        state.activePageIndex -= 1;
      } else if (state.activePageIndex >= state.pages.length) {
        state.activePageIndex = state.pages.length - 1;
      }
      state.selectedElementIds = [];
      state.isDirty = true;
      pushHistory(state);
    },
    addElement: (state, action: PayloadAction<CanvasElement>) => {
      const pageIndex = state.activePageIndex;
      const page = state.pages[pageIndex];

      if (action.payload.type === ComponentType.FOOTER) {
        const footer = prepareNewFooterElement(
          {
            ...action.payload,
            zIndex: getNextZIndex(page.elements),
          },
          page
        );
        const plain = clonePages(state.pages);
        plain[pageIndex] = {
          ...plain[pageIndex],
          elements: normalizeElementLayers([...plain[pageIndex].elements, footer]),
        };
        state.pages = syncSharedFooterAcrossPages(plain, footer);
        state.selectedElementIds = [footer.id];
        state.isDirty = true;
        pushHistory(state);
        return;
      }

      page.elements = normalizeElementLayers([
        ...page.elements,
        touchLogicalFlowY({
          ...action.payload,
          zIndex: getNextZIndex(page.elements),
        }),
      ]);
      state.selectedElementIds = [action.payload.id];
      state.isDirty = true;
      pushHistory(state);
    },
    relayoutTables: (state) => {
      commitDocumentLayout(state, clonePages(state.pages));
    },
    updateElement: (
      state,
      action: PayloadAction<{
        id: string;
        changes: Partial<CanvasElement>;
        recordHistory?: boolean;
        replaceProps?: boolean;
        /** Row-height sync / resize / crop — skip automatic document reflow. */
        skipTableReflow?: boolean;
        skipDocumentLayout?: boolean;
      }>
    ) => {
      const location = findElementLocation(
        state.pages,
        action.payload.id,
        state.activePageIndex
      );
      if (!location) return;

      const { pageIndex: targetPageIndex, elementIndex: idx } = location;
      const page = state.pages[targetPageIndex];
      const elements = page.elements;
      const current = elements[idx];
        const skipLayout =
          action.payload.skipDocumentLayout === true
          || action.payload.skipTableReflow === true;
        const { props: propsPatch, ...restChanges } = action.payload.changes;
        const merged: CanvasElement = { ...current, ...restChanges };
        if (propsPatch !== undefined) {
          if (action.payload.replaceProps) {
            merged.props = propsPatch;
          } else {
            const nextProps = { ...(current.props ?? {}), ...propsPatch };
            // Explicit undefined clears a prop (e.g. stale textRuns after plain edit).
            for (const [key, value] of Object.entries(propsPatch)) {
              if (value === undefined) delete nextProps[key];
            }
            merged.props = nextProps;
          }
        }
        if (isTableElementType(merged.type)) {
          const currentProps = (current.props ?? {}) as Record<string, unknown>;
          const mergedProps = (merged.props ?? {}) as Record<string, unknown>;
          const table = normalizeTablePropsForType(
            merged.type,
            resolveBuilderTablePropsForEdit(mergedProps)
          );
          const structuralChange =
            propsPatch !== undefined
            && tablePropsNeedDocumentLayout(merged.type, currentProps, mergedProps);

          if (propsPatch !== undefined) {
            const shouldReflow =
              !skipLayout
              && restChanges.width === undefined;

            if (!shouldReflow) {
              const fitted = fitTableHeightsPreservingWidths(
                merged.type,
                resolveBuilderTablePropsForEdit(mergedProps)
              );
              applyManualElementUpdate(elements, idx, {
                ...merged,
                width: merged.width > 0 ? merged.width : current.width,
                height: merged.height > 0 ? merged.height : fitted.height,
                props: mergeTablePaginationProps(currentProps, fitted.tableProps),
              });
            } else {
              const tableId = resolvePaginationTableId(currentProps, action.payload.id);
              const isContinuationEdit =
                structuralChange && isTableContinuationSegment(currentProps);
              const finalProps = mergeTablePaginationProps(currentProps, mergedProps, {
                clearSegmentRange: structuralChange && !isContinuationEdit,
                anchorElementId: tableId,
              });
              const editedTable = normalizeTablePropsForType(
                merged.type,
                resolveBuilderTablePropsForEdit(finalProps)
              );
              const fitted = fitTableHeightsPreservingWidths(
                merged.type,
                resolveBuilderTablePropsForEdit(finalProps)
              );
              const propsWithFit = mergeTablePaginationProps(finalProps, fitted.tableProps, {
                anchorElementId: tableId,
              });

              if (isContinuationEdit) {
                const previousPages = clonePages(state.pages);
                let plain = syncPaginatedTableRowsAcrossSegments(
                  clonePages(state.pages),
                  tableId,
                  editedTable.rows
                ) as TemplatePage[];
                state.pages = applyContinuationTableStructuralEdit(
                  plain,
                  action.payload.id,
                  propsWithFit
                );
                remapSelectionAfterDocumentLayout(state, previousPages, state.pages);
              } else {
                let plain = syncPaginatedTableRowsAcrossSegments(
                  clonePages(state.pages),
                  tableId,
                  editedTable.rows
                ) as TemplatePage[];
                const editLocation = findElementLocation(plain, action.payload.id, targetPageIndex);
                if (editLocation) {
                  const currentEl = plain[editLocation.pageIndex].elements[editLocation.elementIndex];
                  plain[editLocation.pageIndex].elements[editLocation.elementIndex] = {
                    ...currentEl,
                    ...merged,
                    props: propsWithFit,
                    width: merged.width > 0 ? merged.width : currentEl.width,
                    height: currentEl.height,
                  };
                }
                // Independent tables on page 2+ must not run full-document consolidate
                // (that used to move them onto page 1 and delete their page).
                const localLaterPageEdit =
                  !!editLocation
                  && editLocation.pageIndex > 0
                  && tableExistsOnlyOnPage(plain, tableId, editLocation.pageIndex);
                if (localLaterPageEdit) {
                  const previousPages = clonePages(state.pages);
                  state.pages = applyContinuationTableStructuralEdit(
                    plain,
                    action.payload.id,
                    propsWithFit
                  );
                  remapSelectionAfterDocumentLayout(state, previousPages, state.pages);
                } else {
                  commitDocumentLayout(state, plain);
                }
              }
            }
          } else {
            // Position/size-only update — keep manual placement.
            applyManualElementUpdate(elements, idx, {
              ...merged,
              width: merged.width > 0 ? merged.width : current.width,
              height: merged.height > 0 ? merged.height : current.height,
              props: mergeTablePaginationProps(
                currentProps,
                productTablePropsToRecord(table)
              ),
            });
          }
        } else {
          const shouldLayout = shouldTriggerDocumentLayout(restChanges, skipLayout);
          if (shouldLayout) {
            const plain = clonePages(state.pages);
            const pageIdx = state.activePageIndex;
            const elIdx = plain[pageIdx]?.elements.findIndex((e) => e.id === action.payload.id) ?? -1;
            if (elIdx >= 0) {
              plain[pageIdx].elements[elIdx] = merged;
            }
            commitDocumentLayout(state, plain);
          } else {
            applyManualElementUpdate(elements, idx, merged);
          }
        }

        const updated = findElementAcrossPages(state.pages, action.payload.id);
        if (updated && isDocumentFooterElement(updated)) {
          state.pages = syncSharedFooterAcrossPages(clonePages(state.pages), updated);
        }

        state.isDirty = true;
        if (action.payload.recordHistory) {
          pushHistory(state);
        }
    },
    deleteElement: (state, action: PayloadAction<string>) => {
      const removeIds = resolveDeletableElementIds(state, [action.payload]);
      if (removeIds.length === 0) return;

      removeDocumentElements(state, removeIds);
      state.isDirty = true;
      pushHistory(state);
    },
    deleteSelectedElements: (state) => {
      if (state.selectedElementIds.length === 0) return;
      const removeIds = resolveDeletableElementIds(state, state.selectedElementIds);
      if (removeIds.length === 0) return;

      removeDocumentElements(state, removeIds);
      state.isDirty = true;
      pushHistory(state);
    },
    duplicateElement: (state, action: PayloadAction<string>) => {
      const pageIndex = state.activePageIndex;
      const page = state.pages[pageIndex];
      const elements = page.elements;
      const el = elements.find((e) => e.id === action.payload);
      if (!el) return;

      if (isDocumentFooterElement(el)) {
        const dup = prepareNewFooterElement(
          {
            ...JSON.parse(JSON.stringify(el)) as CanvasElement,
            id: uuidv4(),
            locked: false,
            zIndex: getNextZIndex(elements),
          },
          page
        );
        const plain = clonePages(state.pages);
        plain[pageIndex] = {
          ...plain[pageIndex],
          elements: normalizeElementLayers([...plain[pageIndex].elements, dup]),
        };
        state.pages = syncSharedFooterAcrossPages(plain, dup);
        state.selectedElementIds = [dup.id];
        state.isDirty = true;
        pushHistory(state);
        return;
      }

      const offset = 24;
      let dup: CanvasElement = {
        ...JSON.parse(JSON.stringify(el)),
        id: uuidv4(),
        x: el.x + offset,
        y: el.y + offset,
        locked: false,
        zIndex: getNextZIndex(elements),
      };

      if (isTableElementType(dup.type)) {
        const table = normalizeTablePropsForType(dup.type, (dup.props ?? {}) as Record<string, unknown>);
        const clamped = clampTableElementToPage(
          dup.x,
          dup.y,
          table,
          PAGE_WIDTH,
          PAGE_HEIGHT,
          page.margins,
          dup.type
        );
        dup = {
          ...dup,
          x: clamped.x,
          y: clamped.y,
          width: clamped.width,
          height: clamped.height,
          props: productTablePropsToRecord(clamped.table),
        };
      } else {
        const { x, y } = {
          x: Math.max(page.margins.left, Math.min(dup.x, PAGE_WIDTH - page.margins.right - dup.width)),
          y: Math.max(page.margins.top, Math.min(dup.y, PAGE_HEIGHT - page.margins.bottom - dup.height)),
        };
        dup = { ...dup, x, y };
      }

      elements.push(touchLogicalFlowY(dup));
      page.elements = normalizeElementLayers(elements);
      state.selectedElementIds = [dup.id];
      state.isDirty = true;
      pushHistory(state);
    },
    toggleElementLock: (state, action: PayloadAction<string>) => {
      const elements = state.pages[state.activePageIndex].elements;
      const idx = elements.findIndex((e) => e.id === action.payload);
      if (idx !== -1) {
        elements[idx] = { ...elements[idx], locked: !elements[idx].locked };
        state.isDirty = true;
        pushHistory(state);
      }
    },
    toggleElementVisible: (state, action: PayloadAction<string>) => {
      const elements = state.pages[state.activePageIndex].elements;
      const idx = elements.findIndex((e) => e.id === action.payload);
      if (idx !== -1) {
        const visible = elements[idx].visible !== false;
        elements[idx] = { ...elements[idx], visible: !visible };
        const updated = elements[idx];
        if (isDocumentFooterElement(updated)) {
          state.pages = syncSharedFooterAcrossPages(clonePages(state.pages), updated);
        }
        state.isDirty = true;
        pushHistory(state);
      }
    },
    setElementsLocked: (
      state,
      action: PayloadAction<{ ids: string[]; locked: boolean }>
    ) => {
      const ids = new Set(action.payload.ids);
      const elements = state.pages[state.activePageIndex].elements;
      let changed = false;
      for (let i = 0; i < elements.length; i++) {
        if (ids.has(elements[i].id) && elements[i].locked !== action.payload.locked) {
          elements[i] = { ...elements[i], locked: action.payload.locked };
          changed = true;
        }
      }
      if (changed) {
        state.isDirty = true;
        pushHistory(state);
      }
    },
    toggleSelectedElementsLock: (state) => {
      if (state.selectedElementIds.length === 0) return;
      const selected = new Set(state.selectedElementIds);
      const elements = state.pages[state.activePageIndex].elements;
      const selectedEls = elements.filter((el) => selected.has(el.id));
      if (selectedEls.length === 0) return;

      const allLocked = selectedEls.every((el) => el.locked);
      const targetLocked = !allLocked;
      let changed = false;
      for (let i = 0; i < elements.length; i++) {
        if (selected.has(elements[i].id) && elements[i].locked !== targetLocked) {
          elements[i] = { ...elements[i], locked: targetLocked };
          changed = true;
        }
      }
      if (changed) {
        state.isDirty = true;
        pushHistory(state);
      }
    },
    setElementLayer: (
      state,
      action: PayloadAction<{ id: string; layer: number }>
    ) => {
      const page = state.pages[state.activePageIndex];
      page.elements = reorderElementLayer(
        page.elements,
        action.payload.id,
        action.payload.layer
      );
      state.isDirty = true;
      pushHistory(state);
    },
    reorderPageLayers: (
      state,
      action: PayloadAction<{ elementIds: string[] }>
    ) => {
      const page = state.pages[state.activePageIndex];
      page.elements = reorderPageElements(page.elements, action.payload.elementIds);
      state.isDirty = true;
      pushHistory(state);
    },
    selectElement: (state, action: PayloadAction<string | null>) => {
      if (
        state.imageCropElementId
        && action.payload !== state.imageCropElementId
      ) {
        state.imageCropElementId = null;
      }
      if (
        state.shapeCropElementId
        && action.payload !== state.shapeCropElementId
      ) {
        const page = state.pages[state.activePageIndex];
        const idx = page.elements.findIndex((el) => el.id === state.shapeCropElementId);
        if (idx !== -1) {
          const el = page.elements[idx];
          if (shouldBakeShapeClipOnApply(el)) {
            page.elements[idx] = applyClipToElementBounds(el);
          }
        }
        state.shapeCropElementId = null;
        state.isDirty = true;
        pushHistory(state);
      }
      state.selectedElementIds = action.payload ? [action.payload] : [];
      state.selectedTableCell = null;
      state.selectedTableCells = [];
    },
    selectTableCell: (
      state,
      action: PayloadAction<{ cell: SelectedTableCell; extend?: boolean }>
    ) => {
      const { cell, extend } = action.payload;
      state.selectedElementIds = [cell.elementId];
      state.selectedTableCell = cell;
      if (extend) {
        const exists = state.selectedTableCells.some((c) => isSameTableCell(c, cell));
        state.selectedTableCells = exists
          ? state.selectedTableCells.filter((c) => !isSameTableCell(c, cell))
          : [...state.selectedTableCells, cell];
        if (
          state.selectedTableCells.length > 0
          && state.selectedTableCell
          && !state.selectedTableCells.some((c) => isSameTableCell(c, state.selectedTableCell!))
        ) {
          state.selectedTableCell = state.selectedTableCells[state.selectedTableCells.length - 1];
        }
        if (state.selectedTableCells.length === 0) {
          state.selectedTableCell = null;
        }
      } else {
        state.selectedTableCells = [cell];
      }
    },
    clearTableCellSelection: (state) => {
      state.selectedTableCell = null;
      state.selectedTableCells = [];
    },
    setTableCellsSelection: (
      state,
      action: PayloadAction<{
        elementId: string;
        cells: SelectedTableCell[];
        primary?: SelectedTableCell | null;
      }>
    ) => {
      const { elementId, cells, primary } = action.payload;
      state.selectedElementIds = [elementId];
      state.selectedTableCells = cells;
      if (cells.length === 0) {
        state.selectedTableCell = null;
        return;
      }
      state.selectedTableCell = primary ?? cells[cells.length - 1];
    },
    toggleElementInSelection: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const idx = state.selectedElementIds.indexOf(id);
      if (idx === -1) {
        state.selectedElementIds = [...state.selectedElementIds, id];
        return;
      }
      state.selectedElementIds = state.selectedElementIds.filter((sid) => sid !== id);
      if (state.selectedTableCell?.elementId === id) {
        state.selectedTableCell = null;
        state.selectedTableCells = [];
      }
    },
    setElementSelection: (
      state,
      action: PayloadAction<{ ids: string[]; additive?: boolean }>
    ) => {
      const unique = [...new Set(action.payload.ids)];
      if (action.payload.additive) {
        state.selectedElementIds = [...new Set([...state.selectedElementIds, ...unique])];
      } else {
        state.selectedElementIds = unique;
      }
      const primary = state.selectedElementIds[state.selectedElementIds.length - 1];
      if (!primary || state.selectedTableCell?.elementId !== primary) {
        state.selectedTableCell = null;
        state.selectedTableCells = [];
      }
    },
    setImageCropMode: (state, action: PayloadAction<string | null>) => {
      const wasCrop = state.imageCropElementId;
      state.imageCropElementId = action.payload;
      if (action.payload) {
        state.selectedElementIds = [action.payload];
        state.shapeCropElementId = null;
      } else if (wasCrop) {
        state.isDirty = true;
        pushHistory(state);
      }
    },
    setShapeCropMode: (state, action: PayloadAction<string | null>) => {
      const wasCrop = state.shapeCropElementId;
      if (wasCrop && action.payload === null) {
        const page = state.pages[state.activePageIndex];
        const idx = page.elements.findIndex((el) => el.id === wasCrop);
        if (idx !== -1) {
          const el = page.elements[idx];
          if (shouldBakeShapeClipOnApply(el)) {
            page.elements[idx] = applyClipToElementBounds(el);
          }
        }
        state.isDirty = true;
        pushHistory(state);
      }
      state.shapeCropElementId = action.payload;
      if (action.payload) {
        state.selectedElementIds = [action.payload];
        state.imageCropElementId = null;
      }
    },
    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = Math.min(2, Math.max(0.25, action.payload));
    },
    toggleSnapToGrid: (state) => {
      state.snapToGrid = !state.snapToGrid;
    },
    undo: (state) => {
      if (state.historyIndex <= 0) return;
      state.historyIndex -= 1;
      state.pages = withNormalizedLayers(
        JSON.parse(JSON.stringify(state.history[state.historyIndex])) as TemplatePage[]
      );
      state.selectedElementIds = [];
      state.selectedTableCell = null;
      state.selectedTableCells = [];
      state.imageCropElementId = null;
      state.shapeCropElementId = null;
      state.isDirty = true;
    },
    redo: (state) => {
      if (state.historyIndex >= state.history.length - 1) return;
      state.historyIndex += 1;
      state.pages = withNormalizedLayers(
        JSON.parse(JSON.stringify(state.history[state.historyIndex])) as TemplatePage[]
      );
      state.selectedElementIds = [];
      state.selectedTableCell = null;
      state.selectedTableCells = [];
      state.imageCropElementId = null;
      state.shapeCropElementId = null;
      state.isDirty = true;
    },
    markClean: (state) => {
      state.isDirty = false;
    },
    setTemplateName: (state, action: PayloadAction<string>) => {
      const next = action.payload.trim();
      if (!next || next === state.templateName) return;
      state.templateName = next;
      state.isDirty = true;
    },
    markDirty: (state) => {
      state.isDirty = true;
    },
    resetBuilder: () => initialState,
  },
});

export const {
  loadTemplate,
  setActivePage,
  addPage,
  deletePage,
  addElement,
  relayoutTables,
  updateElement,
  deleteElement,
  deleteSelectedElements,
  duplicateElement,
  toggleElementLock,
  toggleElementVisible,
  setElementsLocked,
  toggleSelectedElementsLock,
  setElementLayer,
  reorderPageLayers,
  selectElement,
  selectTableCell,
  setTableCellsSelection,
  clearTableCellSelection,
  toggleElementInSelection,
  setElementSelection,
  setImageCropMode,
  setShapeCropMode,
  setZoom,
  toggleSnapToGrid,
  undo,
  redo,
  markClean,
  setTemplateName,
  markDirty,
  resetBuilder,
} = builderSlice.actions;

export default builderSlice.reducer;
