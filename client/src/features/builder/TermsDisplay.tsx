import type { CSSProperties, HTMLAttributes } from 'react';
import {
  buildOutlineNumbers,
  getOutlineTextIndent,
  OUTLINE_NUMBER_COLUMN,
} from './text-styles';
import { parseTermsFromProps } from './terms-content';

interface Props extends HTMLAttributes<HTMLDivElement> {
  props: Record<string, unknown>;
  textStyle: CSSProperties;
}

export function TermsDisplay({ props: elementProps, textStyle, ...rest }: Props) {
  const { title, items } = parseTermsFromProps(elementProps);
  const visibleItems = items.filter((text) => text.trim());
  const numbers = buildOutlineNumbers(visibleItems.map((text) => ({ level: 0, text })));

  return (
    <div
      {...rest}
      style={{
        ...textStyle,
        width: '100%',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {title.trim() && (
        <div
          style={{
            fontWeight: Math.max((textStyle.fontWeight as number) || 400, 600),
            marginBottom: '0.45em',
          }}
        >
          {title}
        </div>
      )}
      {visibleItems.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {visibleItems.map((text, index) => (
            <li
              key={`${index}-${text.slice(0, 12)}`}
              className="grid items-start"
              style={{
                gridTemplateColumns: `${OUTLINE_NUMBER_COLUMN} 1fr`,
                marginBottom: '0.2em',
                minHeight: '1.45em',
              }}
            >
              <span className="pr-1 text-right tabular-nums">{numbers[index]}.</span>
              <span style={{ paddingLeft: getOutlineTextIndent(0) }}>{text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
