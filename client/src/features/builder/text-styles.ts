import type { CSSProperties } from 'react';
import { ComponentType } from '@invogen/shared';
import { formatAddressValue, parseAddressFromProps } from './address-content';
import {
  ensureGoogleFontLoaded,
  formatFontFamilyCss,
  getFontCategory,
  getGoogleFontsSync,
  parseFontFamilyName,
} from './google-fonts';

export const TEXT_STYLE_KEYS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'italic',
  'underline',
  'strikethrough',
  'color',
  'textAlign',
  'textTransform',
  'letterSpacing',
  'listStyle',
  'textShadow',
] as const;

export type ListStyleType =
  | 'none'
  | 'bullet'
  | 'number'
  | 'roman-lower'
  | 'roman-upper'
  | 'outline';

const MAX_OUTLINE_LEVEL = 4;

export const LIST_STYLE_OPTIONS: Array<{
  value: ListStyleType;
  label: string;
  preview: string;
  hint?: string;
}> = [
  { value: 'bullet', label: 'Bullets', preview: '•' },
  { value: 'number', label: 'Numbers', preview: '1.' },
  { value: 'outline', label: 'Outline', preview: '1.1', hint: 'Main = 1,2,3… · Shift+Enter for next section' },
  { value: 'roman-lower', label: 'Roman (i, ii)', preview: 'i.' },
  { value: 'roman-upper', label: 'Roman (I, II)', preview: 'I.' },
  { value: 'none', label: 'None', preview: '—' },
];

export function normalizeListStyle(value: unknown): ListStyleType {
  if (
    value === 'bullet'
    || value === 'number'
    || value === 'roman-lower'
    || value === 'roman-upper'
    || value === 'outline'
    || value === 'none'
  ) {
    return value;
  }
  return 'none';
}

export function getListRenderConfig(listStyle: ListStyleType): {
  tag: 'ul' | 'ol' | 'outline' | null;
  listStyleType: CSSProperties['listStyleType'];
} {
  switch (listStyle) {
    case 'bullet':
      return { tag: 'ul', listStyleType: 'disc' };
    case 'number':
      return { tag: 'ol', listStyleType: 'decimal' };
    case 'roman-lower':
      return { tag: 'ol', listStyleType: 'lower-roman' };
    case 'roman-upper':
      return { tag: 'ol', listStyleType: 'upper-roman' };
    case 'outline':
      return { tag: 'outline', listStyleType: 'none' };
    default:
      return { tag: null, listStyleType: 'none' };
  }
}

export function splitListLines(content: string): string[] {
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 ? lines : [''];
}

export function getLineIndentPrefix(line: string): string {
  let i = 0;
  while (i < line.length) {
    if (line[i] === '\t') {
      i += 1;
    } else if (line.startsWith('  ', i)) {
      i += 2;
    } else {
      break;
    }
  }
  return line.slice(0, i);
}

export function getLineIndentLevel(line: string): { level: number; text: string } {
  const prefix = getLineIndentPrefix(line);
  let level = 0;
  for (let i = 0; i < prefix.length; i += 1) {
    if (prefix[i] === '\t') {
      level += 1;
    } else {
      level += 1;
      i += 1;
    }
  }
  level = Math.min(level, MAX_OUTLINE_LEVEL);
  return { level, text: line.slice(prefix.length).trimEnd() };
}

export type OutlineListItem = { level: number; text: string; number: string };

export type OutlineLine = { level: number; text: string };

/** Fixed left column for outline numbers (Excel-style). */
export const OUTLINE_NUMBER_COLUMN = '3.5em';
export const OUTLINE_LEVEL_INDENT_EM = 1.25;

export function getOutlineTextIndent(level: number): string {
  return `${level * OUTLINE_LEVEL_INDENT_EM}em`;
}

export function serializeOutlineLines(lines: OutlineLine[]): string {
  return lines.map(({ level, text }) => `${'\t'.repeat(level)}${text}`).join('\n');
}

export function buildOutlineNumbers(lines: Array<{ level: number }>): string[] {
  const counters: number[] = [];
  return lines.map(({ level }) => {
    while (counters.length <= level) counters.push(0);
    counters[level] += 1;
    for (let i = level + 1; i < counters.length; i += 1) counters[i] = 0;
    return `${counters.slice(0, level + 1).join('.')}.`;
  });
}

export function parseOutlineLines(content: string): OutlineListItem[] {
  const items: Array<{ level: number; text: string }> = [];
  for (const line of content.split('\n')) {
    const { level, text } = getLineIndentLevel(line);
    // Keep empty lines — they hold level info (tabs) for the editor.
    items.push({ level, text });
  }
  const nonEmpty = items.filter((item) => item.text.length > 0);
  if (nonEmpty.length === 0) {
    return [{ level: 0, text: '', number: '1' }];
  }

  const numbers = buildOutlineNumbers(items);
  return items.map((item, index) => ({
    ...item,
    number: numbers[index].replace(/\.$/, ''),
  }));
}

