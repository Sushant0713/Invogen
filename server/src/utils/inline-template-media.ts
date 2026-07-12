import type { CanvasElement, TemplatePage } from '@invogen/shared';
import { ComponentType } from '@invogen/shared';
import { mediaService } from '../services/media.service';

const MEDIA_ID_RE = /(?:\/api\/v1)?\/uploads\/([a-f\d]{24})(?:\?|$)/i;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const PLACEHOLDER_SRC_RE = /^\{\{[\w.]+\}\}$/;

const IMAGE_TYPES = new Set<string>([
  ComponentType.LOGO,
  ComponentType.IMAGE,
  ComponentType.SIGNATURE,
  ComponentType.STAMP,
]);

function extractMediaId(src: string): string | null {
  const trimmed = src.trim();
  if (!trimmed) return null;
  const fromPath = trimmed.match(MEDIA_ID_RE);
  if (fromPath?.[1]) return fromPath[1];
  if (OBJECT_ID_RE.test(trimmed)) return trimmed;
  return null;
}

async function mediaToDataUri(id: string): Promise<string | undefined> {
  try {
    const media = await mediaService.getFile(id);
    const buffer = Buffer.isBuffer(media.data) ? media.data : Buffer.from(media.data);
    if (!buffer.length) return undefined;
    const mime = media.mimetype || 'image/png';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return undefined;
  }
}

async function resolveSrcToDataUri(
  src: string | undefined,
  cache: Map<string, string | undefined>
): Promise<string | undefined> {
  if (!src?.trim()) return undefined;
  const trimmed = src.trim();
  if (trimmed.startsWith('data:')) return trimmed;
  if (PLACEHOLDER_SRC_RE.test(trimmed)) return undefined;

  const mediaId = extractMediaId(trimmed);
  if (!mediaId) {
    // External URL — keep as-is; HTML renderer hides on error.
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return undefined;
  }

  if (cache.has(mediaId)) return cache.get(mediaId);
  const dataUri = await mediaToDataUri(mediaId);
  cache.set(mediaId, dataUri);
  return dataUri;
}

function withInlinedSrc(element: CanvasElement, src: string | undefined): CanvasElement {
  if (!src) {
    return {
      ...element,
      props: { ...(element.props ?? {}), src: '' },
      visible: false,
    };
  }
  return {
    ...element,
    props: { ...(element.props ?? {}), src },
  };
}

/**
 * Replace upload URLs with data URIs so Puppeteer PDF does not depend on HTTP
 * fetches (broken images leave large empty boxes that destroy invoice layout).
 */
export async function inlineTemplateMediaForPdf(
  pages: TemplatePage[],
  branding: { logo?: string; signature?: string }
): Promise<{
  pages: TemplatePage[];
  branding: { logo?: string; signature?: string };
}> {
  const cache = new Map<string, string | undefined>();

  const nextBranding = {
    logo: await resolveSrcToDataUri(branding.logo, cache),
    signature: await resolveSrcToDataUri(branding.signature, cache),
  };

  const nextPages: TemplatePage[] = [];
  for (const page of pages) {
    const elements: CanvasElement[] = [];
    for (const element of page.elements) {
      if (element.visible === false || !IMAGE_TYPES.has(element.type)) {
        elements.push(element);
        continue;
      }

      const props = (element.props ?? {}) as Record<string, unknown>;
      let src = typeof props.src === 'string' ? props.src : '';

      if (
        (element.type === ComponentType.LOGO || element.type === ComponentType.SIGNATURE)
        && (!src.trim() || PLACEHOLDER_SRC_RE.test(src.trim()))
      ) {
        src =
          element.type === ComponentType.LOGO
            ? nextBranding.logo || ''
            : nextBranding.signature || '';
        elements.push(withInlinedSrc(element, src || undefined));
        continue;
      }

      const inlined = await resolveSrcToDataUri(src, cache);
      elements.push(withInlinedSrc(element, inlined));
    }
    nextPages.push({ ...page, elements });
  }

  return { pages: nextPages, branding: nextBranding };
}
