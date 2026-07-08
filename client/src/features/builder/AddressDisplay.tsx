import type { CSSProperties, HTMLAttributes } from 'react';
import { parseAddressFromProps, formatAddressValue, parseHiddenAddressFields } from './address-content';

interface Props extends HTMLAttributes<HTMLDivElement> {
  props: Record<string, unknown>;
  textStyle: CSSProperties;
}

export function AddressDisplay({ props: elementProps, textStyle, ...rest }: Props) {
  const data = parseAddressFromProps(elementProps);
  const hidden = new Set(parseHiddenAddressFields(elementProps.hiddenFields));
  const body = formatAddressValue(data, { hidden });
  const titleStyle: CSSProperties = {
    fontWeight: Math.max((textStyle.fontWeight as number) || 400, 600),
    marginBottom: body.trim() ? '0.35em' : 0,
  };

  return (
    <div
      {...rest}
      style={{
        ...textStyle,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {!hidden.has('title') && data.title.trim() && <div style={titleStyle}>{data.title}</div>}
      {body.trim() && <div>{body}</div>}
    </div>
  );
}