function getLineBounds(text: string, offset: number) {
  const start = text.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
  const endIdx = text.indexOf('\n', offset);
  const end = endIdx === -1 ? text.length : endIdx;
  return { start, end, line: text.slice(start, end) };
}

export function adjustLineIndent(
  text: string,
  cursorOffset: number,
  direction: 'indent' | 'outdent'
): { text: string; cursorOffset: number } {
  const { start, end, line } = getLineBounds(text, cursorOffset);
  const { level, text: lineText } = getLineIndentLevel(line);
  const nextLevel = direction === 'indent'
    ? Math.min(level + 1, MAX_OUTLINE_LEVEL)
    : Math.max(level - 1, 0);
  const newLine = `${'\t'.repeat(nextLevel)}${lineText}`;
  const newText = text.slice(0, start) + newLine + text.slice(end);
  const delta = newLine.length - line.length;
  return { text: newText, cursorOffset: cursorOffset + delta };
}

export function insertOutlineLineBreak(
  text: string,
  cursorOffset: number
): { text: string; cursorOffset: number } {
  const { start, line } = getLineBounds(text, cursorOffset);
  const prefix = getLineIndentPrefix(line);
  const newText = `${text.slice(0, cursorOffset)}\n${prefix}${text.slice(cursorOffset)}`;
  return { text: newText, cursorOffset: cursorOffset + 1 + prefix.length };
}

export function getEditableTextKey(type: string): 'content' | 'text' | 'label' | null {
  switch (type) {
    case ComponentType.WATERMARK:
      return 'text';
    case ComponentType.INVOICE_NUMBER:
    case ComponentType.DATE:
    case ComponentType.DUE_DATE:
    case ComponentType.GST_NUMBER:
    case ComponentType.PAN_NUMBER:
    case ComponentType.ADDRESS:
    case ComponentType.PAGE_NUMBER:
      return 'label';
    case ComponentType.TEXT:
    case ComponentType.HEADING:
    case ComponentType.TERMS:
    case ComponentType.NOTES:
    case ComponentType.FOOTER:
      return 'content';
    default:
      return null;
  }
}

/** True only for components that support double-click / type-to-edit on the canvas. */
export function isDataFieldType(type: string): boolean {
  return getEditableTextKey(type) === 'label';
}

export function getDataFieldDefaultValue(type: string): string {
  switch (type) {
    case ComponentType.INVOICE_NUMBER:
      return 'INV-001';
    case ComponentType.DATE:
      return new Date().toLocaleDateString();
    case ComponentType.DUE_DATE:
      return '-';
    case ComponentType.GST_NUMBER:
      return '27XXXXXXXXXX1Z1';
    case ComponentType.PAN_NUMBER:
      return 'XXXXX9999X';
    case ComponentType.ADDRESS:
      return formatAddressValue(parseAddressFromProps({}));
    case ComponentType.PAGE_NUMBER:
      return '1';
    default:
      return '';
  }
}

export function getDataFieldValue(
  props: Record<string, unknown>,
  type: string
): string {
  if (type === ComponentType.ADDRESS) {
    return formatAddressValue(parseAddressFromProps(props));
  }
  const raw = props.value;
  if (typeof raw === 'string') return raw;
  return getDataFieldDefaultValue(type);
}

/** Prop key updated when inline-editing on the canvas. */
export function getInlineEditPropKey(type: string): 'content' | 'text' | 'value' | null {
  const key = getEditableTextKey(type);
  if (key === 'label') return 'value';
  if (key === 'content' || key === 'text') return key;
  return null;
}

export function isInlineCanvasEditable(type: string): boolean {
  return getInlineEditPropKey(type) !== null;
}

export function getEditableTextValue(
  props: Record<string, unknown>,
  type: string
): string {
  const key = getEditableTextKey(type);
  if (key === 'label') return (props.label as string) || '';
  if (key === 'text') return (props.text as string) || '';
  if (key === 'content') return (props.content as string) || '';
  return '';
}

export function getDisplayText(
  props: Record<string, unknown>,
  type: string,
  fallback = ''
): string {
  const key = getEditableTextKey(type);
  if (key === 'label') {
    const label = (props.label as string) || 'Label';
    const value = getDataFieldValue(props, type);
    if (type === ComponentType.ADDRESS) return `${label}:\n${value}`;
    return `${label}: ${value}`;
  }
  if (key === 'text') return (props.text as string) || fallback || 'DRAFT';
  if (key === 'content') return (props.content as string) || fallback;
  return fallback;
}

export interface TextRunProps {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  highlight?: string;
  letterSpacing?: number;
  href?: string;
}

export function getTextRuns(props: Record<string, unknown>): TextRunProps[] | null {
  const raw = props.textRuns;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.filter((r) => r && typeof r === 'object' && typeof (r as TextRunProps).text === 'string') as TextRunProps[];
}

