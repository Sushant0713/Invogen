import { useEffect, useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Minus,
  Plus,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  Paintbrush,
  Copy,
} from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { ComponentType } from '@invogen/shared';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import {
  setElementLayer,
  updateElement,
} from '@/store/slices/builderSlice';
import {
  getLayerIndex,
} from './element-layers';
import {
  copyTextStyle,
  pasteTextStyle,
  clearCopiedTextStyle,
  normalizeListStyle,
  LIST_STYLE_OPTIONS,
  getTextRuns,
  type ListStyleType,
} from './text-styles';
import { outlineEditorSetLevel, outlineEditorAddMainLine, subscribeOutlineEditor, getOutlineCurrentLevel, isOutlineEditorActive } from './outline-editor-api';
import { FontFamilyPicker } from './FontFamilyPicker';
import { useToolbarPopover, ToolbarPopoverPanel } from './ToolbarPopover';
import { isImageComponentType } from './image-components';
import { ImageToolbar } from './ImageToolbar';
import { isTextStylable } from './text-styles';
import {
  isTableElementType,
  productTablePropsToRecord,
  applyTableStylePatch,
  getTableFormatStylePreview,
  type TableTextAlign,
  type TableFormatScope,
} from './product-table';
import { normalizeTablePropsForType } from './table-props-normalize';
import { resolveSelectedElementLocation } from './builder-selection';
import {
  applyCaseCycleToActiveSelection,
  applyStylePatchToActiveSelection,
  beginBuilderTextFormatting,
  endBuilderTextFormatting,
  getActiveSelectionStylePreview,
  nextTextCaseMode,
  saveBuilderTextSelection,
  selectionHasActiveBuilderEditor,
  type TextStylePatch,
} from './rich-text-formatting';

const TOOLBAR_SLOT_CLASS =
  'w-full shrink-0 border-b border-gray-200 bg-[#ececf0] min-h-[52px]';

