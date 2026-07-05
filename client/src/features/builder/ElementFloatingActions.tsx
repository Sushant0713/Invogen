import { useId, useState, type MouseEvent, type ReactNode } from 'react';
import { CopyPlus, Crop, Lock, LockOpen, Move, TextCursor, Trash2 } from 'lucide-react';
import type { CanvasElement } from '@invogen/shared';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import {
  duplicateElement,
  deleteElement,
  toggleElementLock,
  updateElement,
  setShapeCropMode,
} from '@/store/slices/builderSlice';
import { isShapeComponentType } from './shape-components';
import { isTableElementType } from './product-table';
import type { CanvasInteractionMode } from './builder-interaction';
import {
  getOpacityPercent,
  getToolbarZIndex,
  MIN_OPACITY_PERCENT,
  MAX_OPACITY_PERCENT,
} from './element-layers';
import { useToolbarPopover, ToolbarPopoverPanel } from './ToolbarPopover';
import { ShapeCropControls } from './ShapeCropControls';
import { shapeClipToProps, type ShapeClip } from './shape-clip';

interface Props {
  element: CanvasElement;
  elements: CanvasElement[];
  dragPosition: { id: string; x: number; y: number } | null;
  zoom: number;
  shapeCropElementId?: string | null;
  interactionMode?: CanvasInteractionMode;
  supportsInteractionToggle?: boolean;
  onInteractionModeChange?: (mode: CanvasInteractionMode) => void;
  /** Keep the action bar off the top edge so the rotation handle stays reachable. */
  toolbarBelow?: boolean;
}

function getElementPosition(
  element: CanvasElement,
  dragPosition: { id: string; x: number; y: number } | null
) {
  if (dragPosition?.id === element.id) {
    return { x: dragPosition.x, y: dragPosition.y };
  }
  return { x: element.x, y: element.y };
}

export function ElementFloatingActions({
  element,
  elements,
  dragPosition,
  zoom,
  shapeCropElementId,
  interactionMode = 'move',
  supportsInteractionToggle = false,
  onInteractionModeChange,
  toolbarBelow = false,
}: Props) {
  const dispatch = useAppDispatch();
  const locked = !!element.locked;
  const isShape = isShapeComponentType(element.type);
  const isTable = isTableElementType(element.type);
  const isShapeCropMode = shapeCropElementId === element.id;
  const { x, y } = getElementPosition(element, dragPosition);
  const centerX = (x + element.width / 2) * zoom;
  const topY = y * zoom;
  const bottomY = (y + element.height) * zoom;
  const showAbove = !isShapeCropMode && !toolbarBelow && y >= 44;

  const elementProps = (element.props ?? {}) as Record<string, unknown>;

  const handleClipChange = (clip: ShapeClip, recordHistory?: boolean) => {
    dispatch(updateElement({
      id: element.id,
      changes: { props: { ...elementProps, ...shapeClipToProps(clip) } },
      recordHistory: !!recordHistory,
    }));
  };

  const stopBubble = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="pointer-events-auto absolute"
      style={{
        left: centerX,
        top: isShapeCropMode ? bottomY + 10 : showAbove ? topY - 6 : bottomY + 6,
        transform: isShapeCropMode || !showAbove ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
        zIndex: getToolbarZIndex(elements) + 1,
      }}
      onMouseDown={stopBubble}
      onClick={stopBubble}
    >
      {isShapeCropMode ? (
        <ShapeCropControls
          elementId={element.id}
          props={elementProps}
          onClipChange={handleClipChange}
        />
      ) : (
        <div className="flex items-center gap-0.5 rounded-full border border-gray-200 bg-white px-1.5 py-1 shadow-lg ring-1 ring-black/5">
          {supportsInteractionToggle && !locked && onInteractionModeChange && (
            <>
              <FloatingIconButton
                title="Move"
                active={interactionMode === 'move'}
                onClick={() => onInteractionModeChange('move')}
              >
                <Move className="h-4 w-4" />
              </FloatingIconButton>
              <FloatingIconButton
                title={isTable ? 'Edit cells' : 'Select text'}
                active={interactionMode === 'edit'}
                onClick={() => onInteractionModeChange('edit')}
              >
                <TextCursor className="h-4 w-4" />
              </FloatingIconButton>
            </>
          )}

          {!locked && <FloatingOpacityControl elementId={element.id} />}

          {isShape && !locked && (
            <FloatingIconButton
              title="Cut shape"
              onClick={() => dispatch(setShapeCropMode(element.id))}
            >
              <Crop className="h-4 w-4" />
            </FloatingIconButton>
          )}

          <FloatingIconButton
            title="Duplicate"
            onClick={() => dispatch(duplicateElement(element.id))}
          >
            <CopyPlus className="h-4 w-4" />
          </FloatingIconButton>

          <FloatingIconButton
            title={locked ? 'Unlock' : 'Lock'}
            active={locked}
            onClick={() => dispatch(toggleElementLock(element.id))}
          >
            {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
          </FloatingIconButton>

          <FloatingIconButton
            title="Delete"
            danger
            disabled={locked}
            onClick={() => dispatch(deleteElement(element.id))}
          >
            <Trash2 className="h-4 w-4" />
          </FloatingIconButton>
        </div>
      )}
    </div>
  );
}