export function getRunStyle(run: TextRunProps, fallback: CSSProperties): CSSProperties {
  const familyName = parseFontFamilyName(run.fontFamily);
  if (familyName) ensureGoogleFontLoaded(familyName);
  const category = getFontCategory(familyName, getGoogleFontsSync());
  const decorations: string[] = [];
  if (run.underline) decorations.push('underline');
  if (run.strikethrough) decorations.push('line-through');

  return {
    fontFamily: familyName ? formatFontFamilyCss(familyName, category) : fallback.fontFamily,
    fontSize: run.fontSize ?? fallback.fontSize,
    fontWeight: run.fontWeight ?? fallback.fontWeight,
    fontStyle: run.italic ? 'italic' : 'normal',
    color: run.color ?? fallback.color,
    backgroundColor: run.highlight ? highlightToCss(run.highlight) : undefined,
    letterSpacing:
      typeof run.letterSpacing === 'number' ? `${run.letterSpacing}px` : fallback.letterSpacing,
    textDecoration: decorations.length ? decorations.join(' ') : 'none',
  };
}

function highlightToCss(name: string): string {
  const map: Record<string, string> = {
    yellow: '#ffff00',
    green: '#00ff00',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    blue: '#0000ff',
    red: '#ff0000',
    darkBlue: '#00008b',
    darkCyan: '#008b8b',
    darkGreen: '#006400',
    darkMagenta: '#8b008b',
    darkRed: '#8b0000',
    darkYellow: '#808000',
    darkGray: '#a9a9a9',
    lightGray: '#d3d3d3',
    black: '#000000',
    white: '#ffffff',
  };
  return map[name] ?? name;
}

export function isTextStylable(type: string): boolean {
  return [
    ComponentType.TEXT,
    ComponentType.HEADING,
    ComponentType.TERMS,
    ComponentType.NOTES,
    ComponentType.FOOTER,
    ComponentType.INVOICE_NUMBER,
    ComponentType.DATE,
    ComponentType.DUE_DATE,
    ComponentType.GST_NUMBER,
    ComponentType.PAN_NUMBER,
    ComponentType.ADDRESS,
    ComponentType.PAGE_NUMBER,
    ComponentType.WATERMARK,
    ComponentType.COMPANY_CARD,
    ComponentType.CUSTOMER_CARD,
    ComponentType.PAYMENT_DETAILS,
  ].includes(type as ComponentType);
}

export function getTextElementStyle(
  props: Record<string, unknown>,
  type?: string
): CSSProperties {
  const fontFamilyRaw = props.fontFamily as string | undefined;
  const familyName = parseFontFamilyName(fontFamilyRaw);
  ensureGoogleFontLoaded(familyName);

  const fontSize = (props.fontSize as number) || (type === ComponentType.HEADING ? 24 : 14);
  const fontWeight = (props.fontWeight as number) || 400;
  const decorations: string[] = [];
  if (props.underline) decorations.push('underline');
  if (props.strikethrough) decorations.push('line-through');

  const category = getFontCategory(familyName, getGoogleFontsSync());
  const lineHeightRaw = props.lineHeight;

  return {
    fontFamily: formatFontFamilyCss(familyName, category),
    fontSize,
    fontWeight,
    fontStyle: props.italic ? 'italic' : 'normal',
    color: (props.color as string) || '#000000',
    textAlign: (props.textAlign as CSSProperties['textAlign']) || 'left',
    textTransform: (props.textTransform as CSSProperties['textTransform']) || 'none',
    letterSpacing:
      typeof props.letterSpacing === 'number' ? `${props.letterSpacing}px` : undefined,
    textDecoration: decorations.length ? decorations.join(' ') : 'none',
    textShadow: (props.textShadow as string) || undefined,
    paddingLeft: typeof props.paddingLeft === 'number' ? props.paddingLeft : undefined,
    textIndent: typeof props.textIndent === 'number' ? props.textIndent : undefined,
    lineHeight:
      typeof lineHeightRaw === 'number' && lineHeightRaw > 4
        ? `${lineHeightRaw}px`
        : typeof lineHeightRaw === 'number'
          ? lineHeightRaw
          : 1.45,
    width: '100%',
    height: '100%',
  };
}

/** Text styles for rendered content blocks — no forced fill height. */
export function getTextDisplayStyle(
  props: Record<string, unknown>,
  type?: string
): CSSProperties {
  const { width: _width, height: _height, ...rest } = getTextElementStyle(props, type);
  return rest;
}

export function pickTextStyleProps(props: Record<string, unknown>) {
  const picked: Record<string, unknown> = {};
  for (const key of TEXT_STYLE_KEYS) {
    if (props[key] !== undefined) picked[key] = props[key];
  }
  return picked;
}

let copiedTextStyle: Record<string, unknown> | null = null;

export function copyTextStyle(props: Record<string, unknown>) {
  copiedTextStyle = pickTextStyleProps(props);
}

export function pasteTextStyle(): Record<string, unknown> | null {
  return copiedTextStyle ? { ...copiedTextStyle } : null;
}

export function hasCopiedTextStyle() {
  return copiedTextStyle !== null;
}

export function clearCopiedTextStyle() {
  copiedTextStyle = null;
}

/** @deprecated Use parseFontFamilyName from google-fonts */
export function getFontLabel(value: string | undefined): string {
  return parseFontFamilyName(value);
}