export function ElementToolbar() {
  const dispatch = useAppDispatch();
  const { pages, activePageIndex, selectedElementIds, selectedTableCell, selectedTableCells } = useAppSelector(
    (s) => s.builder
  );
  const [styleCopied, setStyleCopied] = useState(false);
  const [selectionTick, setSelectionTick] = useState(0);
  const page = pages[activePageIndex];
  const selectedLocation = resolveSelectedElementLocation(pages, selectedElementIds);
  const element = selectedLocation?.element;
  const elementPageIndex = selectedLocation?.pageIndex ?? activePageIndex;
  const elementPage = pages[elementPageIndex] ?? page;

  useEffect(() => {
    const onSelectionChange = () => setSelectionTick((n) => n + 1);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);
  void selectionTick;

  if (!element || selectedElementIds.length !== 1) {
    return <div className={TOOLBAR_SLOT_CLASS} aria-hidden />;
  }

  const props = (element.props ?? {}) as Record<string, unknown>;
  const layerIndex = getLayerIndex(elementPage.elements, element.id);
  const maxLayer = Math.max(0, elementPage.elements.length - 1);

  const updateProp = (key: string, value: unknown, recordHistory = true) => {
    dispatch(updateElement({
      id: element.id,
      changes: { props: { ...props, [key]: value } },
      recordHistory,
    }));
  };

  if (isImageComponentType(element.type)) {
    const updateProps = (patch: Record<string, unknown>, recordHistory = true) => {
      dispatch(updateElement({
        id: element.id,
        changes: { props: { ...props, ...patch } },
        recordHistory,
      }));
    };

    return (
      <ImageToolbar
        elementId={element.id}
        props={props}
        layerIndex={layerIndex}
        maxLayer={maxLayer}
        onUpdateProp={updateProp}
        onUpdateProps={updateProps}
        onForward={() => dispatch(setElementLayer({
          id: element.id,
          layer: Math.min(layerIndex + 1, maxLayer),
        }))}
        onBackward={() => dispatch(setElementLayer({
          id: element.id,
          layer: Math.max(layerIndex - 1, 0),
        }))}
      />
    );
  }

  if (isTableElementType(element.type)) {
    const activeCell =
      selectedTableCell?.elementId === element.id ? selectedTableCell : null;
    const tableCellsForTable = selectedTableCells.filter((c) => c.elementId === element.id);
    const table = normalizeTablePropsForType(element.type, props);
    const effectiveScope: TableFormatScope =
      tableCellsForTable.length > 0 ? 'cell' : 'all';

    const previewStyle = getTableFormatStylePreview(
      table,
      element.id,
      effectiveScope,
      activeCell,
      tableCellsForTable
    );

    const patchStyles = (
      patch: Parameters<typeof applyTableStylePatch>[5],
      recordHistory = true
    ) => {
      const next = applyTableStylePatch(
        table,
        element.id,
        effectiveScope,
        activeCell,
        tableCellsForTable,
        patch
      );
      dispatch(
        updateElement({
          id: element.id,
          changes: { props: productTablePropsToRecord(next) },
          recordHistory,
        })
      );
    };

    const fontSize = previewStyle.fontSize ?? 12;
    const fontWeight = previewStyle.fontWeight ?? (activeCell?.isHeader ? 600 : 400);
    const isBold = fontWeight >= 600;
    const isItalic = !!previewStyle.italic;
    const isUnderline = !!previewStyle.underline;
    const textAlign = previewStyle.textAlign ?? 'left';
    const fontFamily = previewStyle.fontFamily ?? 'Inter';

    return (
      <div className={TOOLBAR_SLOT_CLASS}>
        <div className="builder-context-toolbar-scroll flex min-h-[52px] items-center overflow-x-auto py-2.5 px-2">
          <div
            data-builder-toolbar
            className="pointer-events-auto mx-auto flex w-max max-w-full items-center gap-0.5 rounded-full border border-gray-200/80 bg-white px-2 py-1 shadow-md"
            onMouseDown={stopToolbarPointer}
            onClick={stopBubble}
          >
            <FontFamilyPicker
              value={fontFamily}
              onChange={(family) => patchStyles({ fontFamily: family })}
            />
            <FontSizeStepper
              value={fontSize}
              onChange={(size) => patchStyles({ fontSize: size }, false)}
              onCommit={(size) => patchStyles({ fontSize: size }, true)}
            />
            <ColorPicker
              value={previewStyle.color ?? '#374151'}
              onChange={(color) => patchStyles({ color })}
            />
            <div className="mx-0.5 h-6 w-px bg-gray-200" />
            <ToolbarIconButton
              title="Bold"
              active={isBold}
              onClick={() => patchStyles({ fontWeight: isBold ? 400 : 700 })}
            >
              <Bold className="h-4 w-4" />
            </ToolbarIconButton>
            <ToolbarIconButton
              title="Italic"
              active={isItalic}
              onClick={() => patchStyles({ italic: !isItalic })}
            >
              <Italic className="h-4 w-4" />
            </ToolbarIconButton>
            <ToolbarIconButton
              title="Underline"
              active={isUnderline}
              onClick={() => patchStyles({ underline: !isUnderline })}
            >
              <Underline className="h-4 w-4" />
            </ToolbarIconButton>
            <div className="mx-0.5 h-6 w-px bg-gray-200" />
            {(
              [
                ['left', AlignLeft],
                ['center', AlignCenter],
                ['right', AlignRight],
                ['justify', AlignJustify],
              ] as const
            ).map(([align, Icon]) => (
              <ToolbarIconButton
                key={align}
                title={`Align ${align}`}
                active={textAlign === align}
                onClick={() => patchStyles({ textAlign: align as TableTextAlign })}
              >
                <Icon className="h-4 w-4" />
              </ToolbarIconButton>
            ))}
            <div className="mx-0.5 h-6 w-px bg-gray-200" />
            <PositionMenu
              layerIndex={layerIndex}
              maxLayer={maxLayer}
              onForward={() => dispatch(setElementLayer({
                id: element.id,
                layer: Math.min(layerIndex + 1, maxLayer),
              }))}
              onBackward={() => dispatch(setElementLayer({
                id: element.id,
                layer: Math.max(layerIndex - 1, 0),
              }))}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!isTextStylable(element.type)) {
    return <div className={TOOLBAR_SLOT_CLASS} aria-hidden />;
  }

  const updateProps = (patch: Record<string, unknown>, recordHistory = true) => {
    dispatch(updateElement({
      id: element.id,
      changes: { props: { ...props, ...patch } },
      recordHistory,
    }));
  };

  const bumpLayer = (delta: number) => {
    dispatch(setElementLayer({
      id: element.id,
      layer: Math.max(0, Math.min(layerIndex + delta, maxLayer)),
    }));
  };

  const fontSize = (props.fontSize as number) || (element.type === ComponentType.HEADING ? 24 : 14);
  const fontWeight = (props.fontWeight as number) || 400;
  const selectionStyle = selectionHasActiveBuilderEditor()
    ? getActiveSelectionStylePreview()
    : null;
  const isBold = ((selectionStyle?.fontWeight ?? fontWeight) >= 600);
  const isItalic = selectionStyle ? !!selectionStyle.italic : !!props.italic;
  const isUnderline = selectionStyle ? !!selectionStyle.underline : !!props.underline;
  const isStrikethrough = selectionStyle
    ? !!selectionStyle.strikethrough
    : !!props.strikethrough;
  const textAlign = (props.textAlign as string) || 'left';
  const letterSpacing = (props.letterSpacing as number) || 0;
  const fontFamily =
    (selectionStyle?.fontFamily as string | undefined)
    || (props.fontFamily as string)
    || 'Inter';
  const activeColor =
    (selectionStyle?.color as string | undefined)
    || (props.color as string)
    || '#000000';
  const activeFontSize =
    (typeof selectionStyle?.fontSize === 'number' ? selectionStyle.fontSize : fontSize);
  const listStyle = normalizeListStyle(props.listStyle);

  const applyTextFormat = (patch: TextStylePatch, wholeElement: Record<string, unknown>) => {
    saveBuilderTextSelection();
    if (applyStylePatchToActiveSelection(patch)) {
      endBuilderTextFormatting();
      return;
    }
    // Whole-box styles must also update rich-text runs — run styles override the parent.
    const runs = getTextRuns(props);
    if (runs?.length) {
      updateProps(
        {
          ...wholeElement,
          textRuns: runs.map((run) => ({ ...run, ...patch })),
        },
        true
      );
      endBuilderTextFormatting();
      return;
    }
    updateProps(wholeElement, true);
    endBuilderTextFormatting();
  };

  const cycleCase = () => {
    saveBuilderTextSelection();
    if (applyCaseCycleToActiveSelection()) {
      endBuilderTextFormatting();
      return;
    }
    const next = nextTextCaseMode(props.textTransform as string | undefined);
    updateProp('textTransform', next);
    endBuilderTextFormatting();
  };

  const handleCopyStyle = () => {
    if (styleCopied) {
      const pasted = pasteTextStyle();
      if (pasted) updateProps(pasted);
      clearCopiedTextStyle();
      setStyleCopied(false);
    } else {
      copyTextStyle(props);
      setStyleCopied(true);
    }
  };

  return (
    <div className={TOOLBAR_SLOT_CLASS}>
      <div className="builder-context-toolbar-scroll flex min-h-[52px] items-center overflow-x-auto py-2.5 px-2">
        <div
          data-builder-toolbar
          className="pointer-events-auto mx-auto flex w-max max-w-full items-center gap-0.5 rounded-full border border-gray-200/80 bg-white px-2 py-1 shadow-md"
          onMouseDown={stopToolbarPointer}
          onClick={stopBubble}
        >
        <FontFamilyPicker
          value={fontFamily}
          onChange={(family) =>
            applyTextFormat({ fontFamily: family }, { fontFamily: family })
          }
        />

        <FontSizeStepper
          value={activeFontSize}
          onChange={(size) =>
            applyTextFormat({ fontSize: size }, { fontSize: size })
          }
          onCommit={(size) =>
            applyTextFormat({ fontSize: size }, { fontSize: size })
          }
        />

        <ColorPicker
          value={activeColor}
          onChange={(color) => applyTextFormat({ color }, { color })}
        />

        <div className="mx-0.5 h-6 w-px bg-gray-200" />

        <ToolbarIconButton
          title="Bold (select text first, or apply to whole box)"
          active={isBold}
          onClick={() =>
            applyTextFormat(
              { fontWeight: isBold ? 400 : 700 },
              { fontWeight: isBold ? 400 : 700 }
            )
          }
        >
          <Bold className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          title="Italic"
          active={isItalic}
          onClick={() =>
            applyTextFormat({ italic: !isItalic }, { italic: !isItalic })
          }
        >
          <Italic className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          title="Underline"
          active={isUnderline}
          onClick={() =>
            applyTextFormat(
              { underline: !isUnderline },
              { underline: !isUnderline }
            )
          }
        >
          <Underline className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          title="Strikethrough"
          active={isStrikethrough}
          onClick={() =>
            applyTextFormat(
              { strikethrough: !isStrikethrough },
              { strikethrough: !isStrikethrough }
            )
          }
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton title="Change case" onClick={cycleCase}>
          <span className="text-xs font-semibold">aA</span>
        </ToolbarIconButton>

        <div className="mx-0.5 h-6 w-px bg-gray-200" />

        <AlignmentMenu
          value={textAlign}
          onChange={(align) => updateProp('textAlign', align)}
        />

        <ListStyleMenu
          value={listStyle}
          onChange={(style) => updateProp('listStyle', style)}
        />

        {listStyle === 'outline' && <OutlineLevelPicker />}

        <SpacingPopover
          value={letterSpacing}
          onChange={(v) => updateProp('letterSpacing', v, false)}
          onCommit={(v) => updateProp('letterSpacing', v, true)}
        />

        <EffectsMenu
          hasShadow={!!props.textShadow}
          onToggleShadow={() => updateProp(
            'textShadow',
            props.textShadow ? '' : '1px 2px 4px rgba(0,0,0,0.25)',
            true
          )}
        />

        <AnimateMenu />

        <PositionMenu
          layerIndex={layerIndex}
          maxLayer={maxLayer}
          onForward={() => bumpLayer(1)}
          onBackward={() => bumpLayer(-1)}
        />

        <div className="mx-0.5 h-6 w-px bg-gray-200" />

        <ToolbarIconButton
          title={styleCopied ? 'Apply copied style' : 'Copy style'}
          active={styleCopied}
          onClick={handleCopyStyle}
        >
          <Paintbrush className="h-4 w-4" />
        </ToolbarIconButton>
        </div>
      </div>
    </div>
  );
}

function stopToolbarPointer(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  // Keep the contenteditable selection alive while clicking toolbar controls.
  saveBuilderTextSelection();
}

function stopBubble(event: MouseEvent) {
  event.stopPropagation();
}

function FontSizeStepper({
  value,
  onChange,
  onCommit,
}: {
  value: number;
  onChange: (size: number) => void;
  onCommit: (size: number) => void;
}) {
  const clamp = (n: number) => Math.min(120, Math.max(8, n));

  return (
    <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50">
      <ToolbarIconButton
        title="Decrease font size"
        compact
        onClick={() => {
          const next = clamp(value - 1);
          onCommit(next);
        }}
      >
        <Minus className="h-3.5 w-3.5" />
      </ToolbarIconButton>
      <span className="w-9 text-center text-xs font-semibold tabular-nums text-gray-800">
        {value}
      </span>
      <ToolbarIconButton
        title="Increase font size"
        compact
        onClick={() => {
          const next = clamp(value + 1);
          onCommit(next);
        }}
      >
        <Plus className="h-3.5 w-3.5" />
      </ToolbarIconButton>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <label
      title="Text color"
      className="relative inline-flex h-8 w-8 shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg text-gray-700 transition-colors hover:bg-gray-100"
      onMouseDown={() => {
        beginBuilderTextFormatting();
        saveBuilderTextSelection();
      }}
    >
      <span className="text-sm font-bold leading-none" style={{ color: value }}>A</span>
      <span
        className="mt-0.5 h-0.5 w-4 rounded-full"
        style={{
          background: 'linear-gradient(to right, #ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7)',
        }}
      />
      <input
        type="color"
        value={value}
        // The native color popup steals the editor's text selection — snapshot it first.
        onMouseDown={() => {
          beginBuilderTextFormatting();
          saveBuilderTextSelection();
        }}
        onChange={(e) => {
          onChange(e.target.value);
          endBuilderTextFormatting();
        }}
        onBlur={() => endBuilderTextFormatting()}
        // Native color inputs have a large UA min-size; clip + zero min so they
        // cannot steal clicks from the Bold button beside this control.
        className="absolute inset-0 h-full w-full min-h-0 min-w-0 cursor-pointer opacity-0"
        aria-label="Text color"
      />
    </label>
  );
}

function AlignmentMenu({
  value,
  onChange,
  includeJustify = false,
}: {
  value: string;
  onChange: (align: string) => void;
  includeJustify?: boolean;
}) {
  const { open, toggle, close, anchorRef, panelRef, position } = useToolbarPopover();
  const Icon =
    value === 'justify'
      ? AlignJustify
      : value === 'center'
        ? AlignCenter
        : value === 'right'
          ? AlignRight
          : AlignLeft;

  const options = (
    includeJustify
      ? [
          ['left', AlignLeft],
          ['center', AlignCenter],
          ['right', AlignRight],
          ['justify', AlignJustify],
        ]
      : [
          ['left', AlignLeft],
          ['center', AlignCenter],
          ['right', AlignRight],
        ]
  ) as const;

  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        <ToolbarIconButton title="Alignment" active={open} onClick={toggle}>
          <Icon className="h-4 w-4" />
        </ToolbarIconButton>
      </span>
      <ToolbarPopoverPanel
        open={open}
        panelRef={panelRef}
        position={position}
        className="flex gap-0.5 rounded-xl border border-gray-200 bg-white p-1 shadow-xl"
      >
        {options.map(([align, AlignIcon]) => (
          <button
            key={align}
            type="button"
            title={align}
            onClick={() => { onChange(align); close(); }}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              value === align ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <AlignIcon className="h-4 w-4" />
          </button>
        ))}
      </ToolbarPopoverPanel>
    </>
  );
}

const OUTLINE_LEVELS = [
  { level: 0, label: 'Main', title: 'Main section — auto-numbers 1, 2, 3…' },
  { level: 1, label: '1.1', title: 'Sub-point' },
  { level: 2, label: '1.1.1', title: 'Sub-sub-point' },
  { level: 3, label: '1.1.1.1', title: 'Detail level' },
] as const;

function OutlineLevelPicker() {
  const [activeLevel, setActiveLevel] = useState(0);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const sync = () => {
      setActiveLevel(getOutlineCurrentLevel());
      setEditing(isOutlineEditorActive());
    };
    sync();
    return subscribeOutlineEditor(sync);
  }, []);

  return (
    <div
      className={`flex items-center gap-0.5 rounded-full border border-gray-200 bg-gray-50 px-1 py-0.5 transition-opacity ${
        editing ? '' : 'pointer-events-none opacity-40'
      }`}
      title="Line level: Main = 1,2,3… | 1.1 = sub-point | Tab / Shift+Tab while typing"
    >
      {OUTLINE_LEVELS.map(({ level, label, title }) => (
        <button
          key={level}
          type="button"
          title={title}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => outlineEditorSetLevel(level)}
          className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums transition-colors ${
            activeLevel === level
              ? 'bg-primary text-white shadow-sm'
              : 'text-gray-600 hover:bg-white hover:text-gray-900'
          }`}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        title="Add new main section (2, 3, 4…) below current line"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => outlineEditorAddMainLine()}
        className="rounded-full px-2 py-0.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-white hover:text-gray-900"
      >
        + Main
      </button>
    </div>
  );
}

function ListStyleMenu({
  value,
  onChange,
}: {
  value: ListStyleType;
  onChange: (style: ListStyleType) => void;
}) {
  const { open, toggle, close, anchorRef, panelRef, position } = useToolbarPopover();
  const isActive = value !== 'none';

  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        <ToolbarIconButton title="List style" active={open || isActive} onClick={toggle}>
          <List className="h-4 w-4" />
        </ToolbarIconButton>
      </span>
      <ToolbarPopoverPanel
        open={open}
        panelRef={panelRef}
        position={position}
        width={240}
        className="rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
      >
        {LIST_STYLE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              onChange(option.value);
              close();
            }}
            className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
              value === option.value ? 'bg-primary/5 text-primary font-medium' : 'text-gray-700'
            }`}
          >
            <span className="flex w-full items-center gap-3">
              <span className="w-8 text-center font-semibold tabular-nums">{option.preview}</span>
              <span>{option.label}</span>
            </span>
            {option.hint ? (
              <span className="pl-11 text-xs text-gray-400">{option.hint}</span>
            ) : null}
          </button>
        ))}
      </ToolbarPopoverPanel>
    </>
  );
}

