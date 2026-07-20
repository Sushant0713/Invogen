/** Caption lines under a company signature image (authorized-signature block). */

export const DEFAULT_SIGNATURE_TITLE = 'Authorized signature';
export const DEFAULT_SIGNATURE_NAME = '<Authorized name>';

export type SignatureCaption = {
  /** When false, image-only (legacy signatures without caption props). */
  enabled: boolean;
  title: string;
  name: string;
};

export function parseSignatureCaption(props: Record<string, unknown>): SignatureCaption {
  if (props.showSignatureCaption === false) {
    return { enabled: false, title: '', name: '' };
  }

  const hasExplicit =
    props.showSignatureCaption === true
    || typeof props.signatureTitle === 'string'
    || typeof props.signatureName === 'string';

  if (!hasExplicit) {
    return { enabled: false, title: '', name: '' };
  }

  const title =
    typeof props.signatureTitle === 'string'
      ? props.signatureTitle
      : DEFAULT_SIGNATURE_TITLE;
  const name =
    typeof props.signatureName === 'string'
      ? props.signatureName
      : DEFAULT_SIGNATURE_NAME;

  return {
    enabled: true,
    title,
    name,
  };
}

/** Space reserved under the signature image for caption lines. */
export function estimateSignatureCaptionHeight(props: Record<string, unknown>): number {
  const caption = parseSignatureCaption(props);
  if (!caption.enabled) return 0;
  const fontSize =
    typeof props.fontSize === 'number' && props.fontSize > 0 ? props.fontSize : 12;
  const lines = [caption.title, caption.name].filter((line) => line.trim()).length;
  if (lines === 0) return 0;
  // Top gap + line stack + bottom padding so caption never sits under the image.
  return Math.ceil(8 + lines * fontSize * 1.5 + 8);
}

export function getSignatureCaptionDefaultProps(): Record<string, unknown> {
  return {
    showSignatureCaption: true,
    signatureTitle: DEFAULT_SIGNATURE_TITLE,
    signatureName: DEFAULT_SIGNATURE_NAME,
    fontSize: 12,
    fontWeight: 400,
    color: '#000000',
    textAlign: 'center',
  };
}
