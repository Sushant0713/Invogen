import type { CSSProperties, ReactNode } from 'react';

/** Split plain text so `<placeholder>` / `{{Token}}` can be highlighted on canvas. */
const TOKEN_RE = /(<\s*[^<>]+?\s*>)|(\{\{\w+\}\})/g;

const KNOWN_EDITABLE_TAGS = new Set([
  'div',
  'span',
  'b',
  'i',
  'u',
  'strong',
  'em',
  'a',
  'p',
  'font',
  'br',
]);

type Piece =
  | { kind: 'text'; value: string }
  | { kind: 'token'; value: string; label: string };

function tokenLabel(raw: string): string {
  if (raw.startsWith('{{') && raw.endsWith('}}')) {
    return raw.slice(2, -2);
  }
  return raw.replace(/^<\s*/, '').replace(/\s*>$/, '').trim() || raw;
}

export function splitTextWithPlaceholders(text: string): Piece[] {
  if (!text) return [{ kind: 'text', value: '' }];
  const pieces: Piece[] = [];
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let match = TOKEN_RE.exec(text);
  while (match) {
    if (match.index > last) {
      pieces.push({ kind: 'text', value: text.slice(last, match.index) });
    }
    const value = match[0];
    pieces.push({ kind: 'token', value, label: tokenLabel(value) });
    last = match.index + value.length;
    match = TOKEN_RE.exec(text);
  }
  if (last < text.length) {
    pieces.push({ kind: 'text', value: text.slice(last) });
  }
  return pieces.length > 0 ? pieces : [{ kind: 'text', value: text }];
}

function hasPlaceholderHtmlArtifacts(root: HTMLElement): boolean {
  return Array.from(root.querySelectorAll('*')).some((node) => {
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (KNOWN_EDITABLE_TAGS.has(tag)) return false;
    return !(el.textContent ?? '').trim();
  });
}

/**
 * Read text from a contentEditable surface.
 * Uses innerText for normal typing (avoids duplicate-node bugs).
 * Only uses DOM recovery when the browser turned `<placeholder>` into empty tags.
 */
export function readContentEditablePlainText(root: HTMLElement): string {
  if (!hasPlaceholderHtmlArtifacts(root)) {
    // innerText maps <br>/blocks to newlines once; textContent is the fallback.
    return (root.innerText ?? root.textContent ?? '').replace(/\u00a0/g, ' ');
  }

  let out = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.nodeValue ?? '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'br') {
      out += '\n';
      return;
    }
    const text = (el.textContent ?? '').trim();
    if (!KNOWN_EDITABLE_TAGS.has(tag) && !text) {
      const attrs = Array.from(el.attributes)
        .map((attr) => attr.name)
        .filter((name) => name !== 'class' && name !== 'style' && !name.startsWith('data-'))
        .join(' ');
      const label = attrs ? `${tag} ${attrs}` : tag;
      out += `<${label}>`;
      return;
    }
    el.childNodes.forEach(walk);
  };

  root.childNodes.forEach(walk);
  return out.replace(/\u00a0/g, ' ');
}

/** Highlight fillable tokens so empty placeholders stay visible on canvas/preview. */
export function TextWithPlaceholderChips({
  text,
  style,
  className,
}: {
  text: string;
  style?: CSSProperties;
  className?: string;
}): ReactNode {
  const pieces = splitTextWithPlaceholders(text);
  const hasToken = pieces.some((p) => p.kind === 'token');
  if (!hasToken) {
    return text;
  }

  return (
    <span className={className} style={style}>
      {pieces.map((piece, index) =>
        piece.kind === 'token' ? (
          <span
            key={`${piece.value}-${index}`}
            className="mx-0.5 inline rounded-sm bg-amber-100 px-1 font-medium text-amber-900 underline decoration-dashed decoration-amber-500 underline-offset-2"
            title={`Fillable field: ${piece.label}`}
          >
            {piece.value.startsWith('<') ? `<${piece.label}>` : piece.value}
          </span>
        ) : (
          <span key={`t-${index}`}>{piece.value}</span>
        )
      )}
    </span>
  );
}