function SpacingPopover({
  value,
  onChange,
  onCommit,
}: {
  value: number;
  onChange: (spacing: number) => void;
  onCommit: (spacing: number) => void;
}) {
  const { open, toggle, anchorRef, panelRef, position } = useToolbarPopover();

  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        <ToolbarIconButton title="Letter spacing" active={open} onClick={toggle}>
          <span className="flex flex-col items-center leading-none">
            <span className="text-xs font-bold">T</span>
            <span className="text-[8px] tracking-widest">↔</span>
          </span>
        </ToolbarIconButton>
      </span>
      <ToolbarPopoverPanel
        open={open}
        panelRef={panelRef}
        position={position}
        width={192}
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
      >
        <p className="mb-2 text-xs font-semibold text-gray-700">Letter spacing</p>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={-2}
            max={20}
            step={0.5}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            onPointerUp={(e) => onCommit(Number(e.currentTarget.value))}
            className="layer-opacity-slider h-6 flex-1 cursor-pointer appearance-none bg-transparent"
          />
          <span className="w-10 text-right text-xs tabular-nums text-gray-600">{value}px</span>
        </div>
      </ToolbarPopoverPanel>
    </>
  );
}

function EffectsMenu({
  hasShadow,
  onToggleShadow,
}: {
  hasShadow: boolean;
  onToggleShadow: () => void;
}) {
  const { open, toggle, close, anchorRef, panelRef, position } = useToolbarPopover();

  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        <button
          type="button"
          onClick={toggle}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            open ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Effects
        </button>
      </span>
      <ToolbarPopoverPanel
        open={open}
        panelRef={panelRef}
        position={position}
        width={176}
        className="rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
      >
        <MenuRow
          label={hasShadow ? 'Remove shadow' : 'Drop shadow'}
          onClick={() => { onToggleShadow(); close(); }}
        />
      </ToolbarPopoverPanel>
    </>
  );
}

