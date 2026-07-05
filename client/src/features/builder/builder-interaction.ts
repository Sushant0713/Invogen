import { ComponentType } from '@invogen/shared';
import { isTableElementType } from './product-table';
import { isDataFieldType, isInlineCanvasEditable } from './text-styles';

export type CanvasInteractionMode = 'move' | 'edit';

export function supportsInteractionModeToggle(type: string): boolean {
  return (
    isInlineCanvasEditable(type)
    || isDataFieldType(type)
    || isTableElementType(type)
  );
}
