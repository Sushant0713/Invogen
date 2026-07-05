import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import {
  deleteSelectedElements,
  duplicateElement,
  redo,
  setImageCropMode,
  setShapeCropMode,
  toggleSelectedElementsLock,
  undo,
  updateElement,
} from '@/store/slices/builderSlice';
import { getPrimarySelectedId } from '@/features/builder/builder-selection';

interface Options {
  enabled?: boolean;
}

export function useBuilderKeyboard({ enabled = true }: Options = {}) {
  const dispatch = useAppDispatch();
  const { selectedElementIds, imageCropElementId, shapeCropElementId, pages, activePageIndex } =
    useAppSelector((s) => s.builder);

  const page = pages[activePageIndex];
  const primarySelectedId = getPrimarySelectedId(selectedElementIds);
  const selected = primarySelectedId
    ? page.elements.find((el) => el.id === primarySelectedId)
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

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) dispatch(redo());
        else dispatch(undo());
        return;
      }

      if (!hasSelection || imageCropElementId || shapeCropElementId) return;

      if (mod && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        dispatch(toggleSelectedElementsLock());
        return;
      }

      if (selectedElementIds.length === 1 && selected && !selected.locked) {
        if (mod && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          dispatch(duplicateElement(selected.id));
          return;
        }

        if (mod && e.key.toLowerCase() === 'c') {
          e.preventDefault();
          sessionStorage.setItem('builder-clipboard-element', JSON.stringify(selected));
          return;
        }

        if (mod && e.key.toLowerCase() === 'v') {
          e.preventDefault();
          const raw = sessionStorage.getItem('builder-clipboard-element');
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as { id?: string };
              if (parsed?.id) dispatch(duplicateElement(parsed.id));
            } catch {
              /* ignore */
            }
          }
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
    selectedElementIds.length,
    imageCropElementId,
    shapeCropElementId,
  ]);
}
