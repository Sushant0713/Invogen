import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Loader2 } from 'lucide-react';
import type { TemplateSummary } from '@invogen/shared';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { TemplateCard, TemplateCardCompact } from './TemplateCard';
import { TemplateSearch } from './TemplateSearch';
import { getTemplateCategoryOptions, TEMPLATE_CATEGORY_ALL } from './template-categories';
import { openTemplateInEditor } from './document-creator';
import { RECENT_TTL_MS } from './template-manager';
import { useTemplateGallery } from './use-template-gallery';

const RECENT_TTL_DAYS = Math.round(RECENT_TTL_MS / (24 * 60 * 60 * 1000));

export interface TemplateGalleryProps {
  apiBase: string;
  queryKey: string;
  editPath: string;
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  onDeleteTemplate?: (template: TemplateSummary) => void;
  canDeleteTemplate?: (template: TemplateSummary) => boolean;
  deletingTemplateId?: string | null;
  showEdit?: boolean;
  showFavorites?: boolean;
  showRecentlyUsed?: boolean;
  /** Override default behaviour (open full editor). */
  onOpenTemplate?: (templateId: string) => void;
  /** Optional action rendered on each card (e.g. New Invoice). */
  renderCardAction?: (templateId: string, templateName: string) => React.ReactNode;
}

export function TemplateGallery({
  apiBase,
  queryKey,
  editPath,
  title = 'Template Gallery',
  subtitle = 'Choose a template — every layout is a real editable document, not a screenshot.',
  headerActions,
  onDeleteTemplate,
  canDeleteTemplate,
  deletingTemplateId = null,
  showEdit = true,
  showFavorites = true,
  showRecentlyUsed = true,
  onOpenTemplate,
  renderCardAction,
}: TemplateGalleryProps) {
  const navigate = useNavigate();

  const {
    search,
    setSearch,
    category,
    setCategory,
    favoritesOnly,
    setFavoritesOnly,
    favorites,
    isFavorite,
    templates,
    categories,
    recentTemplates,
    handleToggleFavorite,
    handleRemoveRecent,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useTemplateGallery({ apiBase, queryKey });

  const categoryOptions = getTemplateCategoryOptions(categories);

  const handleOpen = useCallback(
    (templateId: string) => {
      if (onOpenTemplate) {
        onOpenTemplate(templateId);
        return;
      }
      openTemplateInEditor({ templateId, editPath, navigate });
    },
    [editPath, navigate, onOpenTemplate]
  );

  const onToggleFavorite = (id: string) => {
    handleToggleFavorite(id);
  };

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">{subtitle}</p>
        </div>
        {headerActions}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full max-w-md">
          <TemplateSearch value={search} onChange={setSearch} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showFavorites && (
            <button
              type="button"
              onClick={() => setFavoritesOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                favoritesOnly
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${favoritesOnly ? 'fill-red-500 text-red-500' : ''}`} />
              Favourites{favorites.length > 0 ? ` (${favorites.length})` : ''}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {categoryOptions.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              category === cat
                ? 'border-primary bg-primary text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:border-primary/40'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {showRecentlyUsed && recentTemplates.length > 0 && category === TEMPLATE_CATEGORY_ALL && !search && !favoritesOnly && (
        <section>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Recently used
            </h2>
            <p className="text-[10px] text-gray-400">
              Auto-removed after {RECENT_TTL_DAYS} days
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recentTemplates.map((t) => (
              <TemplateCardCompact
                key={t._id}
                template={t}
                onOpen={handleOpen}
                onRemove={handleRemoveRecent}
              />
            ))}
          </div>
        </section>
      )}

      {templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-16 text-center">
          <p className="text-gray-600">No templates match your filters.</p>
          <Button
            variant="ghost"
            className="mt-2"
            onClick={() => {
              setSearch('');
              setCategory(TEMPLATE_CATEGORY_ALL);
              setFavoritesOnly(false);
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
          {templates.map((template) => (
            <TemplateCard
              key={template._id}
              template={template}
              apiBase={apiBase}
              onOpen={handleOpen}
              cardAction={renderCardAction?.(template._id, template.name)}
              onToggleFavorite={showFavorites ? onToggleFavorite : undefined}
              favorite={isFavorite(template._id)}
              onDelete={onDeleteTemplate}
              canDelete={canDeleteTemplate}
              showEdit={showEdit}
              isDeleting={deletingTemplateId === template._id}
            />
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading…
              </>
            ) : (
              'Load more templates'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
