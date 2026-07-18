import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import { updateElement, deleteElement, deleteSelectedElements, selectElement, toggleElementLock, toggleElementPin, setElementsLocked } from '@/store/slices/builderSlice';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Lock, LockOpen, Pin, PinOff } from 'lucide-react';
import { ProductTableProperties } from './ProductTableProperties';
import { InvoiceTableProperties } from './InvoiceTableProperties';
import { CardProperties } from './CardProperties';
import { InvoiceTable2Properties } from './InvoiceTable2Properties';
import { InvoiceTable3Properties } from './InvoiceTable3Properties';
import {
  isTableElementType,
} from './product-table';
import { isInvoiceTable1Type } from './invoice-table';
import { isInvoiceTable2Type } from './invoice-table-2';
import { isInvoiceTable3Type } from './invoice-table-3';
import { tablePropsNeedDocumentLayout } from './table-props-normalize';
import { mergeTablePaginationProps, resolvePaginationTableId, isTableContinuationSegment } from './product-table';
import { ImageProperties } from './ImageProperties';
import { ComponentType } from '@invogen/shared';
import { getEditableTextKey, isDataFieldType } from './text-styles';
import {
  formatDisplayDate,
  formatIsoDate,
  getDatePickerValue,
  isDateFieldComponentType,
  usesLiveDate,
} from '@/lib/date-format';
import {
  clampDueDateElementProps,
  findPrimaryInvoiceDateIso,
  isDueBeforeInvoice,
} from './invoice-date-order';
import { toast } from 'sonner';
import { isCardComponentType, estimateCardBlockHeight, type CardCustomField } from './card-components';
import { isImageComponentType } from './image-components';
import { isShapeComponentType } from './shape-components';
import { ShapeProperties } from './ShapeProperties';
import { TermsProperties } from './TermsProperties';
import { AddressProperties } from './AddressProperties';
import { RotationControlsPanel } from './RotationControlsPanel';
import { resolveSelectedElementLocation } from './builder-selection';
import { writeBuilderClipboard } from './builder-clipboard';
import { estimateStructuredBlockHeight } from './structured-content-layout';
import { LibraryIconTile } from './LibraryIconTile';
import { inferFieldGlyphKey } from './icon-components';
import {
  extractPlaceholderKeysFromText,
  placeholderFieldLabel,
} from '@/features/template-gallery/placeholder-utils';
import { LayoutIntentPanel, LayoutWarningsPanel } from './LayoutIntentPanel';
import { buildLayoutIntentProps, suggestFlowGroupId } from './layout-intent';

