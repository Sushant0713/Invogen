import type { MutableRefObject } from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { PageDimensions } from './builder-dnd';

export interface TemplatePdfPageInput {
  element: HTMLElement;
  size: PageDimensions;
}

export interface TemplatePdfExportOptions {
  /**
   * Raster scale for page capture. Higher = sharper text when zooming the PDF.
   * 2.5–3 ≈ print-quality for A4; keep ≤3 to limit file size/memory.
   */
  pixelRatio?: number;
}

const imageDataUrlCache = new Map<string, string>();

/** Default capture scale — sharp enough for zoom without huge PDFs. */
const DEFAULT_PDF_PIXEL_RATIO = 2.75;

function sanitizeFilename(name: string): string {
  const cleaned = name.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
  return cleaned || 'template-preview';
}

export function templatePdfFilename(templateName: string): string {
  return `${sanitizeFilename(templateName)}.pdf`;
}

/** Use the rendered preview node size (supports reflowed / taller pages). */
export function readRenderedPageSize(element: HTMLElement): PageDimensions {
  return {
    width: Math.max(1, Math.round(element.offsetWidth)),
    height: Math.max(1, Math.round(element.offsetHeight)),
  };
}

function waitForPaint(frames = 2): Promise<void> {
  return new Promise((resolve) => {
    let remaining = frames;
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  if (images.length === 0) return;

  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        })
    )
  );
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetch every <img> src and swap it for an inline data URL so rasterization
 * never depends on cross-origin fetches (logos/signatures live on the API origin).
 */
async function inlineImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.getAttribute('src') || '';
      if (!src || src.startsWith('data:')) return;

      const cached = imageDataUrlCache.get(src);
      if (cached) {
        img.setAttribute('src', cached);
        img.removeAttribute('srcset');
        return;
      }

      try {
        const response = await fetch(src, { credentials: 'include' }).catch(() => null);
        if (!response?.ok) return;
        const dataUrl = await blobToDataUrl(await response.blob());
        imageDataUrlCache.set(src, dataUrl);
        img.setAttribute('src', dataUrl);
        img.removeAttribute('srcset');
      } catch {
        // Leave the original src; html-to-image will make a best effort.
      }
    })
  );
}

async function waitForFonts(): Promise<void> {
  try {
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await document.fonts.ready;
    }
  } catch {
    // Ignore — capture still proceeds with available fonts.
  }
}

async function capturePagePng(
  element: HTMLElement,
  pixelRatio: number
): Promise<string> {
  await waitForFonts();
  await inlineImages(element);
  await waitForImages(element);
  // Embed web fonts in the clone so large text blocks stay crisp when rasterized.
  return toPng(element, {
    cacheBust: false,
    pixelRatio,
    backgroundColor: '#ffffff',
    skipFonts: false,
    preferredFontFormat: 'woff2',
  });
}

/**
 * Wait until off-screen export page nodes are mounted and laid out.
 * Replaces fixed 300–600ms delays with paint-based readiness checks.
 */
export async function waitForExportNodes(
  refs: MutableRefObject<(HTMLDivElement | null)[]>,
  expectedCount: number,
  timeoutMs = 2000
): Promise<HTMLDivElement[]> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const nodes = refs.current.filter((node): node is HTMLDivElement => node != null);
    const ready =
      nodes.length >= expectedCount
      && nodes.every((node) => node.offsetWidth > 0 && node.offsetHeight > 0);

    if (ready) {
      await waitForPaint(2);
      return nodes;
    }
    await waitForPaint(1);
  }

  const nodes = refs.current.filter((node): node is HTMLDivElement => node != null);
  if (nodes.length === 0) throw new Error('Preview not ready');
  return nodes;
}

export function buildExportPageInputs(nodes: HTMLDivElement[]): TemplatePdfPageInput[] {
  return nodes.map((element) => ({
    element,
    size: readRenderedPageSize(element),
  }));
}

export async function exportTemplatePagesToPdf(
  pages: TemplatePdfPageInput[],
  options: TemplatePdfExportOptions = {}
): Promise<Blob> {
  if (pages.length === 0) {
    throw new Error('No pages to export');
  }

  const pixelRatio = Math.min(3, Math.max(1, options.pixelRatio ?? DEFAULT_PDF_PIXEL_RATIO));

  const captures = await Promise.all(
    pages.map(async ({ element, size }) => ({
      dataUrl: await capturePagePng(element, pixelRatio),
      size,
    }))
  );

  const first = captures[0].size;
  const pdf = new jsPDF({
    orientation: first.width > first.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [first.width, first.height],
    hotfixes: ['px_scaling'],
  });

  captures.forEach(({ dataUrl, size }, index) => {
    if (index > 0) {
      pdf.addPage(
        [size.width, size.height],
        size.width > size.height ? 'landscape' : 'portrait'
      );
    }
    // MEDIUM keeps text edges cleaner than FAST when zooming the PDF.
    pdf.addImage(dataUrl, 'PNG', 0, 0, size.width, size.height, undefined, 'MEDIUM');
  });

  return pdf.output('blob');
}

export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

type PdfExportCache = {
  key: string;
  blob: Blob;
};

type InflightPdfExport = {
  key: string;
  promise: Promise<Blob>;
};

/**
 * Deduplicate concurrent exports and reuse the last blob when page content is unchanged.
 */
export function createPdfExportRunner(getKey: () => string) {
  let cache: PdfExportCache | null = null;
  let inflight: InflightPdfExport | null = null;

  return async function runExport(exportFn: () => Promise<Blob>): Promise<Blob> {
    const key = getKey();
    if (cache?.key === key) return cache.blob;
    if (inflight?.key === key) return inflight.promise;

    const promise = exportFn()
      .then((blob) => {
        cache = { key, blob };
        return blob;
      })
      .finally(() => {
        if (inflight?.promise === promise) inflight = null;
      });

    inflight = { key, promise };
    return promise;
  };
}

export function pagesExportSignature(
  pages: { id: string; elements: unknown[]; height?: number }[]
): string {
  return pages
    .map((page) => `${page.id}:${page.elements.length}:${page.height ?? 0}`)
    .join('|');
}
