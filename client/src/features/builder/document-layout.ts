/**
 * Document-style automatic page layout (Word / Google Docs / Canva Docs).
 *
 * Components are stored in document order; Y positions are computed dynamically
 * from cumulative heights. Tables paginate at row boundaries; other components
 * spill whole to the next page when they do not fit.
 */
export {
  layoutDocumentPages,
  layoutBuilderPages,
  layoutDocumentPagesForBuilder,
  prepareDocumentLayoutPages,
  reflowPagesForPreview,
  preparePreviewPages,
  reflowTablesOnlyForPreview,
  reflowTablesOnlyForBuilder,
  applyPreviewPageNumbers,
  measurePreviewPageContentHeight,
  isPinnedPreviewElement,
  pageNeedsReflow,
  previewPagesNeedReflow,
  builderPagesNeedLayout,
  touchLogicalFlowY,
  type DocumentLayoutOptions,
  type PreviewReflowOptions,
} from './preview-page-reflow';
