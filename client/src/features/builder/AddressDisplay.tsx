import type { CSSProperties, HTMLAttributes } from 'react';
import {
  parseAddressFromProps,
  formatAddressValue,
  parseHiddenAddressFields,
  parseAddressHeaderMode,
} from './address-content';
import { LibraryIconTile } from './LibraryIconTile';

interface Props extends HTMLAttributes<HTMLDivElement> {
  props: Record<string, unknown>;
  textStyle: CSSProperties;
}

export function AddressDisplay({ props: elementProps, textStyle, ...rest }: Props) {
  const data = parseAddressFromProps(elementProps);
  const hidden = new Set(parseHiddenAddressFields(elementProps.hiddenFields));
  const headerMode = parseAddressHeaderMode(elementProps.addressHeaderMode);
  const body = formatAddressValue(data, { hidden });
  const fontSize =
    typeof elementProps.fontSize === 'number' && elementProps.fontSize > 0
      ? elementProps.fontSize
      : typeof textStyle.fontSize === 'number'
        ? textStyle.fontSize
        : 12;
  const iconSize = Math.round(fontSize * 1.35);
  const iconGap = Math.max(4, Math.round(fontSize * 0.4));
  const showTitle = !hidden.has('title') && !!data.title.trim();
  const showLogo = headerMode === 'logo' && !hidden.has('title');
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
      {showTitle && headerMode === 'label' ? (
        <div style={titleStyle}>{data.title}</div>
      ) : null}
      {body.trim() ? (
        showLogo ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: iconGap,
            }}
          >
            <LibraryIconTile iconKey="address" size={iconSize} className="shrink-0" />
            <div style={{ flex: 1, minWidth: 0 }}>{body}</div>
          </div>
        ) : (
          <div>{body}</div>
        )
      ) : null}
    </div>
  );
}
