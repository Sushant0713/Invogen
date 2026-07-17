import type { TextRunProps } from '@/features/builder/text-styles';
import { getRunStyle } from '@/features/builder/text-styles';
import { runMetaJson } from '@/features/builder/rich-text-utils';

export type TextStylePatch = Partial<Omit<TextRunProps, 'text'>>;

const EDITOR_SELECTOR = '.builder-text-editor[contenteditable="true"]';
export const BUILDER_TOOLBAR_ATTR = 'data-builder-toolbar';

export function getActiveBuilderTextEditor(): HTMLElement | null {
  const sel = window.getSelection();
  if (sel?.rangeCount) {
    const node = sel.getRangeAt(0).commonAncestorContainer;
    const el = node instanceof HTMLElement ? node : node.parentElement;
    const editor = el?.closest(EDITOR_SELECTOR);
    if (editor instanceof HTMLElement) return editor;
  }
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && focused.matches(EDITOR_SELECTOR)) {
    return focused;
  }
  // Prefer the saved editor while a toolbar control holds focus.
  if (savedEditor?.isConnected) return savedEditor;
  return document.querySelector(EDITOR_SELECTOR);
}

export function isBuilderToolbarTarget(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  return Boolean(node.closest(`[${BUILDER_TOOLBAR_ATTR}]`));
}

// Controls like the font dropdown (autofocus search) or the native color input
// steal the editor's text selection. Snapshot it before they open so we can
// restore and format the originally selected text.
let savedRange: Range | null = null;
let savedEditor: HTMLElement | null = null;
/** Suppress editor blur-commit while a formatting control is in use. */
let formattingLock = false;

export function beginBuilderTextFormatting(): void {
  formattingLock = true;
  saveBuilderTextSelection();
}

export function endBuilderTextFormatting(): void {
  formattingLock = false;
}

export function isBuilderTextFormattingLocked(): boolean {
  return formattingLock;
}

export function saveBuilderTextSelection(): void {
  const editor =
    (document.activeElement instanceof HTMLElement
      && document.activeElement.closest(EDITOR_SELECTOR))
    || getActiveBuilderTextEditor();
  const sel = window.getSelection();
  if (
    editor instanceof HTMLElement
    && sel
    && sel.rangeCount > 0
    && !sel.isCollapsed
    && editor.contains(sel.getRangeAt(0).commonAncestorContainer)
  ) {
    savedRange = sel.getRangeAt(0).cloneRange();
    savedEditor = editor;
  }
}

export function restoreBuilderTextSelection(): boolean {
  if (!savedRange || !savedEditor || !savedEditor.isConnected) return false;
  savedEditor.focus();
  const sel = window.getSelection();
  if (!sel) return false;
  try {
    sel.removeAllRanges();
    sel.addRange(savedRange);
  } catch {
    return false;
  }
  return true;
}

export function clearSavedBuilderTextSelection(): void {
  savedRange = null;
  savedEditor = null;
  formattingLock = false;
}

function readRunMeta(el: HTMLElement | null): TextStylePatch {
  if (!el) return {};
  const raw = el.getAttribute('data-text-run');
  if (!raw) return {};
  try {
    return JSON.parse(raw) as TextStylePatch;
  } catch {
    return {};
  }
}

