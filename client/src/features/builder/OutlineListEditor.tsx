import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  parseOutlineLines,
  serializeOutlineLines,
  buildOutlineNumbers,
  OUTLINE_NUMBER_COLUMN,
  getOutlineTextIndent,
  type OutlineLine,
} from './text-styles';
import { registerOutlineEditor, setOutlineCurrentLevel } from './outline-editor-api';

interface Props {
  value: string;
  textStyle: CSSProperties;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
}

const MAX_LEVEL = 3;
const TOOLBAR_SELECTOR = '.builder-context-toolbar-scroll';

function toLines(content: string): OutlineLine[] {
  const parsed = parseOutlineLines(content);
  if (parsed.length === 1 && !parsed[0].text) {
    return [{ level: 0, text: '' }];
  }
  return parsed.map(({ level, text }) => ({ level, text }));
}

export function OutlineListEditor({ value, textStyle, onChange, onCommit }: Props) {
  const [lines, setLines] = useState<OutlineLine[]>(() => toLines(value));
  const [focusedIndex, setFocusedIndex] = useState(0);
  const linesRef = useRef(lines);
  const focusedIndexRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const skipSyncRef = useRef(false);

  linesRef.current = lines;
  focusedIndexRef.current = focusedIndex;
  const numbers = useMemo(() => buildOutlineNumbers(lines), [lines]);

  const emit = useCallback((next: OutlineLine[]) => {
    skipSyncRef.current = true;
    linesRef.current = next;
    setLines(next);
    onChange(serializeOutlineLines(next));
  }, [onChange]);

  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    if (serializeOutlineLines(linesRef.current) === value) return;
    const next = toLines(value);
    linesRef.current = next;
    setLines(next);
  }, [value]);

  const applyLevelAt = useCallback((index: number, level: number) => {
    const clamped = Math.max(0, Math.min(level, MAX_LEVEL));
    emit(linesRef.current.map((line, i) => (
      i === index ? { ...line, level: clamped } : line
    )));
    setOutlineCurrentLevel(clamped);
    requestAnimationFrame(() => inputRefs.current[index]?.focus());
  }, [emit]);

  const indentAt = useCallback((index: number) => {
    const line = linesRef.current[index];
    if (!line) return;
    applyLevelAt(index, line.level + 1);
  }, [applyLevelAt]);

  const outdentAt = useCallback((index: number) => {
    const line = linesRef.current[index];
    if (!line) return;
    applyLevelAt(index, line.level - 1);
  }, [applyLevelAt]);

  const addLine = useCallback((afterIndex: number, explicitLevel?: number) => {
    const current = linesRef.current;
    const nextLevel = explicitLevel !== undefined
      ? explicitLevel
      : (current[afterIndex]?.level ?? 0);
    const next = [
      ...current.slice(0, afterIndex + 1),
      { level: nextLevel, text: '' },
      ...current.slice(afterIndex + 1),
    ];
    emit(next);
    const focusAt = afterIndex + 1;
    setFocusedIndex(focusAt);
    focusedIndexRef.current = focusAt;
    setOutlineCurrentLevel(nextLevel);
    requestAnimationFrame(() => inputRefs.current[focusAt]?.focus());
  }, [emit]);

  useEffect(() => {
    registerOutlineEditor({
      indentFocused: () => indentAt(focusedIndexRef.current),
      outdentFocused: () => outdentAt(focusedIndexRef.current),
      setLevel: (level) => applyLevelAt(focusedIndexRef.current, level),
      addMainLine: () => addLine(focusedIndexRef.current, 0),
      getLevel: () => linesRef.current[focusedIndexRef.current]?.level ?? 0,
    });
    return () => registerOutlineEditor(null);
  }, [indentAt, outdentAt, applyLevelAt, addLine]);

  useEffect(() => {
    requestAnimationFrame(() => inputRefs.current[0]?.focus());
  }, []);

  const inputTypography: CSSProperties = {
    fontFamily: textStyle.fontFamily,
    fontSize: textStyle.fontSize,
    fontWeight: textStyle.fontWeight,
    fontStyle: textStyle.fontStyle,
    color: textStyle.color,
    letterSpacing: textStyle.letterSpacing,
    textTransform: textStyle.textTransform,
    textDecoration: textStyle.textDecoration,
    lineHeight: 1.45,
  };

  const updateText = (index: number, text: string) => {
    emit(linesRef.current.map((line, i) => (i === index ? { ...line, text } : line)));
  };

  const removeLine = (index: number) => {
    const current = linesRef.current;
    if (current.length <= 1) {
      emit([{ level: 0, text: '' }]);
      return;
    }
    emit(current.filter((_, i) => i !== index));
    const focusAt = Math.max(0, index - 1);
    setFocusedIndex(focusAt);
    focusedIndexRef.current = focusAt;
    requestAnimationFrame(() => inputRefs.current[focusAt]?.focus());
  };

  const shouldExitOnBlur = (next: EventTarget | null) => {
    if (!next) return true;
    if (containerRef.current?.contains(next as Node)) return false;
    if ((next as HTMLElement).closest?.(TOOLBAR_SELECTOR)) return false;
    return true;
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!shouldExitOnBlur(e.relatedTarget)) return;
    onCommit(serializeOutlineLines(linesRef.current));
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) outdentAt(index);
      else indentAt(index);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        addLine(index, 0);
      } else {
        addLine(index);
      }
      return;
    }
    if (e.key === 'Backspace' && !linesRef.current[index].text && linesRef.current.length > 1) {
      e.preventDefault();
      removeLine(index);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCommit(serializeOutlineLines(linesRef.current));
      e.currentTarget.blur();
    }
  };

  return (
    <div
      ref={containerRef}
      className="outline-list-editor h-full w-full overflow-y-auto"
      style={{ lineHeight: 1.45 }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {lines.map((line, index) => (
        <div
          key={index}
          className="grid items-start"
          style={{
            gridTemplateColumns: `${OUTLINE_NUMBER_COLUMN} 1fr`,
            minHeight: '1.45em',
          }}
        >
          <span
            className="select-none pr-1 text-right tabular-nums"
            style={{
              ...inputTypography,
              opacity: index === focusedIndex ? 1 : 0.6,
              fontWeight: index === focusedIndex ? 600 : 400,
            }}
          >
            {numbers[index]}
          </span>
          <input
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            value={line.text}
            placeholder={index === 0 ? 'Type here…' : ''}
            className="min-w-0 border-0 bg-transparent p-0 outline-none"
            style={{
              ...inputTypography,
              paddingLeft: getOutlineTextIndent(line.level),
            }}
            onFocus={() => {
              setFocusedIndex(index);
              focusedIndexRef.current = index;
              setOutlineCurrentLevel(line.level);
            }}
            onChange={(e) => updateText(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onBlur={handleBlur}
          />
        </div>
      ))}
    </div>
  );
}
