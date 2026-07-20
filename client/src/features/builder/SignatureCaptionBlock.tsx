import type { CSSProperties } from 'react';
import { TextWithPlaceholderChips } from './TextWithPlaceholderChips';
import { getTextElementStyle } from './text-styles';
import {
  parseSignatureCaption,
  estimateSignatureCaptionHeight,
} from './signature-content';

/** Caption under the signature image — supports `<placeholder>` tokens + text styles. */
export function SignatureCaptionBlock({
  props,
  className,
}: {
  props: Record<string, unknown>;
  className?: string;
}) {
  const caption = parseSignatureCaption(props);
  if (!caption.enabled) return null;

  const textStyle = getTextElementStyle(props, 'signature');
  const align = (props.textAlign as string) || 'center';
  const lines = [caption.title, caption.name].filter((line) => line.length > 0);
  if (lines.length === 0) return null;

  const title = lines[0];
  const rest = lines.slice(1);

  return (
    <div
      className={className}
      style={{
        ...textStyle,
        textAlign: align as CSSProperties['textAlign'],
        position: 'relative',
        zIndex: 2,
        width: '100%',
        flexShrink: 0,
        background: '#ffffff',
        paddingTop: 8,
        paddingBottom: 4,
        paddingLeft: 4,
        paddingRight: 4,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        boxSizing: 'border-box',
      }}
      data-signature-caption="true"
    >
      {title ? (
        <div
          style={{
            fontWeight: Math.max((textStyle.fontWeight as number) || 400, 500),
          }}
        >
          <TextWithPlaceholderChips text={title} />
        </div>
      ) : null}
      {rest.map((line, index) => (
        <div key={`${index}-${line.slice(0, 12)}`} style={{ marginTop: 2 }}>
          <TextWithPlaceholderChips text={line} />
        </div>
      ))}
    </div>
  );
}

export { parseSignatureCaption, estimateSignatureCaptionHeight };
