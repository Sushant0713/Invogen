import { ComponentType } from '@invogen/shared';
import { formatAddressValue, parseAddressFromProps } from './address-content';
import { parseTermsFromProps } from './terms-content';
import { countWrappedLines, type MeasureFont } from './text-measure';
import {
  ensureGoogleFontLoaded,
  formatFontFamilyCss,
  getFontCategory,
  getGoogleFontsSync,
  parseFontFamilyName,
} from './google-fonts';

const LINE_HEIGHT = 1.45;
const PADDING = 16;
const MIN_HEIGHT = 40;

function fontSizeFromProps(props: Record<string, unknown>, type: string): number {
  let max = typeof props.fontSize === 'number' && props.fontSize > 0 ? props.fontSize : 0;
  const runs = props.textRuns;
  if (Array.isArray(runs)) {
    for (const run of runs) {
      if (!run || typeof run !== 'object') continue;
      const size = (run as { fontSize?: unknown }).fontSize;
      if (typeof size === 'number' && size > max) max = size;
    }
  }
  if (max > 0) return max;
  return type === ComponentType.HEADING ? 24 : 14;
}

/** Real font for measurement — mirrors getTextElementStyle's font resolution. */
export function measureFontFromProps(
  props: Record<string, unknown>,
  type: string
): MeasureFont {
  const familyName = parseFontFamilyName(props.fontFamily as string | undefined);
  ensureGoogleFontLoaded(familyName);
  const category = getFontCategory(familyName, getGoogleFontsSync());
  return {
    fontFamily: formatFontFamilyCss(familyName, category),
    fontSize: fontSizeFromProps(props, type),
    fontWeight: (props.fontWeight as number) || 400,
    italic: props.italic === true,
    letterSpacingPx:
      typeof props.letterSpacing === 'number' ? props.letterSpacing : undefined,
  };
}

/**
 * Wrapped line count for a fixed container width, measured with the element's
 * real font (canvas measureText greedy breaker). `font` should come from
 * measureFontFromProps; when omitted, a generic font at `fontSize` is used.
 */
export function estimateWrappedLineCount(
  text: string,
  fontSize: number,
  width: number,
  font?: MeasureFont
): number {
  if (!text) return 0;
  return countWrappedLines(text, font ?? { fontSize }, width);
}

/** Matches StructuredContentSizer's HEIGHT_PAD — builder-measured heights carry it. */
const SIZER_PAD = 2;
/** Matches OUTLINE_NUMBER_COLUMN ('3.5em') in TermsDisplay's numbered grid. */
const TERMS_NUMBER_COLUMN_EM = 3.5;

/**
 * Mirror TermsDisplay / AddressDisplay geometry EXACTLY — margins are em of
 * fontSize, list gutter is 3.5em, and neither component has vertical padding.
 * (The old model used line-height fractions, a 28px gutter, and +16 padding,
 * which over-estimated by roughly one line and desynced preview from builder.)
 */
export function estimateStructuredBlockHeight(
  type: string,
  props: Record<string, unknown>,
  width = 280,
  minHeight = MIN_HEIGHT
): number {
  const font = measureFontFromProps(props, type);
  const fontSize = font.fontSize;
  const linePx = fontSize * LINE_HEIGHT;
  const safeWidth = Math.max(120, width);
  const titleFont = { ...font, fontWeight: Math.max(font.fontWeight ?? 400, 600) };

  if (type === ComponentType.ADDRESS) {
    const data = parseAddressFromProps(props);
    const body = formatAddressValue(data);
    const hasBody = body.trim().length > 0;
    const showLogo = props.addressHeaderMode === 'logo';
    let height = 0;
    if (data.title.trim() && !showLogo) {
      height += estimateWrappedLineCount(data.title, fontSize, safeWidth, titleFont) * linePx;
      if (hasBody) height += 0.35 * fontSize; // title marginBottom
    }
    if (hasBody) {
      const iconSize = showLogo ? Math.round(fontSize * 1.35) : 0;
      const iconGap = showLogo ? Math.max(4, Math.round(fontSize * 0.4)) : 0;
      const bodyWidth = Math.max(40, safeWidth - iconSize - iconGap);
      const bodyLines = estimateWrappedLineCount(body, fontSize, bodyWidth, font);
      height += Math.max(bodyLines * linePx, iconSize);
    }
    return Math.max(minHeight, Math.ceil(height + SIZER_PAD));
  }

  if (type === ComponentType.TERMS) {
    const { title, items } = parseTermsFromProps(props);
    let height = 0;
    if (title.trim()) {
      height += estimateWrappedLineCount(title, fontSize, safeWidth, titleFont) * linePx;
      height += 0.45 * fontSize; // title marginBottom
    }
    const itemWidth = Math.max(40, safeWidth - TERMS_NUMBER_COLUMN_EM * fontSize);
    for (const item of items) {
      if (!item.trim()) continue;
      const lines = estimateWrappedLineCount(item, fontSize, itemWidth, font);
      height += Math.max(lines * linePx, 1.45 * fontSize); // li minHeight 1.45em
      height += 0.2 * fontSize; // li marginBottom
    }
    return Math.max(minHeight, Math.ceil(height + SIZER_PAD));
  }

  return minHeight;
}

