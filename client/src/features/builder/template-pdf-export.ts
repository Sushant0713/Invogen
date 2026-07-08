import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { PageDimensions } from './builder-dnd';

export interface TemplatePdfPageInput {
  element: HTMLElement;
  size: PageDimensions;
}

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

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
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
      try {
        let response = await fetch(src).catch(() => null);
        if (!response || !response.ok) {
          // Retry sending cookies in case the upload endpoint requires auth.
          response = await fetch(src, { credentials: 'include' }).catch(() => null);
        }
        if (!response || !response.ok) return;
        const dataUrl = await blobToDataUrl(await response.blob());
        img.setAttribute('src', dataUrl);
        img.removeAttribute('srcset');
      } catch {
        // Leave the original src; html-to-image will make a best effort.
      }
    })
  );
}

export async function exportTemplatePagesToPdf(
  pages: TemplatePdfPageInput[]
): Promise<Blob> {
  if (pages.length === 0) {
    throw new Error('No pages to export');
  }

  const first = pages[0].size;
  const pdf = new jsPDF({
    orientation: first.width > first.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [first.width, first.height],
    hotfixes: ['px_scaling'],
  });

  for (let index = 0; index < pages.length; index += 1) {
    const { element, size } = pages[index];

    if (index > 0) {
      pdf.addPage(
        [size.width, size.height],
        size.width > size.height ? 'landscape' : 'portrait'
      );
    }

    await inlineImages(element);
    await waitForImages(element);

    const dataUrl = await toPng(element, {
      cacheBust: false,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      skipFonts: false,
    });

    pdf.addImage(dataUrl, 'PNG', 0, 0, size.width, size.height, undefined, 'FAST');
  }

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
