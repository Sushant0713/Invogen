import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Heart, Pencil, Star, Trash2, X, Eye } from 'lucide-react';
import type { TemplateSummary } from '@invogen/shared';
import { TemplatePreviewRenderer } from './TemplatePreviewRenderer';
import { fetchTemplateDocument } from './template-loader';
import { isTemplateFavorite } from './template-manager';
import { brandingScopeFromApiBase } from '@/features/builder/company-branding';
import { formatTemplateCategoryLabel, isSuperAdminTemplateCategory } from '@/pages/super-admin/template-categories';

interface TemplateCardProps {
  template: TemplateSummary;
  apiBase: string;
  onOpen: (template: TemplateSummary) => void;
  onEdit?: (template: TemplateSummary) => void;
  onToggleFavorite?: (templateId: string) => void;
  onDelete?: (template: TemplateSummary) => void;
  canDelete?: (template: TemplateSummary) => boolean;
  favorite?: boolean;
  showEdit?: boolean;
  /** When false, preview/title click does not open the template. */
  canOpen?: boolean;
  onView?: (template: TemplateSummary) => void;
  isDeleting?: boolean;
  /** Custom primary action (e.g. New Invoice button). */
  cardAction?: React.ReactNode;
}

/** Balanced thumbnail — enough preview detail without oversized cards. */
const PREVIEW_WIDTH = 172;
const PREVIEW_VIEWPORT_HEIGHT = 148;

function PreviewSkeleton() {
  return <div className="h-full w-full animate-pulse rounded-sm bg-gray-100" />;
}

/**
 * Word-style template card: compact preview → title → action bar.
 */
export function TemplateCard({
  template,
  apiBase,
  onOpen,
  onEdit,
  onToggleFavorite,
  onDelete,
  canDelete,
  favorite,
  showEdit = true,
  canOpen = true,
  onView,
  isDeleting = false,
  cardAction,
}: TemplateCardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const isFavorite = favorite ?? isTemplateFavorite(template._id);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const { data: fullTemplate, isLoading } = useQuery({
    queryKey: ['template-document', apiBase, template._id],
    queryFn: () => fetchTemplateDocument(apiBase, template._id),
    enabled: visible,
    staleTime: 10 * 60 * 1000,
  });

  const templatePages = fullTemplate?.pages;
  const brandingScope = brandingScopeFromApiBase(apiBase);

  const openTemplate = () => {
    if (!canOpen) return;
    onOpen(template);
  };

  return (
    <article
      ref={rootRef}
      className="group flex w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
    >
      <button
        type="button"
        onClick={openTemplate}
        disabled={!canOpen}
        className="flex w-full flex-col items-center text-left disabled:cursor-not-allowed disabled:opacity-60"
        title={canOpen ? `Preview ${template.name}` : undefined}
      >
        <div className="flex justify-center px-3 pb-1 pt-4">
          <div
            className="overflow-hidden rounded-md border border-gray-200/90 bg-gray-50/80 p-1.5 shadow-sm"
            style={{ width: PREVIEW_WIDTH + 12, height: PREVIEW_VIEWPORT_HEIGHT + 12 }}
          >
            <div
              className="overflow-hidden rounded-sm bg-white"
              style={{ width: PREVIEW_WIDTH, height: PREVIEW_VIEWPORT_HEIGHT }}
            >
              {!visible || isLoading || !templatePages?.length ? (
                <PreviewSkeleton />
              ) : (
                <TemplatePreviewRenderer
                  pages={templatePages}
                  maxWidth={PREVIEW_WIDTH}
                  brandingScope={brandingScope}
                  className="shadow-none"
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-[72px] w-full flex-col items-center justify-center gap-0.5 px-3 pb-3 pt-2 text-center">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-gray-900">
            {template.name}
          </h3>
          <p
            className={`line-clamp-1 text-xs font-medium ${
              isSuperAdminTemplateCategory(template.category)
                ? 'text-red-600'
                : 'text-primary/80'
            }`}
          >
            {formatTemplateCategoryLabel(template.category)}
          </p>
          {template.description ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-gray-500">{template.description}</p>
          ) : null}
        </div>
      </button>

      <div className="mt-auto flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
        {onToggleFavorite ? (
          <button
            type="button"
            title={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite(template._id);
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-50 hover:text-red-500"
          >
            <Heart
              className={`h-[17px] w-[17px] ${isFavorite ? 'fill-red-500 text-red-500' : ''}`}
              strokeWidth={1.75}
            />
          </button>
        ) : (
          <span className="w-8" />
        )}

        <div className="flex items-center gap-1">
          {cardAction}
          {onView && (
            <button
              type="button"
              title={`View ${template.name}`}
              onClick={() => onView(template)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary"
            >
              <Eye className="h-[17px] w-[17px]" strokeWidth={1.75} />
            </button>
          )}
          {showEdit && (
            <button
              type="button"
              title={`Edit ${template.name}`}
              onClick={() => (onEdit ?? onOpen)(template)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary"
            >
              <Pencil className="h-[17px] w-[17px]" strokeWidth={1.75} />
            </button>
          )}
          {onDelete && (!canDelete || canDelete(template)) && (
            <button
              type="button"
              title={`Delete ${template.name}`}
              disabled={isDeleting}
              onClick={() => onDelete(template)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
            >
              <Trash2 className="h-[17px] w-[17px]" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function TemplateCardCompact({
  template,
  onOpen,
  canOpen = true,
  onRemove,
}: {
  template: TemplateSummary;
  onOpen: (template: TemplateSummary) => void;
  canOpen?: boolean;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="group/recent relative shrink-0">
      <button
        type="button"
        onClick={() => canOpen && onOpen(template)}
        disabled={!canOpen}
        className="flex min-w-[132px] flex-col items-start gap-0.5 rounded-lg border border-gray-200 bg-white p-2.5 pr-7 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Star className="h-3 w-3 text-amber-500" />
        <span className="line-clamp-2 text-xs font-medium leading-snug text-gray-900">
          {template.name}
        </span>
        <span className="line-clamp-1 text-[10px] text-gray-500">{template.category}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          title="Remove from recently used"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(template._id);
          }}
          className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-md text-gray-400 opacity-100 transition-opacity hover:bg-gray-100 hover:text-red-500 sm:opacity-0 sm:group-hover/recent:opacity-100"
        >
          <X className="h-3 w-3" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