function findRunHost(node: Node | null, editor: HTMLElement): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== editor) {
    if (current instanceof HTMLElement && current.hasAttribute('data-text-run')) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

function getSelectionContext(): {
  editor: HTMLElement;
  sel: Selection;
  range: Range;
} | null {
  let editor = getActiveBuilderTextEditor();
  let sel = window.getSelection();

  const liveSelectionValid =
    editor
    && sel
    && sel.rangeCount > 0
    && !sel.isCollapsed
    && editor.contains(sel.getRangeAt(0).commonAncestorContainer);

  if (!liveSelectionValid) {
    if (!restoreBuilderTextSelection()) return null;
    editor = getActiveBuilderTextEditor();
    sel = window.getSelection();
  }

  if (!editor || !sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return null;
  return { editor, sel, range };
}

export function getInheritedSelectionStyle(editor: HTMLElement): TextStylePatch {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    if (savedRange && savedEditor === editor) {
      return readRunMeta(findRunHost(savedRange.startContainer, editor));
    }
    return {};
  }
  const range = sel.getRangeAt(0);
  const host = findRunHost(range.startContainer, editor);
  return readRunMeta(host);
}

function applyMetaToSpan(span: HTMLElement, style: TextStylePatch, baseStyle: CSSStyleDeclaration) {
  const run: TextRunProps = { text: '', ...style };
  span.setAttribute('data-text-run', runMetaJson(run));
  const css = getRunStyle(run, {
    fontFamily: baseStyle.fontFamily,
    fontSize: baseStyle.fontSize,
    fontWeight: baseStyle.fontWeight as unknown as number,
    color: baseStyle.color,
    letterSpacing: baseStyle.letterSpacing,
  });
  Object.assign(span.style, css as Record<string, string>);
}

function finalizeSelectionEdit(
  editor: HTMLElement,
  sel: Selection,
  span: HTMLElement
) {
  const next = document.createRange();
  next.selectNodeContents(span);
  sel.removeAllRanges();
  sel.addRange(next);
  savedRange = next.cloneRange();
  savedEditor = editor;
  editor.focus();
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Apply style to the current text selection inside the active builder text editor.
 * Returns false when there is no non-collapsed selection in an editor (caller should
 * fall back to whole-element formatting).
 */
export function applyStylePatchToActiveSelection(patch: TextStylePatch): boolean {
  const ctx = getSelectionContext();
  if (!ctx) return false;
  const { editor, sel, range } = ctx;

  const inherited = getInheritedSelectionStyle(editor);
  const nextStyle: TextStylePatch = { ...inherited, ...patch };

  const span = document.createElement('span');
  applyMetaToSpan(span, nextStyle, window.getComputedStyle(editor));

  try {
    const contents = range.extractContents();
    unwrapNestedRunSpans(contents, nextStyle, editor);
    span.appendChild(contents);
    range.insertNode(span);
  } catch {
    return false;
  }

  finalizeSelectionEdit(editor, sel, span);
  return true;
}

export type TextCaseMode = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

export function nextTextCaseMode(current: string | undefined): TextCaseMode {
  const order: TextCaseMode[] = ['none', 'uppercase', 'lowercase', 'capitalize'];
  const idx = order.indexOf((current as TextCaseMode) || 'none');
  return order[(idx + 1) % order.length];
}

function detectTextCase(text: string): TextCaseMode {
  if (!text.trim()) return 'none';
  if (text === text.toUpperCase() && text !== text.toLowerCase()) return 'uppercase';
  if (text === text.toLowerCase() && text !== text.toUpperCase()) return 'lowercase';
  const capitalized = text.replace(/\b([a-zA-Z])/g, (ch) => ch.toUpperCase());
  if (text === capitalized) return 'capitalize';
  return 'none';
}

function transformTextCase(text: string, mode: TextCaseMode): string {
  if (mode === 'uppercase') return text.toUpperCase();
  if (mode === 'lowercase') return text.toLowerCase();
  if (mode === 'capitalize') {
    return text.replace(/\b([a-zA-Z])/g, (ch) => ch.toUpperCase());
  }
  return text;
}

/** Cycle case on the selected characters. Returns false when there is no selection. */
export function applyCaseCycleToActiveSelection(): boolean {
  const ctx = getSelectionContext();
  if (!ctx) return false;
  const { editor, sel, range } = ctx;

  const selected = range.toString();
  if (!selected) return false;

  const nextMode = nextTextCaseMode(detectTextCase(selected));
  const transformed = transformTextCase(selected, nextMode);
  if (transformed === selected && nextMode === 'none') {
    // "none" after capitalize — leave characters as-is for selection path.
    return true;
  }

  const inherited = getInheritedSelectionStyle(editor);
  const span = document.createElement('span');
  applyMetaToSpan(span, inherited, window.getComputedStyle(editor));
  span.textContent = transformed;

  try {
    range.deleteContents();
    range.insertNode(span);
  } catch {
    return false;
  }

  finalizeSelectionEdit(editor, sel, span);
  return true;
}

function unwrapNestedRunSpans(
  root: DocumentFragment | HTMLElement,
  style: TextStylePatch,
  editor: HTMLElement
) {
  const spans = root.querySelectorAll?.('[data-text-run]') ?? [];
  spans.forEach((node) => {
    const el = node as HTMLElement;
    applyMetaToSpan(el, style, window.getComputedStyle(editor));
  });
}

export function selectionHasActiveBuilderEditor(): boolean {
  if (savedRange && savedEditor?.isConnected && !savedRange.collapsed) return true;
  const editor = getActiveBuilderTextEditor();
  if (!editor) return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  return editor.contains(sel.getRangeAt(0).commonAncestorContainer);
}

export function getActiveSelectionStylePreview(): TextStylePatch | null {
  if (savedRange && savedEditor?.isConnected) {
    return readRunMeta(findRunHost(savedRange.startContainer, savedEditor));
  }
  const editor = getActiveBuilderTextEditor();
  if (!editor) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  if (!editor.contains(sel.getRangeAt(0).commonAncestorContainer)) return null;
  return getInheritedSelectionStyle(editor);
}

/** Build an initial single run from plain element props (first edit of a text box). */
export function runsFromPlainProps(
  content: string,
  props: Record<string, unknown>
): TextRunProps[] {
  return [
    {
      text: content || '',
      fontFamily: typeof props.fontFamily === 'string' ? props.fontFamily : undefined,
      fontSize: typeof props.fontSize === 'number' ? props.fontSize : undefined,
      fontWeight: typeof props.fontWeight === 'number' ? props.fontWeight : undefined,
      italic: props.italic ? true : undefined,
      underline: props.underline ? true : undefined,
      strikethrough: props.strikethrough ? true : undefined,
      color: typeof props.color === 'string' ? props.color : undefined,
      letterSpacing:
        typeof props.letterSpacing === 'number' ? props.letterSpacing : undefined,
    },
  ];
}