function FloatingOpacityControl({ elementId }: { elementId: string }) {
  const dispatch = useAppDispatch();
  const { open, toggle, anchorRef, panelRef, position } = useToolbarPopover();
  const [liveOpacity, setLiveOpacity] = useState<number | null>(null);

  const element = useAppSelector((s) => {
    const page = s.builder.pages[s.builder.activePageIndex];
    return page.elements.find((el) => el.id === elementId);
  });

  if (!element) return null;

  const props = (element.props ?? {}) as Record<string, unknown>;
  const opacityPercent = liveOpacity ?? getOpacityPercent(element);

  const setOpacity = (value: number, recordHistory = false) => {
    const clamped = Math.min(MAX_OPACITY_PERCENT, Math.max(MIN_OPACITY_PERCENT, value));
    dispatch(updateElement({
      id: elementId,
      changes: { props: { ...props, opacity: clamped } },
      recordHistory,
    }));
  };

  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        <FloatingIconButton
          title="Opacity"
          active={open}
          onClick={toggle}
          onMouseDown={(e) => e.preventDefault()}
        >
          <TransparencyIcon />
        </FloatingIconButton>
      </span>
      <ToolbarPopoverPanel
        open={open}
        panelRef={panelRef}
        position={position}
        width={208}
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
      >
        <p className="mb-3 text-xs font-semibold text-gray-700">Opacity</p>
        <div className="flex items-center gap-3">
          <div className="relative flex flex-1 items-center">
            <div
              className="pointer-events-none absolute inset-x-0 h-1.5 rounded-full"
              style={{
                background: 'linear-gradient(to right, rgba(156,163,175,0.3), rgba(55,65,81,1))',
              }}
            />
            <input
              type="range"
              min={MIN_OPACITY_PERCENT}
              max={MAX_OPACITY_PERCENT}
              step={1}
              value={opacityPercent}
              onChange={(e) => {
                const v = Number(e.target.value);
                setLiveOpacity(v);
                setOpacity(v, false);
              }}
              onPointerUp={(e) => {
                const v = Number(e.currentTarget.value);
                setOpacity(v, true);
                setLiveOpacity(null);
              }}
              className="layer-opacity-slider relative z-10 h-6 w-full cursor-pointer appearance-none bg-transparent"
              aria-label="Opacity"
            />
          </div>
          <span className="w-10 text-right text-xs font-semibold tabular-nums text-gray-700">
            {opacityPercent}%
          </span>
        </div>
      </ToolbarPopoverPanel>
    </>
  );
}

function FloatingIconButton({
  children,
  title,
  onClick,
  onMouseDown,
  active,
  danger,
  disabled,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  onMouseDown?: (e: MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={onMouseDown}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'text-gray-600 hover:bg-red-50 hover:text-red-600'
          : active
            ? 'bg-primary/10 text-primary'
            : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

function TransparencyIcon() {
  const patternId = useId();
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <defs>
        <pattern id={patternId} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="2" height="2" fill="#9ca3af" />
          <rect x="2" y="2" width="2" height="2" fill="#9ca3af" />
          <rect x="2" width="2" height="2" fill="#e5e7eb" />
          <rect y="2" width="2" height="2" fill="#e5e7eb" />
        </pattern>
      </defs>
      <rect width="16" height="16" fill={`url(#${patternId})`} />
      <path d="M0 16 L16 0" stroke="#374151" strokeWidth="1.5" />
    </svg>
  );
}
