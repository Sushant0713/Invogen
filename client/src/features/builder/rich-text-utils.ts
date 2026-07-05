import type { TextRunProps } from '@/features/builder/text-styles';

/** Strip text from a run — store the rest in data-text-run on editor spans. */
export function runMetaJson(run: TextRunProps): string {
  const { text: _t, ...meta } = run;
  return JSON.stringify(meta);
}

export function mergeAdjacentRuns(runs: TextRunProps[]): TextRunProps[] {
  const merged: TextRunProps[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const prev = merged[merged.length - 1];
    if (prev && runsEqualStyle(prev, run)) {
      prev.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

function runsEqualStyle(a: TextRunProps, b: TextRunProps): boolean {
  return (
    a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize &&
    a.fontWeight === b.fontWeight &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.strikethrough === b.strikethrough &&
    a.color === b.color &&
    a.highlight === b.highlight &&
    a.letterSpacing === b.letterSpacing &&
    a.href === b.href
  );
}

/** Walk contentEditable DOM and rebuild textRuns preserving per-span styles. */
export function parseRunsFromEditor(root: HTMLElement, fallback: TextRunProps[]): TextRunProps[] {
  const runs: TextRunProps[] = [];
  const defaultRun: TextRunProps = fallback[0] ?? { text: '' };

  const processNode = (node: Node, inherited: TextRunProps) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (text) runs.push({ ...inherited, text });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    if (el.tagName === 'BR') {
      runs.push({ ...inherited, text: '\n' });
      return;
    }

    let style: TextRunProps = { ...inherited, text: '' };
    const raw = el.getAttribute('data-text-run');
    if (raw) {
      try {
        style = { ...style, ...JSON.parse(raw), text: '' };
      } catch {
        /* ignore malformed meta */
      }
    }
    if (el.tagName === 'A') {
      style = { ...style, href: el.getAttribute('href') ?? style.href, underline: true };
    }

    if (el.childNodes.length === 0) {
      const text = el.textContent ?? '';
      if (text) runs.push({ ...style, text });
      return;
    }

    for (const child of el.childNodes) {
      processNode(child, style);
    }
  };

  for (const child of root.childNodes) {
    processNode(child, { ...defaultRun, text: '' });
  }

  return mergeAdjacentRuns(runs);
}

export function runsToPlainContent(runs: TextRunProps[]): string {
  return runs.map((r) => r.text).join('');
}
