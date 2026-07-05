import { ComponentType } from '@invogen/shared';
import { formatAddressValue, parseAddressFromProps } from './address-content';
import { parseTermsFromProps } from './terms-content';

const LINE_HEIGHT = 1.45;
const PADDING = 16;
const MIN_HEIGHT = 40;

function fontSizeFromProps(props: Record<string, unknown>, type: string): number {
  if (typeof props.fontSize === 'number' && props.fontSize > 0) return props.fontSize;
  return type === ComponentType.HEADING ? 24 : 14;
}

/** Rough wrapped line count for a fixed container width. */
function estimateWrappedLineCount(text: string, fontSize: number, width: number): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  const avgCharWidth = fontSize * 0.52;
  const charsPerLine = Math.max(8, Math.floor(width / avgCharWidth));
  let lines = 0;

  for (const paragraph of trimmed.split('\n')) {
    const len = paragraph.trim().length;
    if (!len) continue;
    lines += Math.ceil(len / charsPerLine);
  }

  return Math.max(1, lines);
}

export function estimateStructuredBlockHeight(
  type: string,
  props: Record<string, unknown>,
  width = 280,
  minHeight = MIN_HEIGHT
): number {
  const fontSize = fontSizeFromProps(props, type);
  const linePx = fontSize * LINE_HEIGHT;
  const safeWidth = Math.max(120, width);

  if (type === ComponentType.ADDRESS) {
    const data = parseAddressFromProps(props);
    let lineCount = 0;
    if (data.title.trim()) {
      lineCount += estimateWrappedLineCount(data.title, fontSize, safeWidth);
    }
    const body = formatAddressValue(data);
    for (const part of body.split('\n')) {
      lineCount += estimateWrappedLineCount(part, fontSize, safeWidth);
    }
    return Math.max(minHeight, Math.ceil(lineCount * linePx + PADDING));
  }

  if (type === ComponentType.TERMS) {
    const { title, items } = parseTermsFromProps(props);
    let lineCount = 0;
    if (title.trim()) {
      lineCount += estimateWrappedLineCount(title, fontSize, safeWidth);
      lineCount += 0.35; // title margin
    }
    for (const item of items) {
      if (!item.trim()) continue;
      lineCount += estimateWrappedLineCount(item, fontSize, safeWidth - 28); // numbered column
      lineCount += 0.2; // item gap
    }
    return Math.max(minHeight, Math.ceil(lineCount * linePx + PADDING));
  }

  return minHeight;
}

export function isStructuredContentType(type: string): boolean {
  return type === ComponentType.ADDRESS || type === ComponentType.TERMS;
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
      props.fontSize,
      props.fontFamily,
    ].join('\0');
  }

  if (type === ComponentType.TERMS) {
    const { title, items } = parseTermsFromProps(props);
    return [title, ...items, props.fontSize, props.fontFamily].join('\0');
  }

  return '';
}
