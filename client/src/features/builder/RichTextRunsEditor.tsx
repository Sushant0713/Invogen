import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { TextRunProps } from '@/features/builder/text-styles';
import { getRunStyle } from '@/features/builder/text-styles';
import { parseRunsFromEditor, runMetaJson, runsToPlainContent } from '@/features/builder/rich-text-utils';

interface RichTextRunsEditorProps {
  runs: TextRunProps[];
  baseStyle: CSSProperties;
  pendingEditChar?: string | null;
  onChange?: (plain: string) => void;
  onCommit?: (payload: { content: string; text: string; textRuns: TextRunProps[] }) => void;
  onPendingEditCharConsumed?: () => void;
}

export function RichTextRunsEditor({
  runs,
  baseStyle,
  pendingEditChar,
  onChange,
  onCommit,
  onPendingEditCharConsumed,
}: RichTextRunsEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current || !editorRef.current) return;
    initRef.current = true;

    const root = editorRef.current;
    root.innerHTML = '';

    const initialRuns = runs;
    for (let i = 0; i < initialRuns.length; i += 1) {
      const run = initialRuns[i];
      const text =
        pendingEditChar && i === initialRuns.length - 1
          ? run.text + pendingEditChar
          : run.text;
      const meta = runMetaJson(run);
      const style = getRunStyle({ ...run, text }, baseStyle);

      if (run.href) {
        const a = document.createElement('a');
        a.href = run.href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.setAttribute('data-text-run', meta);
        Object.assign(a.style, style as Record<string, string>);
        a.textContent = text;
        root.appendChild(a);
      } else {
        const span = document.createElement('span');
        span.setAttribute('data-text-run', meta);
        Object.assign(span.style, style as Record<string, string>);
        span.textContent = text;
        root.appendChild(span);
      }
    }

    if (pendingEditChar) {
      onChange?.(runsToPlainContent(initialRuns) + pendingEditChar);
      onPendingEditCharConsumed?.();
    }

    root.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const handleInput = () => {
    if (!editorRef.current) return;
    onChange?.(editorRef.current.textContent ?? '');
  };

  const handleBlur = () => {
    if (!editorRef.current) return;
    const textRuns = parseRunsFromEditor(editorRef.current, runs);
    const content = runsToPlainContent(textRuns);
    onCommit?.({ content, text: content, textRuns });
  };

  return (
    <div
      ref={editorRef}
      className="builder-text-editor h-full w-full"
      contentEditable
      suppressContentEditableWarning
      style={{
        ...baseStyle,
        outline: 'none',
        cursor: 'text',
        userSelect: 'text',
        minHeight: '1em',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
      onMouseDown={stop}
      onPointerDown={stop}
      onClick={stop}
      onInput={handleInput}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}
