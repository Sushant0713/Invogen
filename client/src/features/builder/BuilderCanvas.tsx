import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import { addElement, updateElement, selectElement, toggleElementInSelection, setElementSelection, setImageCropMode, setShapeCropMode, clearTableCellSelection } from '@/store/slices/builderSlice';
import { ElementRenderer } from './ElementRenderer';
import { SmartGuides } from './image-editor/SmartGuides';
import { ElementRotationOverlay } from './ElementRotationOverlay';
import { useBuilderKeyboard } from './image-editor/hooks/useBuilderKeyboard';
import { snapElementBounds } from './image-editor/snappingUtils';
import { applyAspectRatioLock } from './image-editor/transformUtils';
import {
  getPageDimensions,
  createCanvasElement,
  getDefaultElementSize,
  isPaletteDrag,
  parsePaletteDrag,
  canvasPointFromDrop,
  clampElementPosition,
  getActivePaletteDrag,
  setActivePaletteDrag,
} from './builder-dnd';
import {
  isTableElementType,
  productTablePropsToRecord,
  scaleTableLayout,
} from './product-table';
import { clampTableElementToPage } from './table-element-size';
import { normalizeTablePropsForType } from './table-props-normalize';
import { getElementResizeProps } from './builder-resize-handles';
import {
  clampAnchoredBounds,
  computeAnchoredResize,
  snapAnchoredBounds,
  type ResizeSession,
} from './element-resize';
import { getInlineEditPropKey, isInlineCanvasEditable, isDataFieldType } from './text-styles';
import { recordAssetUse } from './asset-library/sidebar-store';
import { ElementFloatingActions } from './ElementFloatingActions';
import {
  type CanvasInteractionMode,
  supportsInteractionModeToggle,
} from './builder-interaction';
import { isImageComponentType } from './image-components';
import {
  getElementRotation,
  getElementRotationTransformStyle,
  supportsElementRotation,
} from './element-rotation';
import type { SnapGuide } from './image-editor/types';
import {
  sortByLayer,
  getCanvasZIndex,
  getDisplayOpacity,
  getElementPointerEvents,
  findTopElementAtPoint,
  findElementsAtPoint,
  pickStackedClickTarget,
  shouldUseStackedClickSelection,
  BUILDER_CANVAS_Z,
  BUILDER_OVERLAY_Z,
} from './element-layers';
import { getPrimarySelectedId } from './builder-selection';
import {
  getElementsInMarquee,
  MARQUEE_DRAG_THRESHOLD_PX,
  normalizeMarquee,
  type PageRect,
} from './marquee-selection';
import {
  isStructuredContentType,
} from './structured-content-layout';

const GRID_SIZE = 4;
const MIN_ELEMENT_SIZE = 24;
const DRAG_MOVE_THRESHOLD_PX = 4;
export const BUILDER_ELEMENT_ID_ATTR = 'data-builder-element-id';

function isPointerOnBuilderElement(target: HTMLElement, elementId: string): boolean {
  return !!target.closest(`[${BUILDER_ELEMENT_ID_ATTR}="${elementId}"]`);
}

function getDomHitBuilderElement(
  target: HTMLElement,
  elements: CanvasElement[]
): CanvasElement | null {
  const node = target.closest(`[${BUILDER_ELEMENT_ID_ATTR}]`) as HTMLElement | null;
  const id = node?.getAttribute(BUILDER_ELEMENT_ID_ATTR);
  if (!id) return null;
  return elements.find((el) => el.id === id) ?? null;
}

function isSelectableBuilderTarget(element: CanvasElement): boolean {
  if (element.locked) return false;
  if ((element.props as Record<string, unknown> | undefined)?.isReferenceBackground === true) {
    return false;
  }
  return true;
}

function shouldDeferStackedSelectionToDomHit(
  domHit: CanvasElement | null,
  stack: CanvasElement[]
): boolean {
  if (!domHit || !isSelectableBuilderTarget(domHit)) return false;
  return stack.some((el) => el.id === domHit.id);
}

