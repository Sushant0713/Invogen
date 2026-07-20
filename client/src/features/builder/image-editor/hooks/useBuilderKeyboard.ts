import { useEffect } from 'react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import {
  deleteSelectedElements,
  duplicateElement,
  pasteElements,
  redo,
  selectAllElementsOnActivePage,
  setImageCropMode,
  setShapeCropMode,
  toggleSelectedElementsLock,
  undo,
  updateElement,
} from '@/store/slices/builderSlice';
import { getPrimarySelectedId } from '@/features/builder/builder-selection';
import { readBuilderClipboard, writeBuilderClipboard } from '@/features/builder/builder-clipboard';

interface Options {
  enabled?: boolean;
  getPastePosition?: () => { x: number; y: number } | null;
}

export function useBuilderKeyboard({ enabled = true, getPastePosition }: Options = {}) {
  const dispatch = useAppDispatch();
  const { selectedElementIds, imageCropElementId, shapeCropElementId, pages, activePageIndex } =
    useAppSelector((s) => s.builder);

  const page = pages[activePageIndex];
  const primarySelectedId = getPrimarySelectedId(selectedElementIds);
  const selected = primarySelectedId
    ? page?.elements.find((el) => el.id === primarySelectedId)
    : null;
  const hasSelection = selectedElementIds.length > 0;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.isContentEditable
        || target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT'
      ) {
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (e.key === 'Escape' && imageCropElementId) {
        e.preventDefault();
        dispatch(setImageCropMode(null));
        return;
      }

      if (e.key === 'Escape' && shapeCropElementId) {
        e.preventDefault();
        dispatch(setShapeCropMode(null));
        return;
      }

      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) dispatch(redo());
        else dispatch(undo());
        return;
      }

      if (mod && key === 'a') {
        e.preventDefault();
        dispatch(selectAllElementsOnActivePage());
        return;
      }

      // Paste works even with no selection (needed when switching templates).
      if (mod && key === 'v' && !imageCropElementId && !shapeCropElementId) {
        e.preventDefault();
        const clipped = readBuilderClipboard();
        if (clipped.length === 0) {
          toast.message('Nothing to paste — copy components first (Ctrl+C)');
          return;
        }
        const position = getPastePosition?.();
        dispatch(pasteElements(position ? { elements: clipped, position } : clipped));
        toast.success(
          clipped.length === 1
            ? 'Component pasted'
            : `${clipped.length} components pasted`
        );
        return;
      }

      if (!hasSelection || imageCropElementId || shapeCropElementId || !page) return;

      if (mod && e.shiftKey && key === 'l') {
        e.preventDefault();
        dispatch(toggleSelectedElementsLock());
        return;
      }

      if (mod && key === 'c') {
        e.preventDefault();
        const selectedSet = new Set(selectedElementIds);
        const toCopy = page.elements.filter((el) => selectedSet.has(el.id));
        if (toCopy.length === 0) return;
        writeBuilderClipboard(toCopy);
        toast.success(
          toCopy.length === 1
            ? 'Component copied'
            : `${toCopy.length} components copied`
        );
        return;
      }

      if (selectedElementIds.length === 1 && selected && !selected.locked) {
        if (mod && key === 'd') {
          e.preventDefault();
          dispatch(duplicateElement(selected.id));
          return;
        }

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          dispatch(
            updateElement({
              id: selected.id,
              changes: { x: selected.x + dx, y: selected.y + dy },
              recordHistory: true,
            })
          );
          return;
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        dispatch(deleteSelectedElements());
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    enabled,
    dispatch,
    selected,
    hasSelection,
    selectedElementIds,
    page,
    imageCropElementId,
    shapeCropElementId,
    getPastePosition,
  ]);
}