function lineHeightPx(props: Record<string, unknown>, fontSize: number): number {
  const raw = props.lineHeight;
  if (typeof raw === 'number' && raw > 4) return raw;
  if (typeof raw === 'number') return fontSize * raw;
  return fontSize * LINE_HEIGHT;
}

function resolveTextBlockContent(props: Record<string, unknown>): string {
  if (typeof props.content === 'string') return props.content;
  if (typeof props.text === 'string') return props.text;
  if (typeof props.value === 'string') return props.value;
  return '';
}

/** Estimate height for text-like canvas blocks (TEXT, HEADING, NOTES, FOOTER, etc.). */
export function estimateTextBlockHeight(
  type: string,
  props: Record<string, unknown>,
  width: number,
  minHeight = MIN_HEIGHT
): number {
  const font = measureFontFromProps(props, type);
  const linePx = lineHeightPx(props, font.fontSize);
  // paddingLeft / textIndent shrink the wrappable text width, not the height.
  const insets =
    (typeof props.paddingLeft === 'number' ? props.paddingLeft : 0)
    + (typeof props.textIndent === 'number' ? props.textIndent : 0);
  const safeWidth = Math.max(40, Math.max(80, width) - insets);
  const content = resolveTextBlockContent(props);
  const lineCount = estimateWrappedLineCount(content, font.fontSize, safeWidth, font);
  if (lineCount === 0) return minHeight;
  return Math.max(minHeight, Math.ceil(lineCount * linePx + PADDING));
}

export function isStructuredContentType(type: string): boolean {
  return type === ComponentType.ADDRESS || type === ComponentType.TERMS;
}

/** Free-text blocks that should grow in height as content wraps/wraps more lines. */
export function isAutoHeightTextType(type: string): boolean {
  return (
    type === ComponentType.TEXT
    || type === ComponentType.HEADING
    || type === ComponentType.NOTES
    || type === ComponentType.FOOTER
  );
}

export function structuredMeasureKey(type: string, props: Record<string, unknown>): string {
  if (type === ComponentType.ADDRESS) {
    const data = parseAddressFromProps(props);
    return [
      data.title,
      ...data.lines,
      data.city,
      data.state,
      data.postalCode,
      data.country,
      props.addressHeaderMode,
      Array.isArray(props.hiddenFields) ? props.hiddenFields.join(',') : '',
      props.fontSize,
      props.fontFamily,
    ].join('\0');
  }

  if (type === ComponentType.TERMS) {
    const { title, items } = parseTermsFromProps(props);
    return [title, ...items, props.fontSize, props.fontFamily].join('\0');
  }

  if (isAutoHeightTextType(type)) {
    const runs = Array.isArray(props.textRuns) ? JSON.stringify(props.textRuns) : '';
    return [
      resolveTextBlockContent(props),
      runs,
      props.fontSize,
      props.fontFamily,
      props.lineHeight,
      props.listStyle,
      props.paddingLeft,
      props.textIndent,
    ].join('\0');
  }

  return '';
}