const snap = (value: number, enabled: boolean) =>
  enabled ? Math.round(value / GRID_SIZE) * GRID_SIZE : Math.round(value);

export function BuilderCanvas() {
  const dispatch = useAppDispatch();
  const canvasRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const marginBoundsRef = useRef<HTMLDivElement>(null);
  const [dragBounds, setDragBounds] = useState<string | Element>('parent');
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{ id: string; x: number; y: number } | null>(null);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<CanvasInteractionMode>('move');
  const [pendingEditChar, setPendingEditChar] = useState<string | null>(null);
  const [dropPreview, setDropPreview] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  // Tracks resize session for anchor-based resizing
  const resizeSessionRef = useRef<(ResizeSession & { id: string; dir: string }) | null>(null);
  const dragSessionRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const shiftKeyRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const marqueeSessionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    additive: boolean;
    dragged: boolean;
  } | null>(null);
  const skipClickClearRef = useRef(false);
  const stackedClickRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<PageRect | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const { pages, activePageIndex, selectedElementIds, selectedTableCell, selectedTableCells, imageCropElementId, shapeCropElementId, zoom, snapToGrid } =
    useAppSelector((s) => s.builder);
  const page = pages[activePageIndex];
  const primarySelectedId = getPrimarySelectedId(selectedElementIds);
  const margins = page.margins;
  const pageSize = getPageDimensions(page);
  const grid = snapToGrid ? [GRID_SIZE, GRID_SIZE] as [number, number] : undefined;

  useBuilderKeyboard();

  useEffect(() => {
    setInteractionMode('move');
  }, [primarySelectedId]);

  const applyInteractionMode = useCallback(
    (mode: CanvasInteractionMode, elementId: string) => {
      setInteractionMode(mode);
      const el = page.elements.find((item) => item.id === elementId);
      if (!el) return;

      if (mode === 'move') {
        setEditingElementId(null);
        setPendingEditChar(null);
        dispatch(selectElement(elementId));
        if (isTableElementType(el.type)) {
          dispatch(clearTableCellSelection());
        }
        (document.activeElement as HTMLElement | null)?.blur?.();
        return;
      }

      dispatch(selectElement(elementId));
      if (isInlineCanvasEditable(el.type) || isDataFieldType(el.type)) {
        setEditingElementId(elementId);
      } else {
        setEditingElementId(null);
      }
    },
    [dispatch, page.elements]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftKeyRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftKeyRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useLayoutEffect(() => {
    if (marginBoundsRef.current) {
      setDragBounds(marginBoundsRef.current);
    }
  }, [margins.top, margins.right, margins.bottom, margins.left]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (imageCropElementId) {
          dispatch(setImageCropMode(null));
          return;
        }
        if (shapeCropElementId) {
          dispatch(setShapeCropMode(null));
          return;
        }
        if (selectedTableCell || selectedTableCells.length > 0) {
          dispatch(clearTableCellSelection());
          (document.activeElement as HTMLElement | null)?.blur?.();
          return;
        }
        if (editingElementId) {
          setEditingElementId(null);
          setPendingEditChar(null);
          (document.activeElement as HTMLElement | null)?.blur?.();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [imageCropElementId, shapeCropElementId, editingElementId, selectedTableCell, selectedTableCells.length, dispatch]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editingElementId) return;
      if (!primarySelectedId) return;

      const target = e.target as HTMLElement;
      if (
        target.isContentEditable
        || target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT'
      ) {
        return;
      }

      const el = page.elements.find((item) => item.id === primarySelectedId);
      if (!el || !isInlineCanvasEditable(el.type) || el.locked) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        setInteractionMode('edit');
        setEditingElementId(primarySelectedId);
        return;
      }

      if (e.key.length === 1) {
        e.preventDefault();
        setInteractionMode('edit');
        setPendingEditChar(e.key);
        setEditingElementId(primarySelectedId);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingElementId, primarySelectedId, page.elements]);

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return null;
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / zoom,
        y: (clientY - rect.top) / zoom,
      };
    },
    [zoom]
  );

  const finishMarqueeSession = useCallback(
    (pointerId: number, releaseTarget: HTMLElement | null) => {
      const session = marqueeSessionRef.current;
      if (!session || session.pointerId !== pointerId) return;

      marqueeSessionRef.current = null;
      setMarqueeBox(null);

      if (releaseTarget) {
        try {
          releaseTarget.releasePointerCapture(pointerId);
        } catch {
          // pointer may already be released
        }
      }

      if (session.dragged) {
        const box = normalizeMarquee(
          session.startX,
          session.startY,
          session.currentX,
          session.currentY
        );
        const ids = getElementsInMarquee(page.elements, box);
        dispatch(setElementSelection({ ids, additive: session.additive }));
        skipClickClearRef.current = true;
        return;
      }

      setEditingElementId(null);
      setPendingEditChar(null);
      dispatch(selectElement(null));
    },
    [dispatch, page.elements]
  );

  const handleMarqueePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (imageCropElementId || shapeCropElementId || editingElementId) return;

    const pt = getCanvasPoint(e.clientX, e.clientY);
    if (!pt) return;

    const hit = findTopElementAtPoint(page.elements, pt.x, pt.y);
    if (hit) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    marqueeSessionRef.current = {
      pointerId: e.pointerId,
      startX: pt.x,
      startY: pt.y,
      currentX: pt.x,
      currentY: pt.y,
      additive: e.shiftKey || e.ctrlKey || e.metaKey,
      dragged: false,
    };
  };

  const handleMarqueePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const session = marqueeSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;

    const pt = getCanvasPoint(e.clientX, e.clientY);
    if (!pt) return;

    session.currentX = pt.x;
    session.currentY = pt.y;

    const dx = Math.abs(session.currentX - session.startX);
    const dy = Math.abs(session.currentY - session.startY);
    if (!session.dragged && (dx > MARQUEE_DRAG_THRESHOLD_PX || dy > MARQUEE_DRAG_THRESHOLD_PX)) {
      session.dragged = true;
    }

    if (session.dragged) {
      setMarqueeBox(
        normalizeMarquee(session.startX, session.startY, session.currentX, session.currentY)
      );
    }
  };

  const handleMarqueePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    handleStackedPointerUp(e);
    finishMarqueeSession(e.pointerId, e.currentTarget);
  };

  const handleStackedPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const pending = stackedClickRef.current;
    stackedClickRef.current = null;
    if (!pending || pending.pointerId !== e.pointerId) return;
    if (draggingElementId) return;
    if (dragSessionRef.current?.moved) return;

    const dx = Math.abs(e.clientX - pending.startX);
    const dy = Math.abs(e.clientY - pending.startY);
    if (dx > DRAG_MOVE_THRESHOLD_PX || dy > DRAG_MOVE_THRESHOLD_PX) return;

    const pt = getCanvasPoint(e.clientX, e.clientY);
    if (!pt) return;

    const stack = findElementsAtPoint(page.elements, pt.x, pt.y, { includeLocked: true });
    if (!shouldUseStackedClickSelection(stack, primarySelectedId)) return;

    const hit = pickStackedClickTarget(stack, primarySelectedId);
    if (!hit || hit.id === primarySelectedId) return;

    skipClickClearRef.current = true;
    setEditingElementId(null);
    setPendingEditChar(null);
    dispatch(selectElement(hit.id));
  };

  const handleCanvasClick = () => {
    if (skipClickClearRef.current) {
      skipClickClearRef.current = false;
      return;
    }
    setEditingElementId(null);
    setPendingEditChar(null);
    if (shapeCropElementId) {
      dispatch(setShapeCropMode(null));
      return;
    }
    dispatch(selectElement(null));
  };

  const handleStackedPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (imageCropElementId || shapeCropElementId || editingElementId) return;
    if (e.shiftKey || e.ctrlKey || e.metaKey) return;

    const target = e.target as HTMLElement;
    if (target.closest('.builder-table-cell-editor')) return;
    if (selectedTableCell && selectedTableCells.length === 1) return;

    const pt = getCanvasPoint(e.clientX, e.clientY);
    if (!pt) return;

    const stack = findElementsAtPoint(page.elements, pt.x, pt.y, { includeLocked: true });
    if (!shouldUseStackedClickSelection(stack, primarySelectedId)) return;

    const domHit = getDomHitBuilderElement(target, page.elements);
    if (shouldDeferStackedSelectionToDomHit(domHit, stack)) {
      return;
    }

    // Let drag / resize on the already-selected element proceed (don't cycle on pointerdown).
    if (primarySelectedId && isPointerOnBuilderElement(target, primarySelectedId)) {
      stackedClickRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
      };
      return;
    }

    const hit = pickStackedClickTarget(stack, primarySelectedId);
    if (!hit) return;

    stackedClickRef.current = null;
    e.preventDefault();
    e.stopPropagation();
    skipClickClearRef.current = true;
    setEditingElementId(null);
    setPendingEditChar(null);
    dispatch(selectElement(hit.id));
  };

  const commitResize = useCallback(
    (
      id: string,
      direction: string,
      position: { x: number; y: number },
      size: { width: number; height: number }
    ) => {
      const session = resizeSessionRef.current;
      const element = page.elements.find((el) => el.id === id);
      if (!session || session.id !== id || !element) return;

      const raw = computeAnchoredResize(
        session,
        direction,
        position,
        size,
        MIN_ELEMENT_SIZE
      );
      const clamped = clampAnchoredBounds(raw, session, direction, margins, MIN_ELEMENT_SIZE);
      const snapped = snapAnchoredBounds(
        clamped,
        session,
        direction,
        margins,
        snapToGrid,
        GRID_SIZE,
        MIN_ELEMENT_SIZE
      );

      const aspectLocked = isImageComponentType(element.type)
        ? applyAspectRatioLock(snapped, session, direction, shiftKeyRef.current)
        : snapped;

      if (isTableElementType(element.type)) {
        const table = normalizeTablePropsForType(element.type, (element.props ?? {}) as Record<string, unknown>);
        const scaleX = aspectLocked.width / Math.max(element.width, 1);
        const scaleY = aspectLocked.height / Math.max(element.height, 1);
        const scaled = scaleTableLayout(table, scaleX, scaleY);
        const tableClamped = clampTableElementToPage(
          aspectLocked.x,
          aspectLocked.y,
          scaled,
          pageSize.width,
          pageSize.height,
          margins,
          element.type
        );
        dispatch(updateElement({
          id,
          changes: {
            x: tableClamped.x,
            y: tableClamped.y,
            width: tableClamped.width,
            height: tableClamped.height,
            props: productTablePropsToRecord(tableClamped.table),
          },
          recordHistory: true,
        }));
        return;
      }

      dispatch(updateElement({
        id,
        changes: aspectLocked,
        recordHistory: true,
      }));
    },
    [dispatch, margins, page.elements, snapToGrid]
  );

  const handleDragStop = useCallback(
    (id: string, x: number, y: number, width: number, height: number) => {
      const others = page.elements
        .filter((el) => el.id !== id)
        .map((el) => ({ x: el.x, y: el.y, width: el.width, height: el.height }));

      const snapped = snapElementBounds(
        { x, y, width, height },
        others,
        margins,
        snapToGrid,
        GRID_SIZE
      );

      setSnapGuides([]);

      dispatch(updateElement({
        id,
        changes: { x: snapped.x, y: snapped.y },
        recordHistory: true,
      }));
    },
    [dispatch, snapToGrid, margins, page.elements]
  );

  const handleResizeStop = useCallback(
    (
      id: string,
      direction: string,
      position: { x: number; y: number },
      size: { width: number; height: number }
    ) => {
      commitResize(id, direction, position, size);
      resizeSessionRef.current = null;
    },
    [commitResize]
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!isPaletteDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);

    const payload = getActivePaletteDrag();
    const canvas = canvasRef.current;
    if (!payload || !canvas) return;

    const { width, height } = getDefaultElementSize(payload.type);
    const rect = canvas.getBoundingClientRect();
    const { x, y } = canvasPointFromDrop(
      event.clientX,
      event.clientY,
      rect,
      zoom,
      width,
      height
    );
    const position = clampElementPosition(
      snap(x, snapToGrid),
      snap(y, snapToGrid),
      width,
      height,
      margins
    );
    setDropPreview({ ...position, width, height });
  }, [snapToGrid, zoom, margins]);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const related = event.relatedTarget as Node | null;
    if (!related || !event.currentTarget.contains(related)) {
      setIsDragOver(false);
      setDropPreview(null);
    }
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
      setDropPreview(null);
      setActivePaletteDrag(null);

      const payload = parsePaletteDrag(event.dataTransfer);
      const canvas = canvasRef.current;
      if (!payload || !canvas) return;

      const { width, height } = getDefaultElementSize(payload.type);
      const rect = canvas.getBoundingClientRect();
      const { x, y } = canvasPointFromDrop(
        event.clientX,
        event.clientY,
        rect,
        zoom,
        width,
        height
      );
      const position = clampElementPosition(
        snap(x, snapToGrid),
        snap(y, snapToGrid),
        width,
        height,
        margins
      );

      const element = createCanvasElement(
        payload.type,
        position.x,
        position.y,
        payload.defaultProps || {},
        margins
      );
      dispatch(addElement(element));
      recordAssetUse(payload.paletteId ?? payload.type);
    },
    [dispatch, snapToGrid, zoom, margins]
  );

  const selectedElement = primarySelectedId
    ? page.elements.find((el) => el.id === primarySelectedId)
    : null;
  const isSingleSelection = selectedElementIds.length === 1;

  const tableEditElement =
    selectedTableCell && selectedTableCells.length === 1
      ? page.elements.find((el) => el.id === selectedTableCell.elementId)
      : undefined;
  const tableEditBounds = tableEditElement
    ? {
        tableId: tableEditElement.id,
        x: tableEditElement.x,
        y: tableEditElement.y,
        width: tableEditElement.width,
        height: tableEditElement.height,
      }
    : undefined;

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#e8e8ed] [overflow-anchor:none]">
      <div className="flex min-h-full justify-center p-10">
        <div
          className="relative shrink-0"
          style={{
            width: pageSize.width * zoom,
            height: pageSize.height * zoom,
          }}
        >
          <div
            ref={canvasRef}
            className={`builder-canvas absolute left-0 top-0 bg-white shadow-xl ring-1 transition-shadow ${
              isDragOver ? 'ring-2 ring-primary/40' : 'ring-black/5'
            }`}
            style={{
              width: pageSize.width,
              height: pageSize.height,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              overflow: shapeCropElementId ? 'visible' : 'hidden',
              zIndex: BUILDER_CANVAS_Z,
            }}
            onClick={handleCanvasClick}
            onPointerDown={handleMarqueePointerDown}
            onPointerMove={handleMarqueePointerMove}
            onPointerUp={handleMarqueePointerUp}
            onPointerCancel={(e) => {
              if (stackedClickRef.current?.pointerId === e.pointerId) {
                stackedClickRef.current = null;
              }
              finishMarqueeSession(e.pointerId, e.currentTarget);
            }}
            onPointerDownCapture={handleStackedPointerDown}
            onDragOverCapture={handleDragOver}
            onDragLeaveCapture={handleDragLeave}
            onDropCapture={handleDrop}
          >
            {isDragOver && (
              <div className="pointer-events-none absolute inset-0 z-[9998] bg-primary/[0.03]" />
            )}

            {dropPreview && (
              <div
                className="pointer-events-none absolute z-[9999] rounded-sm bg-primary/10"
                style={{
                  left: dropPreview.x,
                  top: dropPreview.y,
                  width: dropPreview.width,
                  height: dropPreview.height,
                }}
              />
            )}

            <div
              ref={marginBoundsRef}
              className="pointer-events-none absolute border border-dashed border-gray-200"
              style={{
                top: page.margins.top,
                right: page.margins.right,
                bottom: page.margins.bottom,
                left: page.margins.left,
              }}
            />

            <SmartGuides guides={snapGuides} />

            {marqueeBox && marqueeBox.width > 0 && marqueeBox.height > 0 && (
              <div
                className="pointer-events-none absolute z-[9996] border-2 border-dashed border-primary bg-primary/10"
                style={{
                  left: marqueeBox.x,
                  top: marqueeBox.y,
                  width: marqueeBox.width,
                  height: marqueeBox.height,
                }}
              />
            )}

            {sortByLayer(page.elements).map((element) => {
              const isSelected = selectedElementIds.includes(element.id);
              const isEditing =
                interactionMode === 'edit' && editingElementId === element.id;
              const elementInteractionMode =
                primarySelectedId === element.id ? interactionMode : 'move';
              const isDragging = draggingElementId === element.id;
              const isCropMode = imageCropElementId === element.id || shapeCropElementId === element.id;
              const elementProps = (element.props ?? {}) as Record<string, unknown>;
              const isReferenceBg = elementProps.isReferenceBackground === true;
              const inlineEditKey = getInlineEditPropKey(element.type);
              const layerOpacity = getDisplayOpacity(element, page.elements, {
                isSelected,
                isDragging,
                dragPosition,
              });
              const isTable = isTableElementType(element.type);
              const elementRotation = getElementRotation(elementProps);
              const rotationStyle = getElementRotationTransformStyle(element.type, elementProps);
              const isRotatable = supportsElementRotation(element.type);
              const resizeProps = getElementResizeProps(
                isSelected,
                !!element.locked,
                isDragging,
                isEditing,
                isCropMode,
                elementRotation,
                { canvaTable: isTable }
              );
              return (
              <Rnd
                key={element.id}
                {...{ [BUILDER_ELEMENT_ID_ATTR]: element.id }}
                scale={zoom}
                bounds={dragBounds}
                position={{ x: element.x, y: element.y }}
                size={{ width: element.width, height: element.height }}
                dragGrid={grid}
                resizeGrid={undefined}
                // Tables move only via the bottom move control (dragHandleClassName).
                dragHandleClassName={
                  isTable && isSelected && !element.locked
                    ? 'builder-table-move-handle'
                    : undefined
                }
                cancel={
                  isCropMode
                    ? '.shape-clip-handle'
                    : isEditing
                      ? '.builder-text-editor, .outline-list-editor'
                      : undefined
                }
                onDragStart={() => {
                  stackedClickRef.current = null;
                  setEditingElementId(null);
                  setDraggingElementId(element.id);
                  setDragPosition({ id: element.id, x: element.x, y: element.y });
                  dragSessionRef.current = {
                    id: element.id,
                    startX: element.x,
                    startY: element.y,
                    moved: false,
                  };
                  dispatch(selectElement(element.id));
                }}
                onDrag={(_e, d) => {
                  const session = dragSessionRef.current;
                  if (!session || session.id !== element.id) return;

                  setDragPosition({ id: element.id, x: d.x, y: d.y });
                  if (imageCropElementId || shapeCropElementId) return;

                  const dx = Math.abs(d.x - session.startX);
                  const dy = Math.abs(d.y - session.startY);
                  if (!session.moved && dx < DRAG_MOVE_THRESHOLD_PX && dy < DRAG_MOVE_THRESHOLD_PX) {
                    return;
                  }
                  session.moved = true;

                  const others = page.elements
                    .filter((el) => el.id !== element.id)
                    .map((el) => ({ x: el.x, y: el.y, width: el.width, height: el.height }));
                  const snapped = snapElementBounds(
                    { x: d.x, y: d.y, width: element.width, height: element.height },
                    others,
                    margins,
                    snapToGrid,
                    GRID_SIZE
                  );
                  setSnapGuides(snapped.guides);
                  dispatch(updateElement({
                    id: element.id,
                    changes: { x: snapped.x, y: snapped.y },
                    recordHistory: false,
                  }));
                }}
                onDragStop={(_e, d) => {
                  const session = dragSessionRef.current;
                  dragSessionRef.current = null;
                  setDraggingElementId(null);
                  setDragPosition(null);

                  if (!session?.moved) {
                    setSnapGuides([]);
                    return;
                  }

                  handleDragStop(element.id, d.x, d.y, element.width, element.height);
                }}
                onResizeStart={(_e, dir) => {
                  resizeSessionRef.current = {
                    id: element.id,
                    dir: dir as string,
                    startX: element.x,
                    startY: element.y,
                    startW: element.width,
                    startH: element.height,
                  };
                }}
                onResize={(_e, dir, ref, _delta, position) => {
                  if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
                  rafRef.current = requestAnimationFrame(() => {
                    rafRef.current = null;
                    const session = resizeSessionRef.current;
                    if (!session || session.id !== element.id) return;

                    let bounds = computeAnchoredResize(
                      session,
                      dir as string,
                      position,
                      { width: ref.offsetWidth, height: ref.offsetHeight },
                      MIN_ELEMENT_SIZE
                    );

                    if (isImageComponentType(element.type)) {
                      bounds = applyAspectRatioLock(
                        bounds,
                        session,
                        dir as string,
                        shiftKeyRef.current
                      );
                    }

                    dispatch(updateElement({
                      id: element.id,
                      changes: bounds,
                      recordHistory: false,
                    }));
                  });
                }}
                onResizeStop={(_e, dir, ref, _delta, position) => {
                  if (rafRef.current !== null) {
                    cancelAnimationFrame(rafRef.current);
                    rafRef.current = null;
                  }
                  handleResizeStop(element.id, dir as string, position, {
                    width: ref.offsetWidth,
                    height: ref.offsetHeight,
                  });
                }}
                {...resizeProps}
                disableDragging={
                  !!element.locked
                  || isCropMode
                  || !isSelected
                  || (isEditing && !isTable)
                }
                className={
                  [
                    'builder-element-slot',
                    isSelected
                      ? [
                          isTable ? 'builder-rnd-table-selected' : 'builder-rnd-selected',
                          isCropMode ? 'builder-crop-active' : '',
                          isRotatable && !isTable ? 'builder-rnd-rotatable' : '',
                          elementRotation !== 0 ? 'builder-rnd-rotated' : '',
                          isTable && isDragging ? 'builder-rnd-table-dragging' : '',
                        ].filter(Boolean).join(' ')
                      : '',
                  ].filter(Boolean).join(' ') || undefined
                }
                style={{
                  zIndex: getCanvasZIndex(element, page.elements, {
                    isSelected,
                    isDragging,
                    isShapeCrop: shapeCropElementId === element.id,
                    isTableEditing:
                      selectedTableCell?.elementId === element.id
                      && selectedTableCells.length === 1,
                  }),
                  overflow:
                    isCropMode
                    || elementRotation !== 0
                    || isTable
                    || (isSelected && !isEditing && !isStructuredContentType(element.type))
                      ? 'visible'
                      : 'hidden',
                  pointerEvents: getElementPointerEvents(element, {
                    isSelected,
                    isReferenceBg,
                    tableEditBounds,
                  }),
                }}
              >
                <div
                  className="builder-element-rotate h-full w-full"
                  style={rotationStyle ?? undefined}
                >
                <ElementRenderer
                  element={element}
                  isSelected={isSelected}
                  isEditing={isEditing}
                  interactionMode={elementInteractionMode}
                  isCanvasDragging={isDragging}
                  isShapeCropMode={shapeCropElementId === element.id}
                  layerOpacity={layerOpacity}
                  onSelect={(additive) => {
                    if (additive) {
                      dispatch(toggleElementInSelection(element.id));
                    } else {
                      dispatch(selectElement(element.id));
                    }
                    if (editingElementId && editingElementId !== element.id) {
                      setEditingElementId(null);
                      setPendingEditChar(null);
                    }
                  }}
                  onInteractionModeChange={(mode) => applyInteractionMode(mode, element.id)}
                  onStartEdit={() => {
                    if (!element.locked) {
                      applyInteractionMode('edit', element.id);
                      if (!isTableElementType(element.type)) {
                        setEditingElementId(element.id);
                      }
                    }
                  }}
                  pendingEditChar={isEditing ? pendingEditChar : null}
                  onPendingEditCharConsumed={() => setPendingEditChar(null)}
                  onUpdateContent={
                    inlineEditKey
                      ? (value) => {
                          dispatch(updateElement({
                            id: element.id,
                            changes: { props: { ...elementProps, [inlineEditKey]: value } },
                            recordHistory: false,
                          }));
                        }
                      : undefined
                  }
                  onCommitContent={
                    inlineEditKey
                      ? (value) => {
                          dispatch(updateElement({
                            id: element.id,
                            changes: { props: { ...elementProps, [inlineEditKey]: value } },
                            recordHistory: true,
                          }));
                          setEditingElementId(null);
                          setPendingEditChar(null);
                        }
                      : undefined
                  }
                  onCommitRichContent={
                    inlineEditKey
                      ? (payload) => {
                          dispatch(updateElement({
                            id: element.id,
                            changes: {
                              props: {
                                ...elementProps,
                                content: payload.content,
                                text: payload.text,
                                textRuns: payload.textRuns,
                              },
                            },
                            recordHistory: true,
                          }));
                          setEditingElementId(null);
                          setPendingEditChar(null);
                        }
                      : undefined
                  }
                  onUpdateProps={(patch, recordHistory) => {
                    dispatch(updateElement({
                      id: element.id,
                      changes: { props: patch },
                      recordHistory: !!recordHistory,
                    }));
                  }}
                  onStructuredContentHeight={
                    isStructuredContentType(element.type)
                      ? (height) => {
                          if (Math.abs(height - element.height) <= 1) return;
                          dispatch(updateElement({
                            id: element.id,
                            changes: { height },
                            recordHistory: false,
                          }));
                        }
                      : undefined
                  }
                />
                </div>
              </Rnd>
            );
            })}

          </div>

          <div
            ref={overlayRef}
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: BUILDER_OVERLAY_Z }}
          >
          {selectedElement && isSingleSelection && !imageCropElementId && (
            <ElementFloatingActions
              element={selectedElement}
              elements={page.elements}
              dragPosition={dragPosition}
              zoom={zoom}
              shapeCropElementId={shapeCropElementId}
              interactionMode={interactionMode}
              // Tables: keep toolbar (lock/copy/delete) but no Move/Edit icons —
              // move is the bottom control; selection is click-on-table.
              supportsInteractionToggle={
                supportsInteractionModeToggle(selectedElement.type)
                && !isTableElementType(selectedElement.type)
              }
              onInteractionModeChange={(mode) => applyInteractionMode(mode, selectedElement.id)}
              toolbarBelow={supportsElementRotation(selectedElement.type)}
            />
          )}

          {selectedElement &&
            isSingleSelection &&
            supportsElementRotation(selectedElement.type) &&
            !imageCropElementId &&
            shapeCropElementId !== selectedElement.id &&
            editingElementId !== selectedElement.id && (
              <ElementRotationOverlay
                x={selectedElement.x}
                y={selectedElement.y}
                width={selectedElement.width}
                height={selectedElement.height}
                rotation={getElementRotation(selectedElement.props as Record<string, unknown>)}
                zoom={zoom}
                minSize={MIN_ELEMENT_SIZE}
                lockAspectRatio={isImageComponentType(selectedElement.type)}
                overlayRef={overlayRef}
                onRotate={(nextRotation, recordHistory) => {
                  const p = (selectedElement.props ?? {}) as Record<string, unknown>;
                  dispatch(
                    updateElement({
                      id: selectedElement.id,
                      changes: { props: { ...p, rotation: nextRotation } },
                      recordHistory: !!recordHistory,
                    })
                  );
                }}
                onBoundsChange={(bounds, recordHistory) => {
                  dispatch(
                    updateElement({
                      id: selectedElement.id,
                      changes: {
                        x: bounds.x,
                        y: bounds.y,
                        width: bounds.width,
                        height: bounds.height,
                      },
                      recordHistory: !!recordHistory,
                    })
                  );
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
