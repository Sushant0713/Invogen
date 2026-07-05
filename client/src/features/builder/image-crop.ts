/**
 * Legacy re-exports — prefer `image-editor/cropUtils` for new code.
 */
export {
  DEFAULT_IMAGE_CROP,
  UPLOAD_IMAGE_PROPS,
  getCoverBaseSize,
  getFitBaseSize,
  getImageCropFromProps,
  normalizeImageCropTransform,
  cropTransformToProps,
  migrateLegacyCropProps,
  defaultCropForFrame,
  realignCropForFit,
  getImageUploadPatch,
  isDefaultImageCrop,
  type ImageCropTransform,
  type ImageFitMode,
} from './image-editor/cropUtils';

import { getImageCropFromProps } from './image-editor/cropUtils';

export type { ImageCropTransform as ImageCrop } from './image-editor/types';

/** @deprecated Use getImageCropFromProps */
export function normalizeImageCrop(props: Record<string, unknown>) {
  return getImageCropFromProps(props, 100, 100);
}

/** No-op — crop is non-destructive; metadata is preserved in imageCrop. */
export function bakeImageElementProps(element: {
  width: number;
  height: number;
  props?: Record<string, unknown>;
}) {
  return element.props ?? {};
}
