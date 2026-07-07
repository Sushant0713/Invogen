import { useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import type { CanvasElement } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { ProductTableView } from './ProductTableView';
import { OutlineListEditor } from './OutlineListEditor';
import { TermsDisplay } from './TermsDisplay';
import { AddressDisplay } from './AddressDisplay';
import { termsItemsToContent, termsPropsFromOutlineContent, parseTermsFromProps } from './terms-content';
import { formatAddressValue, parseAddressFromProps, buildAddressProps } from './address-content';
import { CardView } from './CardView';
import { ImageView } from './ImageView';
import { isCardComponentType } from './card-components';
import { isImageComponentType } from './image-components';
import { isTableElementType } from './product-table';
import type { CanvasInteractionMode } from './builder-interaction';
import { ShapeElementView } from './ShapeElementView';
import { isShapeType } from '@/features/document-editor/object-renderer/ShapeView';
import { getElementPointerEvents } from './element-layers';
import { useAppSelector } from '@/hooks/useAppDispatch';
import { RichTextRunsEditor } from '@/features/builder/RichTextRunsEditor';
import {
  getTextElementStyle,
  getTextDisplayStyle,
  getEditableTextKey,
  getEditableTextValue,
  getDisplayText,
  getDataFieldValue,
  isDataFieldType,
  isInlineCanvasEditable,
  isTextStylable,
  normalizeListStyle,
  getListRenderConfig,
  getTextRuns,
  getRunStyle,
  splitListLines,
  parseOutlineLines,
  OUTLINE_NUMBER_COLUMN,
  getOutlineTextIndent,
} from './text-styles';
import { StructuredContentSizer } from './StructuredContentSizer';
import {
  structuredMeasureKey,
  isStructuredContentType,
} from './structured-content-layout';
import { getElementRotation, supportsElementRotation } from './element-rotation';

interface Props {
  element: CanvasElement;
  isSelected: boolean;
  isEditing?: boolean;
  interactionMode?: CanvasInteractionMode;
  isCanvasDragging?: boolean;
  layerOpacity?: number;
  /** Read-only scaled preview (gallery thumbnails). */
  previewMode?: boolean;
  /** Tables already recalculated (invoice composer live preview). */
  trustTableProps?: boolean;
  /** Composer live preview: allow picking products in table cells. */
  onTableCellChange?: (rowId: string, columnId: string, value: string) => void;
  isShapeCropMode?: boolean;
  onSelect: (additive?: boolean) => void;
  onStartEdit?: () => void;
  onInteractionModeChange?: (mode: CanvasInteractionMode) => void;
  onUpdateContent?: (value: string) => void;
  onCommitContent?: (value: string) => void;
  onCommitRichContent?: (payload: {
    content: string;
    text: string;
    textRuns: import('./text-styles').TextRunProps[];
  }) => void;
  pendingEditChar?: string | null;
  onPendingEditCharConsumed?: () => void;
  onUpdateProps?: (patch: Record<string, unknown>, recordHistory?: boolean) => void;
  onStructuredContentHeight?: (height: number) => void;
}

function EditableText({
  element,
  props,
  isSelected,
  isEditing,
  onSelect,
  onStartEdit,
  onUpdateContent,
  onCommitContent,
  onCommitRichContent,
  onUpdateProps,
  pendingEditChar,
  onPendingEditCharConsumed,
  onStructuredContentHeight,
  previewMode,
}: {
  element: CanvasElement;
  props: Record<string, unknown>;
  isSelected?: boolean;
  isEditing?: boolean;
  onSelect?: () => void;
  onStartEdit?: () => void;
  onUpdateContent?: (value: string) => void;
  onCommitContent?: (value: string) => void;
  onCommitRichContent?: (payload: {
    content: string;
    text: string;
    textRuns: import('./text-styles').TextRunProps[];
  }) => void;
  onUpdateProps?: (patch: Record<string, unknown>, recordHistory?: boolean) => void;
  pendingEditChar?: string | null;
  onPendingEditCharConsumed?: () => void;
  onStructuredContentHeight?: (height: number) => void;
  previewMode?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);
  const textStyle = getTextElementStyle(props, element.type);
  const displayStyle = getTextDisplayStyle(props, element.type);
  const editValue = getEditableTextValue(props, element.type);
  const displayValue = getDisplayText(props, element.type, element.type);
  const listStyle = normalizeListStyle(props.listStyle);
  const isOutlineList = listStyle === 'outline';
  const textRuns = getTextRuns(props);
  const hasRichRuns = textRuns && textRuns.length > 0 && listStyle === 'none';

  // Only seed editor once when entering edit mode — never reset while typing.
  useEffect(() => {
    if (!isEditing) {
      initRef.current = false;
      return;
    }
    if (initRef.current || !editorRef.current) return;
    initRef.current = true;
    const initial = pendingEditChar ? `${editValue}${pendingEditChar}` : editValue;
    editorRef.current.textContent = initial;
    if (pendingEditChar) {
      onUpdateContent?.(initial);
      onPendingEditCharConsumed?.();
    }
    editorRef.current.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [isEditing, editValue, pendingEditChar, onPendingEditCharConsumed, onUpdateContent]);

  const stopTextEdit = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  /** Let Rnd receive pointer events when selected so the element can move. */
  const handleSurfacePointerDown = (e: React.PointerEvent) => {
    if (isEditing) {
      e.stopPropagation();
      return;
    }
    // Second click of a double-click must not start a drag — wait for onDoubleClick.
    if (e.detail >= 2) {
      e.stopPropagation();
      return;
    }
    if (!isSelected) {
      e.stopPropagation();
    }
  };

  const enterEdit = () => {
    if (!onStartEdit) return;
    onSelect?.();
    onStartEdit();
  };

  if (isEditing) {
    if (element.type === ComponentType.TERMS) {
      const { items } = parseTermsFromProps(props);
      return (
        <StructuredContentSizer
          elementHeight={element.height}
          measureKey={`${structuredMeasureKey(element.type, props)}:${element.width}`}
          onHeightChange={onStructuredContentHeight}
          disabled={previewMode}
        >
          <OutlineListEditor
            value={termsItemsToContent(items)}
            textStyle={displayStyle}
            onChange={(v) => onUpdateProps?.(termsPropsFromOutlineContent(v, props), false)}
            onCommit={(v) => {
              onUpdateProps?.(termsPropsFromOutlineContent(v, props), true);
              onCommitContent?.(v);
            }}
          />
        </StructuredContentSizer>
      );
    }

    if (isOutlineList && getEditableTextKey(element.type) === 'content') {
      return (
        <OutlineListEditor
          value={editValue}
          textStyle={textStyle}
          onChange={(v) => onUpdateContent?.(v)}
          onCommit={(v) => onCommitContent?.(v)}
        />
      );
    }

    if (hasRichRuns && textRuns && onCommitRichContent) {
      return (
        <RichTextRunsEditor
          runs={textRuns}
          baseStyle={textStyle}
          pendingEditChar={pendingEditChar}
          onChange={(plain) => onUpdateContent?.(plain)}
          onCommit={onCommitRichContent}
          onPendingEditCharConsumed={onPendingEditCharConsumed}
        />
      );
    }

    return (
      <div
        ref={editorRef}
        className="builder-text-editor h-full w-full"
        contentEditable
        suppressContentEditableWarning
        style={{
          ...textStyle,
          outline: 'none',
          cursor: 'text',
          userSelect: 'text',
          minHeight: '1em',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
        onMouseDown={stopTextEdit}
        onPointerDown={stopTextEdit}
        onClick={stopTextEdit}
        onInput={(e) => onUpdateContent?.(e.currentTarget.textContent ?? '')}
        onBlur={(e) => onCommitContent?.(e.currentTarget.textContent ?? '')}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
    );
  }

  const surfaceProps = {
    className: 'builder-text-surface h-full w-full',
    style: textStyle,
    onPointerDown: handleSurfacePointerDown,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isSelected) onSelect?.();
    },
    onDoubleClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      enterEdit();
    },
  };

  if (element.type === ComponentType.TERMS) {
    return (
      <StructuredContentSizer
        elementHeight={element.height}
        measureKey={`${structuredMeasureKey(element.type, props)}:${element.width}`}
        onHeightChange={onStructuredContentHeight}
        disabled={previewMode}
      >
        <TermsDisplay
          className="builder-text-surface w-full"
          props={props}
          textStyle={displayStyle}
          onPointerDown={handleSurfacePointerDown}
          onClick={(e) => {
            e.stopPropagation();
            if (!isSelected) onSelect?.();
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            enterEdit();
          }}
        />
      </StructuredContentSizer>
    );
  }

  if (getEditableTextKey(element.type) === 'content') {
    const { tag, listStyleType } = getListRenderConfig(listStyle);
    if (tag === 'outline') {
      const items = parseOutlineLines(displayValue).filter((item) => item.text);
      return (
        <ul
          {...surfaceProps}
          style={{ ...textStyle, margin: 0, padding: 0, listStyle: 'none' }}
        >
          {items.map((item, index) => (
            <li
              key={`${item.number}-${index}`}
              className="grid items-start"
              style={{
                gridTemplateColumns: `${OUTLINE_NUMBER_COLUMN} 1fr`,
                marginBottom: '0.15em',
                minHeight: '1.45em',
              }}
            >
              <span className="pr-1 text-right tabular-nums">{item.number}.</span>
              <span style={{ paddingLeft: getOutlineTextIndent(item.level) }}>
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      );
    }
    if (tag) {
      const ListTag = tag;
      const lines = splitListLines(displayValue);
      return (
        <ListTag
          {...surfaceProps}
          style={{ ...textStyle, margin: 0, paddingLeft: '1.25em', listStyleType }}
        >
          {lines.map((line, index) => (
            <li key={`${line}-${index}`}>{line}</li>
          ))}
        </ListTag>
      );
    }
  }

  if (textRuns && textRuns.length > 0) {
    return (
      <div {...surfaceProps} style={{ ...textStyle, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {textRuns.map((run, index) => {
          const runStyle = getRunStyle(run, textStyle);
          if (run.href) {
            return (
              <a
                key={index}
                href={run.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...runStyle, pointerEvents: 'auto' }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {run.text}
              </a>
            );
          }
          return (
            <span key={index} style={runStyle}>
              {run.text}
            </span>
          );
        })}
      </div>
    );
  }

  return <div {...surfaceProps}>{displayValue}</div>;
}

/** Invoice data fields (GST, date, etc.) — label in properties; value editable on canvas or in panel. */
function DataFieldSurface({
  element,
  props,
  isSelected,
  isEditing,
  onSelect,
  onStartEdit,
  onUpdateContent,
  onCommitContent,
  onUpdateProps,
  pendingEditChar,
  onPendingEditCharConsumed,
  onStructuredContentHeight,
  previewMode,
}: {
  element: CanvasElement;
  props: Record<string, unknown>;
  isSelected?: boolean;
  isEditing?: boolean;
  onSelect?: () => void;
  onStartEdit?: () => void;
  onUpdateContent?: (value: string) => void;
  onCommitContent?: (value: string) => void;
  pendingEditChar?: string | null;
  onPendingEditCharConsumed?: () => void;
  onUpdateProps?: (patch: Record<string, unknown>, recordHistory?: boolean) => void;
  onStructuredContentHeight?: (height: number) => void;
  previewMode?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);
  const textStyle = getTextElementStyle(props, element.type);
  const displayStyle = getTextDisplayStyle(props, element.type);
  const isAddress = element.type === ComponentType.ADDRESS;
  const label = (props.label as string) || 'Label';
  const editValue = isAddress
    ? formatAddressValue(parseAddressFromProps(props))
    : getDataFieldValue(props, element.type);
  const displayValue = getDisplayText(props, element.type, element.type);
  const isMultiline = isAddress;

  useEffect(() => {
    if (!isEditing) {
      initRef.current = false;
      return;
    }
    if (initRef.current || !editorRef.current) return;
    initRef.current = true;
    const initial = pendingEditChar ? `${editValue}${pendingEditChar}` : editValue;
    editorRef.current.textContent = initial;
    if (pendingEditChar) {
      onUpdateContent?.(initial);
      onPendingEditCharConsumed?.();
    }
    editorRef.current.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [isEditing, editValue, pendingEditChar, onPendingEditCharConsumed, onUpdateContent]);

  useEffect(() => {
    if (!isEditing || !isAddress || !editorRef.current) return;
    if (document.activeElement === editorRef.current) return;
    const next = formatAddressValue(parseAddressFromProps(props));
    if (editorRef.current.textContent !== next) {
      editorRef.current.textContent = next;
    }
  }, [isEditing, isAddress, props]);

  const stopEditEvent = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isEditing) {
      e.stopPropagation();
      return;
    }
    if (e.detail >= 2) {
      e.stopPropagation();
      return;
    }
    if (!isSelected) {
      e.stopPropagation();
    }
  };

  const enterEdit = () => {
    if (!onStartEdit) return;
    onSelect?.();
    onStartEdit();
  };

  if (isEditing) {
    const editor = (
      <div
        className="builder-field-surface w-full"
        style={{ ...displayStyle, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        onMouseDown={stopEditEvent}
        onPointerDown={stopEditEvent}
      >
        {!isAddress && <span className="pointer-events-none select-none">{label}:</span>}
        {isMultiline ? (
          <div
            ref={editorRef}
            className={`builder-text-editor min-h-[1em] w-full ${isAddress ? '' : 'mt-0.5'}`}
            contentEditable
            suppressContentEditableWarning
            style={{ outline: 'none', cursor: 'text', userSelect: 'text' }}
            onInput={(e) => {
              const text = e.currentTarget.textContent ?? '';
              if (isAddress && onUpdateProps) {
                const current = parseAddressFromProps(props);
                const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
                onUpdateProps(
                  buildAddressProps(
                    { ...current, lines: lines.length ? lines : [''] },
                    props
                  ),
                  false
                );
                return;
              }
              onUpdateContent?.(text);
            }}
            onBlur={(e) => {
              const text = e.currentTarget.textContent ?? '';
              if (isAddress && onUpdateProps) {
                const current = parseAddressFromProps(props);
                const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
                onUpdateProps(
                  buildAddressProps({ ...current, lines: lines.length ? lines : [''] }, props),
                  true
                );
              }
              onCommitContent?.(text);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
        ) : (
          <>
            {' '}
            <div
              ref={editorRef}
              className="builder-text-editor inline min-w-[1ch]"
              contentEditable
              suppressContentEditableWarning
              style={{ outline: 'none', cursor: 'text', userSelect: 'text', display: 'inline' }}
              onInput={(e) => onUpdateContent?.(e.currentTarget.textContent ?? '')}
              onBlur={(e) => onCommitContent?.(e.currentTarget.textContent ?? '')}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            />
          </>
        )}
      </div>
    );

    if (isAddress) {
      return (
        <StructuredContentSizer
          elementHeight={element.height}
          measureKey={`${structuredMeasureKey(element.type, props)}:${element.width}`}
          onHeightChange={onStructuredContentHeight}
          disabled={previewMode}
        >
          {editor}
        </StructuredContentSizer>
      );
    }

    return editor;
  }

  if (isAddress) {
    return (
      <StructuredContentSizer
        elementHeight={element.height}
        measureKey={`${structuredMeasureKey(element.type, props)}:${element.width}`}
        onHeightChange={onStructuredContentHeight}
        disabled={previewMode}
      >
        <AddressDisplay
          className="builder-field-surface w-full"
          props={props}
          textStyle={displayStyle}
          onPointerDown={handlePointerDown}
          onClick={(e) => {
            e.stopPropagation();
            if (!isSelected) onSelect?.();
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            enterEdit();
          }}
        />
      </StructuredContentSizer>
    );
  }

  return (
    <div
      className="builder-field-surface h-full w-full"
      style={{
        ...textStyle,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
      onPointerDown={handlePointerDown}
      onClick={(e) => {
        e.stopPropagation();
        if (!isSelected) onSelect?.();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        enterEdit();
      }}
    >
      {displayValue}
    </div>
  );
}

export function ElementRenderer({
  element,
  isSelected,
  isEditing,
  interactionMode = 'move',
  isCanvasDragging,
  layerOpacity = 1,
  previewMode = false,
  trustTableProps = false,
  onTableCellChange,
  isShapeCropMode = false,
  onSelect,
  onStartEdit,
  onInteractionModeChange,
  onUpdateContent,
  onCommitContent,
  onCommitRichContent,
  pendingEditChar,
  onPendingEditCharConsumed,
  onUpdateProps,
  onStructuredContentHeight,
}: Props) {
  const isDataField = isDataFieldType(element.type);
  const isStructured = isStructuredContentType(element.type);
  const isCard = isCardComponentType(element.type);
  const isImage = isImageComponentType(element.type);
  const isTableCellEditing = useAppSelector(
    (s) =>
      s.builder.selectedTableCell?.elementId === element.id
      && s.builder.selectedTableCells.length === 1
  );
  const inlineTextEditable = !previewMode && !isDataField && isInlineCanvasEditable(element.type) && !element.locked;
  const inlineFieldEditable = !previewMode && isDataField && !element.locked;
  const usesCanvasEdit = inlineTextEditable || inlineFieldEditable;
  const props = (element.props ?? {}) as Record<string, unknown>;
  const elementRotation = getElementRotation(props);
  const isRotatable = supportsElementRotation(element.type);
  const showCanvasSelectionInset =
    isSelected
    && !isCanvasDragging
    && !isEditing
    && !previewMode
    && !isRotatable
    && !isTableElementType(element.type);

  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    background: 'transparent',
    opacity: layerOpacity,
    transition: previewMode || isEditing ? 'none' : 'opacity 0.2s ease',
    boxShadow: previewMode
      ? 'none'
      : showCanvasSelectionInset
      ? 'inset 0 0 0 2px #FF7700'
      : element.locked
        ? 'inset 0 0 0 1px dashed #9ca3af'
        : isEditing
          ? 'inset 0 0 0 2px #3b82f6'
          : 'none',
    cursor: previewMode
      ? 'default'
      : element.locked
      ? 'not-allowed'
      : isEditing
        ? 'text'
        : isSelected
          ? 'move'
          : usesCanvasEdit
            ? 'pointer'
            : isCanvasDragging
              ? 'grabbing'
              : 'move',
    overflow:
      isEditing
      || isShapeCropMode
      || elementRotation !== 0
      || isTableElementType(element.type)
        ? 'visible'
        : 'hidden',
    boxSizing: 'border-box',
    userSelect: isEditing || isTableCellEditing ? 'text' : 'none',
    display: isStructured ? 'flex' : undefined,
    flexDirection: isStructured ? 'column' : undefined,
    justifyContent: isStructured ? 'flex-start' : undefined,
    alignItems: isStructured ? 'stretch' : undefined,
  };

  const textEditor = (
    <EditableText
      element={element}
      props={props}
      isSelected={isSelected}
      isEditing={isEditing}
      onSelect={onSelect}
      onStartEdit={usesCanvasEdit ? onStartEdit : undefined}
      onUpdateContent={onUpdateContent}
      onCommitContent={onCommitContent}
      onCommitRichContent={onCommitRichContent}
      onUpdateProps={onUpdateProps}
      pendingEditChar={pendingEditChar}
      onPendingEditCharConsumed={onPendingEditCharConsumed}
      onStructuredContentHeight={onStructuredContentHeight}
      previewMode={previewMode}
    />
  );

  const renderContent = () => {
    if (inlineTextEditable) return textEditor;
    if (isDataField) {
      return (
        <DataFieldSurface
          element={element}
          props={props}
          isSelected={isSelected}
          isEditing={isEditing}
          onSelect={onSelect}
          onStartEdit={inlineFieldEditable ? onStartEdit : undefined}
          onUpdateContent={onUpdateContent}
          onCommitContent={onCommitContent}
          onUpdateProps={onUpdateProps}
          pendingEditChar={pendingEditChar}
          onPendingEditCharConsumed={onPendingEditCharConsumed}
          onStructuredContentHeight={onStructuredContentHeight}
          previewMode={previewMode}
        />
      );
    }

    switch (element.type) {
      case ComponentType.LOGO:
      case ComponentType.IMAGE:
      case ComponentType.SIGNATURE:
      case ComponentType.STAMP:
      case ComponentType.BARCODE:
        return (
          <ImageView
            element={element}
            props={props}
            isSelected={isSelected}
            onSelect={onSelect}
            onUpdateProps={onUpdateProps}
          />
        );
      case ComponentType.DIVIDER:
        return (
          <div className="flex h-full w-full items-center justify-center">
            <hr
              className="m-0 w-full border-0"
              style={{
                borderTop: `${(props.thickness as number) || 1}px solid ${(props.color as string) || '#000000'}`,
              }}
            />
          </div>
        );
      case ComponentType.PRODUCT_TABLE:
      case ComponentType.TABLE:
      case ComponentType.INVOICE_TABLE:
      case ComponentType.INVOICE_TABLE_2:
      case ComponentType.INVOICE_TABLE_3:
        return (
          <ProductTableView
            elementId={element.id}
            elementType={element.type}
            props={props}
            containerWidth={element.width}
            containerHeight={element.height}
            previewMode={previewMode}
            trustTableProps={trustTableProps}
            onTableCellChange={onTableCellChange}
            locked={!!element.locked}
            isSelected={isSelected}
            interactionMode={interactionMode}
            onInteractionModeChange={onInteractionModeChange}
          />
        );
      case ComponentType.COMPANY_CARD:
      case ComponentType.CUSTOMER_CARD:
      case ComponentType.PAYMENT_DETAILS:
        return (
          <CardView
            element={element}
            props={props}
            isSelected={isSelected}
            onSelect={onSelect}
          />
        );
      case ComponentType.QR_CODE:
        return <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs">QR</div>;
      default:
        if (isShapeType(element.type)) {
          return (
            <ShapeElementView
              element={element}
              props={props}
              isSelected={isSelected}
              onUpdateProps={onUpdateProps}
            />
          );
        }
        if (isTextStylable(element.type)) return textEditor;
        return <div className="text-xs text-gray-400 p-1">{element.type}</div>;
    }
  };

  const handleSurfacePointerDown = (event: React.PointerEvent) => {
    if (isShapeCropMode) {
      event.stopPropagation();
      return;
    }
    if (isEditing && event.target === event.currentTarget) {
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    // Tables: never block Rnd — press selects and can drag immediately (Canva-like).
    if (isTableElementType(element.type)) {
      return;
    }
    // Non-inline surfaces: first click selects; double-click must not start a drag.
    if (!usesCanvasEdit && (!isSelected || event.detail >= 2)) {
      event.stopPropagation();
    }
  };

  return (
    <div
      className={`relative ${usesCanvasEdit ? 'builder-text-element' : 'builder-element-surface'}`}
      style={{
        ...style,
        pointerEvents: previewMode ? 'none' : getElementPointerEvents(element, { isSelected }),
      }}
      onPointerDown={previewMode ? undefined : handleSurfacePointerDown}
      onDoubleClick={previewMode ? undefined : (event) => {
        if (usesCanvasEdit || isEditing) return;
        event.stopPropagation();
        onSelect(false);
        if (isTableElementType(element.type) && !element.locked) {
          onInteractionModeChange?.('edit');
        }
      }}
      onClick={previewMode ? undefined : (event) => {
        if (isEditing) return;
        const target = event.target as HTMLElement;
        if (inlineTextEditable && target.closest('.builder-text-surface, .outline-list-editor, .builder-text-editor')) {
          return;
        }
        if (isDataField && target.closest('.builder-field-surface')) {
          return;
        }
        if (isCard && target.closest('.builder-card-surface')) {
          return;
        }
        if (isImage && target.closest('.builder-image-surface')) {
          return;
        }
        if (
          isTableElementType(element.type)
          && target.closest('.builder-table-cell-editor, .builder-table-surface')
        ) {
          event.stopPropagation();
          if (target.closest('.builder-table-cell-editor')) {
            if (interactionMode === 'move') {
              onSelect(event.shiftKey || event.ctrlKey || event.metaKey);
            }
            return;
          }
        }
        if (
          (element.type === ComponentType.PRODUCT_TABLE
            || element.type === ComponentType.TABLE
            || element.type === ComponentType.INVOICE_TABLE
            || element.type === ComponentType.INVOICE_TABLE_2
            || element.type === ComponentType.INVOICE_TABLE_3)
          && target.closest('.builder-table-surface')
        ) {
          event.stopPropagation();
          onSelect(event.shiftKey || event.ctrlKey || event.metaKey);
          return;
        }
        event.stopPropagation();
        onSelect(event.shiftKey || event.ctrlKey || event.metaKey);
      }}
    >
      {renderContent()}
      {!previewMode && element.locked && (
        <div
          className="pointer-events-none absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-md bg-gray-900/55 text-white shadow-sm"
          title="Locked"
        >
          <Lock className="h-3 w-3" />
        </div>
      )}
    </div>
  );
}
