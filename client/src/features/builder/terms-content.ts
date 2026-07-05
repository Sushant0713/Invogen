import { serializeOutlineLines, parseOutlineLines } from './text-styles';

export const DEFAULT_TERMS_TITLE = 'Terms and Conditions';

export function termsItemsToContent(items: string[]): string {
  return serializeOutlineLines(items.map((text) => ({ level: 0, text })));
}

export function parseTermsFromProps(props: Record<string, unknown>): {
  title: string;
  items: string[];
} {
  const title =
    typeof props.termsTitle === 'string' && props.termsTitle.trim()
      ? props.termsTitle.trim()
      : DEFAULT_TERMS_TITLE;

  if (Array.isArray(props.termsItems)) {
    const items = props.termsItems.map((item) => (typeof item === 'string' ? item : ''));
    if (items.length > 0) {
      return { title, items };
    }
  }

  const content = typeof props.content === 'string' ? props.content : '';
  const fromOutline = parseOutlineLines(content)
    .map((line) => line.text)
    .filter((text) => text.trim());
  if (fromOutline.length > 0) {
    return { title, items: fromOutline };
  }

  if (content.trim()) {
    return { title, items: [content.trim()] };
  }

  return { title, items: [''] };
}

export function buildTermsProps(
  title: string,
  items: string[],
  baseProps: Record<string, unknown> = {}
): Record<string, unknown> {
  const normalizedItems = items.length > 0 ? items : [''];
  const trimmedTitle = title.trim() || DEFAULT_TERMS_TITLE;

  return {
    ...baseProps,
    termsTitle: trimmedTitle,
    termsItems: normalizedItems,
    listStyle: 'outline',
    content: termsItemsToContent(normalizedItems),
  };
}

export function termsPropsFromOutlineContent(
  content: string,
  baseProps: Record<string, unknown>
): Record<string, unknown> {
  const title =
    typeof baseProps.termsTitle === 'string' && baseProps.termsTitle.trim()
      ? baseProps.termsTitle.trim()
      : DEFAULT_TERMS_TITLE;
  const items = parseOutlineLines(content).map((line) => line.text);
  return buildTermsProps(title, items.length > 0 ? items : [''], baseProps);
}

export function getDefaultTermsProps(): Record<string, unknown> {
  return {
    ...buildTermsProps(DEFAULT_TERMS_TITLE, [
      'Payment is due within 30 days of invoice date.',
    ]),
    fontSize: 12,
    color: '#000000',
  };
}
