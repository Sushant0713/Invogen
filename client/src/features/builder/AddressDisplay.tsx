import type { CSSProperties, HTMLAttributes } from 'react';
import { parseAddressFromProps, formatAddressValue } from './address-content';

interface Props extends HTMLAttributes<HTMLDivElement> {
  props: Record<string, unknown>;
  textStyle: CSSProperties;
}

export function AddressDisplay({ props: elementProps, textStyle, ...rest }: Props) {
  const data = parseAddressFromProps(elementProps);
  const body = formatAddressValue(data);
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
      {data.title.trim() && <div style={titleStyle}>{data.title}</div>}
      {body.trim() && <div>{body}</div>}
    </div>
  );
}
