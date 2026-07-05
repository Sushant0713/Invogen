import { useMemo, type MutableRefObject } from 'react';
import type { TemplatePage } from '@invogen/shared';
import { ElementRenderer } from '@/features/builder/ElementRenderer';
import { getPageDimensions } from '@/features/builder/builder-dnd';
import { sortByLayer } from '@/features/builder/element-layers';
import {
  applyPlaceholdersToPages,
  SAMPLE_PREVIEW_CONTEXT,
  type PlaceholderContext,
} from '@/features/template-gallery/placeholder-utils';
import { applyInvoiceFormToPages } from '@/features/invoice-composer/apply-invoice-form';
import { getElementRotationTransformStyle } from '@/features/builder/element-rotation';
import {
  type CompanyBrandingScope,
} from '@/features/builder/company-branding';

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
}

function renderPageElements(page: TemplatePage, trustTableProps = false) {
  return sortByLayer(page.elements)
    .filter((element) => element.visible !== false)
    .map((element) => (
      <div
        key={element.id}
        style={{
          position: 'absolute',
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          zIndex: element.zIndex,
        }}
      >
        <div
          className="h-full w-full"
          style={getElementRotationTransformStyle(
            element.type,
            element.props as Record<string, unknown> | undefined
          )}
        >
          <ElementRenderer
            element={element}
            isSelected={false}
            previewMode
            trustTableProps={trustTableProps}
            onSelect={() => {}}
          />
        </div>
      </div>
    ));
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
}: TemplatePreviewPagesProps) {
  const renderPages = useMemo(() => {
    if (placeholderContext) return applyInvoiceFormToPages(pages, placeholderContext);
    if (useSampleData) return applyPlaceholdersToPages(pages, SAMPLE_PREVIEW_CONTEXT);
    return pages;
  }, [pages, placeholderContext, useSampleData]);

  return (
    <div className={`flex flex-col items-center gap-8 ${className}`}>
      {renderPages.map((page, index) => {
        const { width, height } = getPageDimensions(page);
        const scale = previewMaxWidth ? previewMaxWidth / width : 1;
        const scaledW = Math.round(width * scale);
        const scaledH = Math.round(height * scale);

        if (previewMaxWidth) {
          return (
            <div key={page.id} className="flex flex-col items-center gap-2">
              <span className="text-xs font-medium text-gray-500">{page.name}</span>
              <div
                className="relative overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/5"
                style={{ width: scaledW, height: scaledH }}
              >
                <div
                  className="pointer-events-none absolute left-0 top-0 origin-top-left bg-white"
                  style={{
                    width,
                    height,
                    transform: `scale(${scale})`,
                  }}
                >
                  {renderPageElements(page, trustTableProps)}
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
            {renderPageElements(page, trustTableProps)}
          </div>
        );
      })}
    </div>
  );
}
