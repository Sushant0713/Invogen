import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { v4 as uuidv4 } from 'uuid';
import {
  isTableElementType,
  productTablePropsToRecord,
  isSameTableCell,
  resolveBuilderTablePropsForEdit,
} from '@/features/builder/product-table';
import {
  clampTableElementToPage,
  fitTableHeightsPreservingWidths,
} from '@/features/builder/table-element-size';
import { normalizeTablePropsForType } from '@/features/builder/table-props-normalize';
import { getPageDimensions, PAGE_WIDTH, PAGE_HEIGHT } from '@/features/builder/builder-dnd';
import { getNextZIndex, normalizeElementLayers, reorderElementLayer, reorderPageElements } from '@/features/builder/element-layers';
import { applyClipToElementBounds, shouldBakeShapeClipOnApply } from '@/features/builder/shape-clip';
import { layoutBuilderPages, builderPagesNeedLayout, touchLogicalFlowY } from '@/features/builder/document-layout';

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

function clonePages(pages: TemplatePage[]): TemplatePage[] {
  return JSON.parse(JSON.stringify(pages)) as TemplatePage[];
}

function commitDocumentLayout(state: BuilderState, plain: TemplatePage[]) {
  let next = layoutBuilderPages(plain);
  // Re-run once so consolidated table segments + spilled blocks settle across pages.
  next = layoutBuilderPages(next);
  state.pages = next;
  if (state.activePageIndex >= state.pages.length) {
    state.activePageIndex = Math.max(0, state.pages.length - 1);
  }
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
  let next = layoutBuilderPages(pages);
  return layoutBuilderPages(next);
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
      const normalizedPages = action.payload.pages.map((page) => {
        const normalized = page.elements.map((el) => normalizeElement(el, page.margins));
        return { ...page, elements: normalizeElementLayers(normalized) };
      });
      // Multi-page templates are saved intentionally — do not consolidate / drop
      // pages on open (layoutBuilderPages gathers everything onto page 1).
      state.pages =
        normalizedPages.length > 1
          ? normalizedPages
          : builderPagesNeedLayout(normalizedPages)
            ? applyDocumentLayout(normalizedPages)
            : normalizedPages;
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
      state.pages.push({
        ...defaultPage(),
        name: `Page ${state.pages.length + 1}`,
      });
      state.activePageIndex = state.pages.length - 1;
      state.isDirty = true;
      pushHistory(state);
    },
    deletePage: (state, action: PayloadAction<number | undefined>) => {
      if (state.pages.length <= 1) return;
      const index = action.payload ?? state.activePageIndex;
      if (index < 0 || index >= state.pages.length) return;

      state.pages.splice(index, 1);
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
      const page = state.pages[state.activePageIndex];
      const newId = action.payload.id;
      page.elements = normalizeElementLayers([
        ...page.elements,
        touchLogicalFlowY({
          ...action.payload,
          zIndex: getNextZIndex(page.elements),
        }),
      ]);
      state.selectedElementIds = [newId];
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
      const elements = state.pages[state.activePageIndex].elements;
      const idx = elements.findIndex((e) => e.id === action.payload.id);
      if (idx !== -1) {
        const page = state.pages[state.activePageIndex];
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
          const table = normalizeTablePropsForType(
            merged.type,
            resolveBuilderTablePropsForEdit((merged.props ?? {}) as Record<string, unknown>)
          );

          if (propsPatch !== undefined) {
            const shouldReflow =
              !skipLayout
              && restChanges.width === undefined;

            if (!shouldReflow) {
              const fitted = fitTableHeightsPreservingWidths(
                merged.type,
                productTablePropsToRecord(table)
              );
              applyManualElementUpdate(elements, idx, {
                ...merged,
                width: merged.width > 0 ? merged.width : current.width,
                height: merged.height > 0 ? merged.height : fitted.height,
                props: fitted.tableProps,
              });
            } else {
              const plain = JSON.parse(JSON.stringify(state.pages)) as TemplatePage[];
              for (let pageIndex = 0; pageIndex < plain.length; pageIndex += 1) {
                plain[pageIndex].elements = plain[pageIndex].elements.map((el) => {
                  if (!isTableElementType(el.type)) return el;
                  const table = normalizeTablePropsForType(
                    el.type,
                    resolveBuilderTablePropsForEdit((el.props ?? {}) as Record<string, unknown>)
                  );
                  const fitted = fitTableHeightsPreservingWidths(
                    el.type,
                    productTablePropsToRecord(table)
                  );
                  return { ...el, props: fitted.tableProps };
                });
              }
              const pageIdx = state.activePageIndex;
              const elIdx = plain[pageIdx]?.elements.findIndex((e) => e.id === action.payload.id) ?? -1;
              if (elIdx >= 0) {
                const fitted = fitTableHeightsPreservingWidths(
                  merged.type,
                  productTablePropsToRecord(table)
                );
                const currentEl = plain[pageIdx].elements[elIdx];
                plain[pageIdx].elements[elIdx] = {
                  ...currentEl,
                  props: fitted.tableProps,
                  width: merged.width > 0 ? merged.width : currentEl.width,
                };
              }
              state.pages = applyDocumentLayout(plain);
              if (state.activePageIndex >= state.pages.length) {
                state.activePageIndex = Math.max(0, state.pages.length - 1);
              }
            }
          } else {
            // Position/size-only update — keep manual placement.
            applyManualElementUpdate(elements, idx, {
              ...merged,
              width: merged.width > 0 ? merged.width : current.width,
              height: merged.height > 0 ? merged.height : current.height,
              props: productTablePropsToRecord(table),
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
        state.isDirty = true;
        if (action.payload.recordHistory) {
          pushHistory(state);
        }
      }
    },
    deleteElement: (state, action: PayloadAction<string>) => {
      const page = state.pages[state.activePageIndex];
      const target = page.elements.find((e) => e.id === action.payload);
      if (!target || target.locked) return;

      page.elements = page.elements.filter((e) => e.id !== action.payload);
      page.elements = normalizeElementLayers(page.elements);
      state.selectedElementIds = state.selectedElementIds.filter((id) => id !== action.payload);
      if (state.imageCropElementId === action.payload) state.imageCropElementId = null;
      if (state.shapeCropElementId === action.payload) state.shapeCropElementId = null;
      state.isDirty = true;
      pushHistory(state);
    },
    deleteSelectedElements: (state) => {
      if (state.selectedElementIds.length === 0) return;
      const selected = new Set(state.selectedElementIds);
      const page = state.pages[state.activePageIndex];
      page.elements = page.elements.filter((el) => !selected.has(el.id) || el.locked);
      page.elements = normalizeElementLayers(page.elements);
      state.selectedElementIds = state.selectedElementIds.filter((id) =>
        page.elements.some((el) => el.id === id)
      );
      if (state.imageCropElementId && !page.elements.some((el) => el.id === state.imageCropElementId)) {
        state.imageCropElementId = null;
      }
      if (state.shapeCropElementId && !page.elements.some((el) => el.id === state.shapeCropElementId)) {
        state.shapeCropElementId = null;
      }
      state.isDirty = true;
      pushHistory(state);
    },
    duplicateElement: (state, action: PayloadAction<string>) => {
      const page = state.pages[state.activePageIndex];
      const elements = page.elements;
      const el = elements.find((e) => e.id === action.payload);
      if (!el) return;

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
  markDirty,
  resetBuilder,
} = builderSlice.actions;

export default builderSlice.reducer;
