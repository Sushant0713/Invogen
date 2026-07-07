export { TemplateGallery } from './TemplateGallery';
export { TemplateCard, TemplateCardCompact } from './TemplateCard';
export { TemplatePreviewRenderer } from './TemplatePreviewRenderer';
/** Alias — gallery preview uses the same JSON renderer as the editor. */
export { TemplatePreviewRenderer as TemplateRenderer } from './TemplatePreviewRenderer';
export { TemplateSearch } from './TemplateSearch';
export { useTemplateGallery } from './use-template-gallery';
export {
  fetchTemplateDocument,
  getCachedTemplate,
  primeTemplateCache,
  invalidateTemplateCache,
  publishSavedTemplateDocument,
} from './template-loader';
export {
  getFavoriteTemplateIds,
  isTemplateFavorite,
  toggleTemplateFavorite,
  getRecentTemplateIds,
  getRecentEntries,
  recordTemplateUse,
  removeRecentTemplate,
  RECENT_TTL_MS,
} from './template-manager';
export {
  openTemplateInEditor,
  createDocumentFromTemplate,
} from './document-creator';
export {
  applyPlaceholdersToPages,
  replacePlaceholdersInString,
  SAMPLE_PREVIEW_CONTEXT,
  type PlaceholderContext,
  type PlaceholderKey,
} from './placeholder-utils';
export {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_ALL,
  defaultTemplateName,
  getTemplateCategoryOptions,
} from './template-categories';
