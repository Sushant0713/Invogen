import { useMemo } from 'react';
import type { TemplatePage } from '@invogen/shared';
import { ElementRenderer } from '@/features/builder/ElementRenderer';
import { getPageDimensions } from '@/features/builder/builder-dnd';
import { sortByLayer } from '@/features/builder/element-layers';
import {
  applyPlaceholdersToPages,
  SAMPLE_PREVIEW_CONTEXT,
} from './placeholder-utils';
import { getElementRotationTransformStyle } from '@/features/builder/element-rotation';
import { CompanyBrandingProvider } from '@/features/builder/CompanyBrandingProvider';
import { TaxSettingsProvider } from '@/features/builder/TaxSettingsProvider';
import {
  type CompanyBrandingScope,
} from '@/features/builder/company-branding';

interface TemplatePreviewRendererProps {
  page: TemplatePage;
  /** Scale factor applied via CSS transform (e.g. 0.22 for card thumbnails). */
  scale?: number;
  /** Fit preview to this width (overrides scale when set). */
  maxWidth?: number;
  /** Replace {{Placeholders}} with sample data for realistic previews. */
  useSampleData?: boolean;
  /** Where logo/signature are loaded from (defaults to tenant company). */
  brandingScope?: CompanyBrandingScope;
  className?: string;
}

/**
 * Renders the first template page from JSON — same objects the editor uses.
 * Never uses screenshot images.
 */
export function TemplatePreviewRenderer({
  page,
  scale = 0.22,
  maxWidth,
  useSampleData = true,
  brandingScope = 'admin',
  className = '',
}: TemplatePreviewRendererProps) {
  const renderPage = useMemo(() => {
    if (!useSampleData) return page;
    const [first] = applyPlaceholdersToPages([page], SAMPLE_PREVIEW_CONTEXT);
    return first ?? page;
  }, [page, useSampleData]);

  const { width, height } = getPageDimensions(renderPage);
  const effectiveScale = maxWidth ? maxWidth / width : scale;
  const scaledW = Math.round(width * effectiveScale);
  const scaledH = Math.round(height * effectiveScale);

  return (
    <CompanyBrandingProvider scope={brandingScope}>
    <TaxSettingsProvider scope={brandingScope}>
    <div
      className={`relative overflow-hidden bg-white ${className}`}
      style={{ width: scaledW, height: scaledH }}
      aria-hidden
    >
      <div
        className="pointer-events-none absolute left-0 top-0 origin-top-left bg-white shadow-sm"
        style={{
          width,
          height,
          transform: `scale(${effectiveScale})`,
        }}
      >
        {sortByLayer(renderPage.elements)
          .filter((el) => el.visible !== false)
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
                onSelect={() => {}}
              />
              </div>
            </div>
          ))}
      </div>
    </div>
    </TaxSettingsProvider>
    </CompanyBrandingProvider>
  );
}
