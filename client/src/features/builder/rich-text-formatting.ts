import type { TextRunProps } from '@/features/builder/text-styles';
import { getRunStyle } from '@/features/builder/text-styles';
import { runMetaJson } from '@/features/builder/rich-text-utils';

export type TextStylePatch = Partial<Omit<TextRunProps, 'text'>>;

const EDITOR_SELECTOR = '.builder-text-editor[contenteditable="true"]';

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
  return document.querySelector(EDITOR_SELECTOR);
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

export function getInheritedSelectionStyle(editor: HTMLElement): TextStylePatch {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return {};
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

/**
 * Apply style to the current text selection inside the active builder text editor.
 * Returns false when there is no non-collapsed selection in an editor (caller should
 * fall back to whole-element formatting).
 */
export function applyStylePatchToActiveSelection(patch: TextStylePatch): boolean {
  const editor = getActiveBuilderTextEditor();
  if (!editor) return false;

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;

  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return false;

  const inherited = getInheritedSelectionStyle(editor);
  const nextStyle: TextStylePatch = { ...inherited, ...patch };

  // Split surrounding formatted spans so we only restyle the selection.
  const span = document.createElement('span');
  applyMetaToSpan(span, nextStyle, window.getComputedStyle(editor));

  try {
    const contents = range.extractContents();
    // Flatten nested run spans inside the selection so styles don't stack oddly.
    unwrapNestedRunSpans(contents, nextStyle, editor);
    span.appendChild(contents);
    range.insertNode(span);
  } catch {
    return false;
  }

  // Reselect formatted text.
  const next = document.createRange();
  next.selectNodeContents(span);
  sel.removeAllRanges();
  sel.addRange(next);
  editor.focus();
  editor.dispatchEvent(new Event('input', { bubbles: true }));
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
  const editor = getActiveBuilderTextEditor();
  if (!editor) return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  return editor.contains(sel.getRangeAt(0).commonAncestorContainer);
}

export function getActiveSelectionStylePreview(): TextStylePatch | null {
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