export function PropertiesPanel() {
  const dispatch = useAppDispatch();
  const { pages, activePageIndex, selectedElementIds } = useAppSelector((s) => s.builder);
  const page = pages[activePageIndex];
  const selectedLocation = resolveSelectedElementLocation(pages, selectedElementIds);
  const element = selectedLocation?.element;

  if (selectedElementIds.length > 1) {
    const selectedElements = pages[activePageIndex].elements.filter((el) =>
      selectedElementIds.includes(el.id)
    );
    const lockedCount = selectedElements.filter((el) => el.locked).length;
    const unlockedCount = selectedElements.length - lockedCount;
    const deletableCount = unlockedCount;

    return (
      <div className="w-64 border-l border-gray-200 bg-white p-4 space-y-4">
        <h3 className="text-sm font-semibold">Properties</h3>
        <p className="text-sm text-gray-700">
          {selectedElements.length} components selected
        </p>
        {lockedCount > 0 && (
          <p className="text-xs text-gray-500">
            {lockedCount} locked component{lockedCount === 1 ? '' : 's'} will be kept when deleting.
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              const groupId = suggestFlowGroupId('flow');
              for (const el of selectedElements) {
                if (el.locked) continue;
                dispatch(
                  updateElement({
                    id: el.id,
                    changes: { props: buildLayoutIntentProps({ flowGroupId: groupId }) },
                    recordHistory: true,
                  })
                );
              }
              toast.success(`Grouped ${unlockedCount} components as “${groupId}”`);
            }}
            disabled={unlockedCount < 2}
          >
            Group as flow (live push together)
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              writeBuilderClipboard(selectedElements);
              toast.success(
                selectedElements.length === 1
                  ? 'Component copied'
                  : `${selectedElements.length} components copied`
              );
            }}
          >
            Copy selection
          </Button>
          {lockedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                dispatch(
                  setElementsLocked({
                    ids: selectedElements.filter((el) => el.locked).map((el) => el.id),
                    locked: false,
                  })
                )
              }
            >
              <LockOpen className="h-4 w-4" />
              Unlock {lockedCount} component{lockedCount === 1 ? '' : 's'}
            </Button>
          )}
          {unlockedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() =>
                dispatch(
                  setElementsLocked({
                    ids: selectedElements.filter((el) => !el.locked).map((el) => el.id),
                    locked: true,
                  })
                )
              }
            >
              <Lock className="h-4 w-4" />
              Lock {unlockedCount} component{unlockedCount === 1 ? '' : 's'}
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            className="w-full"
            disabled={deletableCount === 0}
            onClick={() => dispatch(deleteSelectedElements())}
          >
            Delete {deletableCount} component{deletableCount === 1 ? '' : 's'}
          </Button>
        </div>
        <p className="text-[11px] text-gray-400">
          Shift+click or Ctrl+click to add or remove from selection. Ctrl+C copies; open another
          template and press Ctrl+V to paste. Ctrl+A selects all on this page.
        </p>
      </div>
    );
  }

  if (!element) {
    const page = pages[activePageIndex];
    const reference = page.elements.find(
      (el) =>
        (el.props as Record<string, unknown> | undefined)?.rasterFallback === true ||
        (el.props as Record<string, unknown> | undefined)?.isReferenceBackground === true
    );

    return (
      <div className="w-64 border-l border-gray-200 bg-white p-4 space-y-4">
        <LayoutWarningsPanel />
        {reference ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              This page includes a rasterized fallback image from import. Select it to remove or
              replace it, and edit the other extracted objects on the canvas.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => dispatch(selectElement(reference.id))}
              >
                Select reference layer
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => dispatch(deleteElement(reference.id))}
              >
                Remove reference layer
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Select an element to edit properties</p>
        )}
      </div>
    );
  }

  const isTable = isTableElementType(element.type);
  const isCard = isCardComponentType(element.type);
  const isImage = isImageComponentType(element.type);
  const isShape = isShapeComponentType(element.type);
  const isTerms = element.type === ComponentType.TERMS;
  const isAddress = element.type === ComponentType.ADDRESS;
  const isDivider = element.type === ComponentType.DIVIDER;

  const props = (element.props ?? {}) as Record<string, unknown>;
  const textKey = getEditableTextKey(element.type);

  const updateProp = (key: string, value: unknown, recordHistory = false) => {
    const nextProps = { ...props, [key]: value };
    if (isCard) {
      const nextHeight = estimateCardBlockHeight(
        element.type,
        nextProps,
        element.width,
        element.height
      );
      dispatch(updateElement({
        id: element.id,
        changes: {
          props: nextProps,
          ...(nextHeight !== element.height ? { height: nextHeight } : {}),
        },
        recordHistory,
      }));
      return;
    }
    dispatch(updateElement({
      id: element.id,
      changes: { props: nextProps },
      recordHistory,
    }));
  };

  const updateDateProps = (
    changes: { value?: string; useLiveDate?: boolean },
    recordHistory = false
  ) => {
    const nextProps: Record<string, unknown> = { ...props, ...changes };

    if (element.type === ComponentType.DUE_DATE) {
      const invoiceIso = findPrimaryInvoiceDateIso(pages);
      const dueCandidate = getDatePickerValue(nextProps, ComponentType.DUE_DATE);
      if (invoiceIso && isDueBeforeInvoice(invoiceIso, dueCandidate)) {
        toast.error('Due date cannot be before invoice date');
      }
      const { props: clampedProps } = clampDueDateElementProps(nextProps, invoiceIso);
      dispatch(
        updateElement({
          id: element.id,
          changes: { props: clampedProps },
          recordHistory,
        })
      );
      return;
    }

    // Invoice date changed — update this field, then bump any earlier due dates.
    dispatch(
      updateElement({
        id: element.id,
        changes: { props: nextProps },
        recordHistory,
      })
    );

    if (element.type !== ComponentType.DATE) return;

    const nextInvoiceIso = getDatePickerValue(nextProps, ComponentType.DATE);
    if (!nextInvoiceIso) return;

    let bumped = false;
    for (const page of pages) {
      for (const el of page.elements) {
        if (el.type !== ComponentType.DUE_DATE) continue;
        const dueProps = (el.props ?? {}) as Record<string, unknown>;
        const { props: clampedProps, changed } = clampDueDateElementProps(dueProps, nextInvoiceIso);
        if (!changed) continue;
        bumped = true;
        dispatch(
          updateElement({
            id: el.id,
            changes: { props: clampedProps },
            recordHistory: false,
          })
        );
      }
    }
    if (bumped) {
      toast.message('Due date updated — it cannot be before invoice date');
    }
  };

  const updateCardCustomFields = (customFields: CardCustomField[], recordHistory = false) => {
    const nextProps = { ...props, customFields };
    const nextHeight = estimateCardBlockHeight(
      element.type,
      nextProps,
      element.width,
      element.height
    );
    dispatch(updateElement({
      id: element.id,
      changes: {
        props: nextProps,
        ...(nextHeight !== element.height ? { height: nextHeight } : {}),
      },
      recordHistory,
    }));
  };

  const updateAllProps = (next: Record<string, unknown>) => {
    if (isTable) {
      const needsLayout = tablePropsNeedDocumentLayout(element.type, props, next);
      const nextProps = mergeTablePaginationProps(props, next, {
        clearSegmentRange: needsLayout && !isTableContinuationSegment(props),
        anchorElementId: resolvePaginationTableId(props, element.id),
      });
      dispatch(updateElement({
        id: element.id,
        changes: { props: nextProps },
        replaceProps: true,
        recordHistory: true,
        skipDocumentLayout: !needsLayout,
      }));
      return;
    }
    dispatch(updateElement({
      id: element.id,
      changes: { props: next },
      recordHistory: true,
    }));
  };

  return (
    <div
      className={`border-l border-gray-200 bg-white p-4 overflow-y-auto space-y-4 ${
        isTable || isCard || isImage || isShape || isTerms || isAddress ? 'w-80' : 'w-64'
      }`}
    >
      <h3 className="text-sm font-semibold">Properties</h3>
      <p className="text-xs text-gray-500">{element.type}</p>

      {element.locked ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
          <div className="flex items-start gap-2">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-medium text-amber-900">Component locked</p>
              <p className="mt-1 text-xs text-amber-800/80">
                Locked components cannot be moved, resized, or edited. They are click-through so
                you can select layers underneath (e.g. watermarks). Click again on overlapping
                areas to cycle through stacked layers.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => dispatch(toggleElementLock(element.id))}
          >
            <LockOpen className="h-4 w-4" />
            Unlock component
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => dispatch(toggleElementLock(element.id))}
        >
          <Lock className="h-4 w-4" />
          Lock component
        </Button>
      )}

      {element.pinned ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-3">
          <div className="flex items-start gap-2">
            <Pin className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
            <div>
              <p className="text-sm font-medium text-blue-900">Pinned to position</p>
              <p className="mt-1 text-xs text-blue-800/80">
                Soft pin: prefers this spot when content fits. If a table above grows,
                this component still moves down and paginates so invoices do not overlap.
                Logos, watermarks, and footers stay fixed automatically.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-blue-700 hover:text-blue-800 hover:bg-blue-100 border-blue-200"
            onClick={() => dispatch(toggleElementPin(element.id))}
          >
            <PinOff className="h-4 w-4" />
            Unpin component (allow flow)
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-600"
          onClick={() => dispatch(toggleElementPin(element.id))}
        >
          <Pin className="h-4 w-4" />
          Pin to position
        </Button>
      )}

      <LayoutIntentPanel element={element} />
      <LayoutWarningsPanel />

      <fieldset
        disabled={!!element.locked}
        className={`space-y-4 border-0 p-0 m-0 min-w-0 ${element.locked ? 'opacity-50' : ''}`}
      >

      {isTable && isInvoiceTable1Type(element.type) && (
        <InvoiceTableProperties props={props} onChange={updateAllProps} />
      )}

      {isTable && isInvoiceTable2Type(element.type) && (
        <InvoiceTable2Properties props={props} onChange={updateAllProps} />
      )}

      {isTable && isInvoiceTable3Type(element.type) && (
        <InvoiceTable3Properties props={props} onChange={updateAllProps} />
      )}

      {isTable && !isInvoiceTable1Type(element.type) && !isInvoiceTable2Type(element.type) && !isInvoiceTable3Type(element.type) && (
        <ProductTableProperties props={props} onChange={updateAllProps} />
      )}

      {isCard && (
        <CardProperties
          type={element.type}
          props={props}
          onChange={(key, value, recordHistory) => updateProp(key, value, recordHistory)}
          onChangeMany={(patch, recordHistory) => {
            dispatch(updateElement({
              id: element.id,
              changes: { props: { ...props, ...patch } },
              recordHistory: !!recordHistory,
            }));
          }}
          onCustomFieldsChange={updateCardCustomFields}
        />
      )}

      {isImage && (
        <ImageProperties
          elementType={element.type}
          elementId={element.id}
          props={props}
          onChange={(key, value, recordHistory) => updateProp(key, value, recordHistory)}
          onChangeMany={(patch, recordHistory) => {
            dispatch(updateElement({
              id: element.id,
              changes: { props: { ...props, ...patch } },
              recordHistory: !!recordHistory,
            }));
          }}
        />
      )}

      {isShape && (
        <ShapeProperties
          type={element.type}
          elementId={element.id}
          props={props}
          onChange={(key, value, recordHistory) => updateProp(key, value, recordHistory)}
        />
      )}

      {isTerms && (
        <TermsProperties
          props={props}
          onChange={(next, recordHistory) => {
            dispatch(updateElement({
              id: element.id,
              changes: { props: next },
              replaceProps: true,
              recordHistory: !!recordHistory,
            }));
          }}
        />
      )}

      {isAddress && (
        <AddressProperties
          props={props}
          onChange={(next, recordHistory) => {
            dispatch(updateElement({
              id: element.id,
              changes: { props: next },
              replaceProps: true,
              recordHistory: !!recordHistory,
            }));
          }}
        />
      )}

      {isDivider && (
        <RotationControlsPanel
          props={props}
          onChange={(rotation, recordHistory) => updateProp('rotation', rotation, recordHistory)}
        />
      )}

      {textKey && !isTable && !isCard && !isImage && !isShape && !isDivider && !isTerms && !isAddress && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">
              {textKey === 'label' ? 'Label' : textKey === 'text' ? 'Text' : 'Content'}
            </label>
            <textarea
              className="w-full mt-1 rounded-lg border p-2 text-sm"
              value={(props[textKey] as string) || ''}
              onChange={(e) => updateProp(textKey, e.target.value)}
              onBlur={(e) => updateProp(textKey, e.target.value, true)}
            />
            {(element.type === ComponentType.TEXT || element.type === ComponentType.HEADING) && (
              <p className="mt-1 text-[11px] text-gray-400">
                Tip: wrap words in {'< >'} to make them fillable on invoice preview — e.g. My name is {'<your name>'}.
              </p>
            )}
          </div>
          {(element.type === ComponentType.TEXT || element.type === ComponentType.HEADING) && (() => {
            const content = String((props[textKey] as string) || '');
            const placeholders = extractPlaceholderKeysFromText(content);
            const insertPlaceholder = (label: string) => {
              const token = `<${label}>`;
              const next = content.trim() ? `${content}${content.endsWith(' ') ? '' : ' '}${token}` : token;
              updateProp(textKey, next, true);
            };
            return (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                <div>
                  <p className="text-xs font-semibold text-gray-700">Placeholders</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    These become fillable fields in the invoice preview form.
                  </p>
                </div>
                {placeholders.length > 0 ? (
                  <ul className="space-y-1.5">
                    {placeholders.map((key) => (
                      <li
                        key={key}
                        className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5"
                      >
                        <span className="truncate text-xs font-medium text-gray-800">
                          {placeholderFieldLabel(key)}
                        </span>
                        <code className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                          {`<${key}>`}
                        </code>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-gray-500">
                    No placeholders yet. Add one below or type {'<your name>'} in the text.
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {['your name', 'company name', 'invoice number', 'date'].map((label) => (
                    <button
                      key={label}
                      type="button"
                      className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:border-primary/40 hover:text-primary"
                      onClick={() => insertPlaceholder(label)}
                    >
                      {`+ <${label}>`}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
          {isDateFieldComponentType(element.type) && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">
                  {element.type === ComponentType.DUE_DATE ? 'Due date' : 'Invoice date'}
                </label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={getDatePickerValue(props, element.type)}
                  min={
                    element.type === ComponentType.DUE_DATE
                      ? findPrimaryInvoiceDateIso(pages) || undefined
                      : undefined
                  }
                  onChange={(e) => {
                    const picked = e.target.value;
                    if (!picked) return;
                    updateDateProps({ value: picked, useLiveDate: false }, true);
                  }}
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  {element.type === ComponentType.DUE_DATE
                    ? 'Must be on or after the invoice date.'
                    : 'Choose a sample date, or enable live date below to always show today.'}
                </p>
              </div>
              {element.type === ComponentType.DATE ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={usesLiveDate(props, element.type)}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    if (enabled) {
                      updateDateProps({ useLiveDate: true, value: formatIsoDate() }, true);
                    } else {
                      updateDateProps({ useLiveDate: false }, true);
                    }
                  }}
                />
                Use live date (always today)
              </label>
              ) : null}
              {element.type === ComponentType.DATE && usesLiveDate(props, element.type) ? (
                <p className="text-[11px] text-primary/80">
                  Preview shows today: {formatDisplayDate()} — pick a date above to use a fixed date instead.
                </p>
              ) : (
                <p className="text-[11px] text-gray-400">
                  Preview uses:{' '}
                  {formatDisplayDate(
                    new Date(`${getDatePickerValue(props, element.type)}T12:00:00`)
                  )}
                </p>
              )}
            </div>
          )}
          {isDataFieldType(element.type) && !isDateFieldComponentType(element.type) && (
            <div>
              <label className="text-xs text-gray-500">Value</label>
              <p className="mt-0.5 text-[11px] text-gray-400">
                Sample shown on the template — replaced with live invoice data when generated.
              </p>
              <textarea
                className="w-full mt-1 rounded-lg border p-2 text-sm"
                rows={element.type === ComponentType.ADDRESS ? 4 : 2}
                value={(props.value as string) ?? ''}
                onChange={(e) => updateProp('value', e.target.value)}
                onBlur={(e) => updateProp('value', e.target.value, true)}
              />
            </div>
          )}
          {element.type === ComponentType.FIELD && (() => {
            const glyph =
              typeof props.iconKey === 'string' && props.iconKey
                ? props.iconKey
                : inferFieldGlyphKey(props);
            const isAddressField =
              glyph === 'address'
              || props.multiline === true
              || (typeof props.dataKey === 'string' && /address/i.test(props.dataKey));

            if (isAddressField) {
              const logoOn = props.showIcon === true;
              return (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-200/70 p-1">
                    <button
                      type="button"
                      className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                        !logoOn
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                      onClick={() => updateProp('showIcon', false, true)}
                    >
                      Label
                    </button>
                    <button
                      type="button"
                      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                        logoOn
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                      onClick={() => updateProp('showIcon', true, true)}
                    >
                      <LibraryIconTile iconKey={glyph} size={16} />
                      Logo
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {logoOn
                      ? 'Logo only — no Address text label.'
                      : 'Address label + text — no logo.'}
                  </p>
                </div>
              );
            }

            return (
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left transition-colors hover:border-primary/40"
                onClick={() => updateProp('showIcon', !(props.showIcon === true), true)}
              >
                <span className="flex items-center gap-2">
                  <LibraryIconTile
                    iconKey={glyph}
                    variant={props.showIcon === true ? 'solid' : 'soft'}
                    size={22}
                  />
                  <span className="text-sm text-gray-700">Show icon before value</span>
                </span>
                <span
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    props.showIcon === true ? 'bg-primary' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                      props.showIcon === true ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              </button>
            );
          })()}
        </div>
      )}

      {props.fontSize !== undefined && (
        <Input
          label="Font Size"
          type="number"
          value={String(props.fontSize || 14)}
          onChange={(e) => updateProp('fontSize', Number(e.target.value))}
          onBlur={(e) => updateProp('fontSize', Number(e.target.value), true)}
        />
      )}

      <Input
        label="Width"
        type="number"
        value={String(element.width)}
        onChange={(e) => dispatch(updateElement({ id: element.id, changes: { width: Number(e.target.value) } }))}
        onBlur={(e) => {
          const width = Number(e.target.value);
          const changes: { width: number; height?: number } = { width };
          if (isTerms || isAddress) {
            changes.height = estimateStructuredBlockHeight(element.type, props, width);
          }
          dispatch(updateElement({
            id: element.id,
            changes,
            recordHistory: true,
          }));
        }}
      />
      <Input
        label="Height"
        type="number"
        value={String(element.height)}
        onChange={(e) => dispatch(updateElement({ id: element.id, changes: { height: Number(e.target.value) } }))}
        onBlur={(e) => dispatch(updateElement({
          id: element.id,
          changes: { height: Number(e.target.value) },
          recordHistory: true,
        }))}
      />

      {!isTable && !isImage && !isShape && (
        <Input
          label="Color"
          type="color"
          value={(props.color as string) || '#000000'}
          onChange={(e) => updateProp('color', e.target.value, true)}
        />
      )}

      <Button
        variant="danger"
        size="sm"
        className="w-full"
        disabled={!!element.locked}
        onClick={() => dispatch(deleteElement(element.id))}
      >
        Delete Element
      </Button>
      </fieldset>
    </div>
  );
}
