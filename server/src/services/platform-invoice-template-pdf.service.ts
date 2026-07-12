import type { TemplatePage } from '@invogen/shared';
import puppeteer from 'puppeteer';
import { env } from '../config/env';
import { InvoiceTemplate, Setting } from '../models';
import {
  applyInvoiceContextToPages,
  buildSubscriptionInvoicePlaceholderContext,
  buildSubscriptionInvoiceTableLine,
  cloneTemplatePages,
  type PlatformInvoiceSettingsValue,
} from '../utils/platform-invoice-template-fill';
import { fitFilledCardsForPdf } from '../utils/fit-filled-cards-for-pdf';
import { inlineTemplateMediaForPdf } from '../utils/inline-template-media';
import { createPlatformInvoiceRenderToken } from '../utils/platform-invoice-render-store';
import { renderTemplatePagesToHtml } from '../utils/template-pages-to-html';
import { resolvePuppeteerExecutablePath } from '../utils/resolve-puppeteer-executable';

export interface BuildTemplatePdfInput {
  settings: PlatformInvoiceSettingsValue;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  buyer: {
    name: string;
    email?: string;
    phone?: string;
    gst?: string;
    pan?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      zipCode?: string;
    };
  };
  planName: string;
  billingCycle: string;
  currency: string;
  subtotal: number;
  discount: number;
  discountCode?: string;
  cgst: number;
  sgst: number;
  tax: number;
  total: number;
}

async function loadCompanyBranding(): Promise<{ logo?: string; signature?: string }> {
  const row = await Setting.findOne({ key: 'company_profile', scope: 'system' });
  const value = (row?.value || {}) as { logo?: string; signature?: string };
  return {
    logo: typeof value.logo === 'string' ? value.logo : undefined,
    signature: typeof value.signature === 'string' ? value.signature : undefined,
  };
}

async function renderFilledPages(input: BuildTemplatePdfInput): Promise<TemplatePage[] | null> {
  const templateId = input.settings.platformTemplateId?.trim();
  if (!templateId) return null;

  const template = await InvoiceTemplate.findOne({ _id: templateId, isSystem: true });
  if (!template?.pages?.length) return null;

  const context = buildSubscriptionInvoicePlaceholderContext(input);
  const lineItem = buildSubscriptionInvoiceTableLine(input);
  // Keep authored positions; React print page runs fitPreviewCardLayout (same as Super Admin preview).
  return applyInvoiceContextToPages(cloneTemplatePages(template.pages), context, lineItem);
}

function serverAssetBase(): string {
  const port = env.PORT || '5000';
  return `http://127.0.0.1:${port}`;
}

function clientPrintBase(): string {
  return (env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
}

async function launchBrowser() {
  const executablePath = resolvePuppeteerExecutablePath();
  if (!executablePath) {
    console.warn(
      '[platform-invoice] No system Chrome/Edge found; trying Puppeteer bundled browser (run: npx puppeteer browsers install chrome)'
    );
  }
  return puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

/** Preferred path: same React preview stack as Super Admin live preview. */
async function pdfFromReactPrintPage(
  pages: TemplatePage[],
  branding: { logo?: string; signature?: string },
  invoiceNumber: string
): Promise<Buffer> {
  const token = createPlatformInvoiceRenderToken({
    pages,
    branding,
    invoiceNumber,
  });
  const url = `${clientPrintBase()}/platform-invoice/print/${token}`;
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1280, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 90_000 });
    await page.waitForSelector('[data-platform-invoice-pdf-ready="true"]', { timeout: 60_000 });

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/** Fallback: server-side HTML (inlined images) when the Vite/client app is unreachable. */
async function pdfFromServerHtml(
  pages: TemplatePage[],
  branding: { logo?: string; signature?: string }
): Promise<Buffer> {
  const fitted = fitFilledCardsForPdf(pages);
  const inlined = await inlineTemplateMediaForPdf(fitted, branding);
  const html = renderTemplatePagesToHtml(inlined.pages, inlined.branding, {
    assetBase: serverAssetBase(),
  });

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load', timeout: 90_000 });
    await page.waitForSelector('[data-platform-invoice-pdf-ready="true"]', { timeout: 60_000 });

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function buildPlatformInvoiceTemplatePdf(
  input: BuildTemplatePdfInput
): Promise<Buffer | null> {
  const pages = await renderFilledPages(input);
  if (!pages?.length) return null;

  const branding = await loadCompanyBranding();

  try {
    return await pdfFromReactPrintPage(pages, branding, input.invoiceNumber);
  } catch (reactError) {
    console.warn(
      '[platform-invoice] React print PDF failed, falling back to server HTML:',
      reactError
    );
    try {
      return await pdfFromServerHtml(pages, branding);
    } catch (error) {
      console.error('[platform-invoice] Template PDF render failed:', error);
      throw error;
    }
  }
}

export async function buildPlatformInvoiceTemplateSnapshot(
  input: BuildTemplatePdfInput
): Promise<TemplatePage[] | null> {
  const pages = await renderFilledPages(input);
  if (!pages?.length) return null;
  return fitFilledCardsForPdf(pages);
}