function AnimateMenu() {
  const { open, toggle, anchorRef, panelRef, position } = useToolbarPopover();

  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        <button
          type="button"
          onClick={toggle}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            open ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Animate
        </button>
      </span>
      <ToolbarPopoverPanel
        open={open}
        panelRef={panelRef}
        position={position}
        width={192}
        className="rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
      >
        <p className="text-xs text-gray-500">Animation presets coming soon for invoice export.</p>
      </ToolbarPopoverPanel>
    </>
  );
}

function PositionMenu({
  layerIndex,
  maxLayer,
  onForward,
  onBackward,
}: {
  layerIndex: number;
  maxLayer: number;
  onForward: () => void;
  onBackward: () => void;
}) {
  const { open, toggle, close, anchorRef, panelRef, position } = useToolbarPopover();

  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        <button
          type="button"
          title="Layer order"
          onClick={toggle}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            open ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Position
        </button>
      </span>
      <ToolbarPopoverPanel
        open={open}
        panelRef={panelRef}
        position={position}
        width={192}
        className="rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
      >
        <MenuRow label="Forward" icon={<ChevronUp className="h-4 w-4" />} disabled={layerIndex >= maxLayer} onClick={() => { onForward(); close(); }} />
        <MenuRow label="Backward" icon={<ChevronDown className="h-4 w-4" />} disabled={layerIndex <= 0} onClick={() => { onBackward(); close(); }} />
        <div className="mx-3 my-1 border-t border-gray-100" />
        <p className="px-3 py-1.5 text-[10px] text-gray-400">
          Layer {layerIndex + 1} of {maxLayer + 1}
        </p>
      </ToolbarPopoverPanel>
    </>
  );
}

function MenuRow({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
  );
}

function ToolbarIconButton({
  children,
  title,
  onClick,
  onMouseDown,
  active,
  danger,
  compact,
  disabled,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  onMouseDown?: (e: MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  danger?: boolean;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={onMouseDown}
      className={`inline-flex items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        compact ? 'h-7 w-7' : 'h-8 w-8'
      } ${
        danger
          ? 'text-gray-600 hover:bg-red-50 hover:text-red-600'
          : active
            ? 'bg-violet-100 text-violet-700'
            : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}
