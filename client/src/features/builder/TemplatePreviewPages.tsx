import { useMemo, type MutableRefObject } from 'react';
import type { TemplatePage } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { ElementRenderer } from '@/features/builder/ElementRenderer';
import { getPageDimensions } from '@/features/builder/builder-dnd';
import { sortByLayer, getBaseOpacity, getElementSlotOverflow } from '@/features/builder/element-layers';
import {
  applyPlaceholdersToPages,
  SAMPLE_PREVIEW_CONTEXT,
  type PlaceholderContext,
} from '@/features/template-gallery/placeholder-utils';
import { applyInvoiceFormToPages } from '@/features/invoice-composer/apply-invoice-form';
import { formatDisplayDate } from '@/lib/date-format';
import { getElementRotationTransformStyle } from '@/features/builder/element-rotation';
import { reflowPagesForPreview, applyPreviewPageNumbers, collectIntentionalOverlapElementIds } from '@/features/builder/preview-page-reflow';
import { fitOverflowingDataFields } from '@/features/builder/fit-preview-data-fields';
import { cloneTemplatePages } from '@/features/invoice-composer/invoice-document';
import {
  type CompanyBrandingScope,
} from '@/features/builder/company-branding';
import { MadeWithInvogenBadge } from '@/features/builder/MadeWithInvogenBadge';
import { AutoPageNumber } from '@/features/builder/AutoPageNumber';
import { enforceInvoiceDueDateOrderOnPages } from '@/features/builder/invoice-date-order';
import { PageIndicator } from '@/features/builder/PageIndicator';

export const TEMPLATE_PREVIEW_PAGE_ATTR = 'data-template-preview-page';

interface TemplatePreviewPagesProps {
  pages: TemplatePage[];
  useSampleData?: boolean;
  /** Live invoice form values — overrides useSampleData when set. */
  placeholderContext?: PlaceholderContext;
  brandingScope?: CompanyBrandingScope;
  /** Fit each page into this width for on-screen preview. Omit for full-size export nodes. */
  previewMaxWidth?: number;
  pageRefs?: MutableRefObject<(HTMLDivElement | null)[]>;
  className?: string;
  /** Tables on pages are already recalculated (invoice composer). */
  trustTableProps?: boolean;
  /**
   * When true, expand overflowing blocks and push content on a preview-only copy.
   * Leave false when pages were already prepared via prepareInvoiceLivePreviewPages
   * (avoids a second reflow/fit that mismatches the builder).
   */
  autoReflow?: boolean;
  /**
   * When false, skip fitOverflowingDataFields (pages already fitted upstream).
   * Defaults to true when autoReflow is true, false when autoReflow is false.
   */
  fitDataFields?: boolean;
  /** Enable product picker and other table cell edits in scaled live preview. */
  editableTables?: boolean;
  onTableCellChange?: (
    pageId: string,
    elementId: string,
    rowId: string,
    columnId: string,
    value: string
  ) => void;
  onTableProductPick?: (
    pageId: string,
    elementId: string,
    rowId: string,
    columnId: string,
    product: import('./use-company-products').CompanyProductOption
  ) => void;
}

function renderPageElements(
  page: TemplatePage,
  pageIndex: number,
  pageCount: number,
  trustTableProps = false,
  editableTables = false,
  onTableCellChange?: TemplatePreviewPagesProps['onTableCellChange'],
  onTableProductPick?: TemplatePreviewPagesProps['onTableProductPick']
) {
  const overlapIds = collectIntentionalOverlapElementIds(page.elements);
  return sortByLayer(page.elements)
    .filter((element) => element.visible !== false)
    .map((element) => {
      const allowOverlapOverflow = overlapIds.has(element.id);
      return (
      <div
        key={element.id}
        style={{
          position: 'absolute',
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          zIndex: element.zIndex,
          opacity: getBaseOpacity(element),
          overflow: getElementSlotOverflow(element, { allowOverlapOverflow }),
        }}
      >
        <div
          className="h-full w-full"
          style={
            element.type === ComponentType.DIVIDER
              ? undefined
              : getElementRotationTransformStyle(
                  element.type,
                  element.props as Record<string, unknown> | undefined
                )
          }
        >
          <ElementRenderer
            element={element}
            isSelected={false}
            previewMode
            allowOverlapOverflow={allowOverlapOverflow}
            trustTableProps={trustTableProps}
            pageIndex={pageIndex}
            pageCount={pageCount}
            onTableCellChange={
              editableTables && onTableCellChange
                ? (rowId, columnId, value) =>
                    onTableCellChange(page.id, element.id, rowId, columnId, value)
                : undefined
            }
            onTableProductPick={
              editableTables && onTableProductPick
                ? (rowId, columnId, product) =>
                    onTableProductPick(page.id, element.id, rowId, columnId, product)
                : undefined
            }
            onSelect={() => {}}
          />
        </div>
      </div>
      );
    });
}

