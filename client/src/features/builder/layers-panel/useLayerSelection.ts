import { useCallback, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  selectElement,
  setElementSelection,
  toggleElementInSelection,
} from '@/store/slices/builderSlice';

export function useLayerSelection(orderedIds: string[]) {
  const dispatch = useAppDispatch();
  const [rangeAnchorId, setRangeAnchorId] = useState<string | null>(null);

  const handleSelect = useCallback(
    (id: string, event: MouseEvent | KeyboardEvent) => {
      const shift = 'shiftKey' in event && event.shiftKey;
      const additive = ('ctrlKey' in event && event.ctrlKey) || ('metaKey' in event && event.metaKey);

      if (shift && rangeAnchorId) {
        const anchorIndex = orderedIds.indexOf(rangeAnchorId);
        const targetIndex = orderedIds.indexOf(id);
        if (anchorIndex >= 0 && targetIndex >= 0) {
          const [start, end] =
            anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
          dispatch(setElementSelection({ ids: orderedIds.slice(start, end + 1) }));
          return;
        }
      }

      if (additive) {
        dispatch(toggleElementInSelection(id));
        setRangeAnchorId(id);
        return;
      }

      dispatch(selectElement(id));
      setRangeAnchorId(id);
    },
    [dispatch, orderedIds, rangeAnchorId]
  );

  return { handleSelect, rangeAnchorId, setRangeAnchorId };
}
