import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { CanvasElement } from '@invogen/shared';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import {
  deleteElement,
  duplicateElement,
  reorderPageLayers,
  selectElement,
  setElementLayer,
  toggleElementLock,
  toggleElementVisible,
  toggleElementPin,
  updateElement,
} from '@/store/slices/builderSlice';
import { writeBuilderClipboard } from '@/features/builder/builder-clipboard';
import {
  filterOverlappingLayers,
  getLayerIndex,
  getLayerLabel,
  sortByLayer,
} from '../element-layers';
import { getPrimarySelectedId } from '../builder-selection';
import { LayerContextMenu, type LayerContextMenuState } from './LayerContextMenu';
import { LayerFilterSegment, type LayerFilter } from './LayerFilterSegment';
import { DragLayerPreview } from './LayerRow';
import { useLayerSelection } from './useLayerSelection';
import { VirtualLayerList } from './VirtualLayerList';

export function LayersPanel() {
  const panelRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();
  const { pages, activePageIndex, selectedElementIds } = useAppSelector((s) => s.builder);
  const [filter, setFilter] = useState<LayerFilter>('all');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<LayerContextMenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const page = pages[activePageIndex];
  const primarySelectedId = getPrimarySelectedId(selectedElementIds);

  const filteredElements = useMemo(() => {
    const base =
      filter === 'overlapping'
        ? filterOverlappingLayers(page.elements, primarySelectedId)
        : sortByLayer(page.elements);
    return [...base].reverse();
  }, [filter, page.elements, primarySelectedId]);

  const orderedIds = useMemo(
    () => filteredElements.map((el) => el.id),
    [filteredElements]
  );

  const { handleSelect } = useLayerSelection(orderedIds);

  const sortableIds = orderedIds;
  const activeDragElement = activeDragId
    ? filteredElements.find((el) => el.id === activeDragId)
    : undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortableIds.indexOf(String(active.id));
      const newIndex = sortableIds.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;

      const frontToBack = arrayMove(sortableIds, oldIndex, newIndex);
      const backToFront = [...frontToBack].reverse();

      if (filter === 'all') {
        dispatch(reorderPageLayers({ elementIds: backToFront }));
        return;
      }

      const allBackToFront = sortByLayer(page.elements).map((el) => el.id);
      const filteredSet = new Set(frontToBack);
      const merged = [...allBackToFront];
      let fi = 0;
      for (let i = 0; i < merged.length; i += 1) {
        if (filteredSet.has(merged[i])) {
          merged[i] = backToFront[fi];
          fi += 1;
        }
      }
      dispatch(reorderPageLayers({ elementIds: merged }));
    },
    [dispatch, filter, page.elements, sortableIds]
  );

  const handleDragCancel = useCallback(() => setActiveDragId(null), []);

  const handleContextMenu = useCallback((element: CanvasElement, event: MouseEvent) => {
    setContextMenu({ element, x: event.clientX, y: event.clientY });
  }, []);

  const startRename = useCallback((element: CanvasElement) => {
    setRenamingId(element.id);
    setRenameValue(getLayerLabel(element));
  }, []);

  const commitRename = useCallback(() => {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      dispatch(
        updateElement({
          id: renamingId,
          changes: { props: { label: trimmed } },
          recordHistory: true,
        })
      );
    }
    setRenamingId(null);
    setRenameValue('');
  }, [dispatch, renameValue, renamingId]);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
  }, []);

  const contextLayerIndex = contextMenu
    ? getLayerIndex(page.elements, contextMenu.element.id)
    : 0;
  const maxLayer = Math.max(0, sortByLayer(page.elements).length - 1);

  useEffect(() => {
    if (primarySelectedId) setFocusedId(primarySelectedId);
  }, [primarySelectedId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!panelRef.current?.contains(document.activeElement)) return;
      if (!focusedId || renamingId) return;
      const idx = orderedIds.indexOf(focusedId);
      if (e.key === 'ArrowDown' && idx < orderedIds.length - 1) {
        e.preventDefault();
        const next = orderedIds[idx + 1];
        setFocusedId(next);
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          dispatch(selectElement(next));
        }
      }
      if (e.key === 'ArrowUp' && idx > 0) {
        e.preventDefault();
        const prev = orderedIds[idx - 1];
        setFocusedId(prev);
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          dispatch(selectElement(prev));
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, focusedId, orderedIds, renamingId]);

  return (
    <div ref={panelRef} className="flex min-h-0 flex-1 flex-col gap-3 outline-none" tabIndex={-1}>
      <LayerFilterSegment value={filter} onChange={setFilter} />

      {filter === 'overlapping' && filteredElements.length === 0 && (
        <p className="px-2 text-center text-xs text-gray-400">No overlapping layers</p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <VirtualLayerList
            key={filter}
            elements={filteredElements}
            selectedElementIds={selectedElementIds}
            showPageRow={filter === 'all'}
            focusedId={focusedId}
            renamingId={renamingId}
            renameValue={renameValue}
            onSelect={handleSelect}
            onContextMenu={handleContextMenu}
            onToggleVisible={(id) => dispatch(toggleElementVisible(id))}
            onToggleLock={(id) => dispatch(toggleElementLock(id))}
            onTogglePin={(id) => dispatch(toggleElementPin(id))}
            onRenameChange={setRenameValue}
            onRenameCommit={commitRename}
            onRenameCancel={cancelRename}
          />
        </SortableContext>

        <DragOverlay dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
          {activeDragElement ? (
            <DragLayerPreview
              element={activeDragElement}
              selected={selectedElementIds.includes(activeDragElement.id)}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <LayerContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        onRename={startRename}
        onCopy={(element) => {
          writeBuilderClipboard([element]);
          toast.success('Component copied');
        }}
        onDuplicate={(id) => dispatch(duplicateElement(id))}
        onToggleVisible={(id) => dispatch(toggleElementVisible(id))}
        onToggleLock={(id) => dispatch(toggleElementLock(id))}
        onTogglePin={(id) => dispatch(toggleElementPin(id))}
        onDelete={(id) => dispatch(deleteElement(id))}
        onMoveLayer={(id, layer) => dispatch(setElementLayer({ id, layer }))}
        layerIndex={contextLayerIndex}
        maxLayer={maxLayer}
      />
    </div>
  );
}