export function TemplatePreviewPages({
  pages,
  useSampleData = true,
  placeholderContext,
  brandingScope: _brandingScope,
  previewMaxWidth,
  pageRefs,
  className = '',
  trustTableProps = false,
  /** Default on so every live preview matches builder Word-style flow/pagination. */
  autoReflow = true,
  fitDataFields,
  editableTables = false,
  onTableCellChange,
  onTableProductPick,
}: TemplatePreviewPagesProps) {
  const shouldFitFields = fitDataFields ?? autoReflow;
  const renderPages = useMemo(() => {
    let resolved = pages;
    if (placeholderContext) resolved = applyInvoiceFormToPages(pages, placeholderContext);
    else if (useSampleData) {
      const due = new Date();
      due.setDate(due.getDate() + 15);
      resolved = applyPlaceholdersToPages(pages, {
        ...SAMPLE_PREVIEW_CONTEXT,
        Date: formatDisplayDate(),
        DueDate: formatDisplayDate(due),
      });
    }

    const cloned = cloneTemplatePages(resolved);
    const laidOut = autoReflow
      ? reflowPagesForPreview(cloned, { trustTableProps })
      : applyPreviewPageNumbers(cloned);
    // Only fit fields when this pass owns layout. Pre-prepared invoice pages
    // already ran fitOverflowingDataFields — a second pass relocates boxes.
    if (!shouldFitFields) {
      return enforceInvoiceDueDateOrderOnPages(laidOut).pages;
    }
    const originalElements = cloned.flatMap((p) => p.elements);
    const fitted = fitOverflowingDataFields(laidOut, originalElements);
    return enforceInvoiceDueDateOrderOnPages(fitted).pages;
  }, [pages, placeholderContext, useSampleData, trustTableProps, autoReflow, shouldFitFields]);

  return (
    <div className={`flex flex-col items-center gap-8 ${className}`}>
      {renderPages.map((page, index) => {
        const { width, height } = getPageDimensions(page);
        const scale = previewMaxWidth ? previewMaxWidth / width : 1;
        const scaledW = Math.round(width * scale);
        const scaledH = Math.round(height * scale);
        const pageCount = renderPages.length;

        if (previewMaxWidth) {
          return (
            <div key={page.id} className="flex flex-col items-center gap-3">
              <PageIndicator pageIndex={index} pageCount={pageCount} variant="bar" />
              <div
                className="relative overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/5"
                style={{ width: scaledW, height: scaledH }}
              >
                <div
                  className={`absolute left-0 top-0 origin-top-left bg-white ${
                    editableTables ? '' : 'pointer-events-none'
                  }`}
                  style={{
                    width,
                    height,
                    transform: `scale(${scale})`,
                  }}
                >
                  {renderPageElements(
                    page,
                    index,
                    pageCount,
                    trustTableProps,
                    editableTables,
                    onTableCellChange,
                    onTableProductPick
                  )}
                  <AutoPageNumber
                    pageIndex={index}
                    pageCount={pageCount}
                    elements={page.elements}
                  />
                  <MadeWithInvogenBadge />
                </div>
              </div>
            </div>
          );
        }

        return (
          <div
            key={page.id}
            ref={(node) => {
              if (pageRefs) pageRefs.current[index] = node;
            }}
            data-template-preview-page={page.id}
            className="relative bg-white"
            style={{ width, height }}
          >
            {renderPageElements(
              page,
              index,
              pageCount,
              trustTableProps,
              editableTables,
              onTableCellChange,
              onTableProductPick
            )}
            <AutoPageNumber
              pageIndex={index}
              pageCount={pageCount}
              elements={page.elements}
            />
            <MadeWithInvogenBadge />
          </div>
        );
      })}
    </div>
  );
}
