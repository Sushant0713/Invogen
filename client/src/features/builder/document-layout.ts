/**
 * Preview layout for live preview / composer: grow tables, push rows below, paginate.
 * Same engine as the template builder (`layoutBuilderPages`).
 */
export {
  layoutDocumentPages,
  layoutBuilderPages,
  layoutDocumentPagesForBuilder,
  prepareDocumentLayoutPages,
  reflowPagesForPreview,
  preparePreviewPages,
  fitPreviewCardLayout,
  reflowTablesOnlyForPreview,
  reflowTablesOnlyForBuilder,
  applyPreviewPageNumbers,
  measurePreviewPageContentHeight,
  normalizeBuilderPagesForEditor,
  applyContinuationTableStructuralEdit,
  absorbPaginationAfterPageDelete,
  isPinnedPreviewElement,
  pageNeedsReflow,
  previewPagesNeedReflow,
  builderPagesNeedLayout,
  touchLogicalFlowY,
  type DocumentLayoutOptions,
  type PreviewReflowOptions,
} from './preview-page-reflow';

export {
  getFlowContentBottomLimit,
  isDocumentFooterElement,
  normalizeDocumentFooters,
  syncSharedFooterAcrossPages,
} from './document-footer';
