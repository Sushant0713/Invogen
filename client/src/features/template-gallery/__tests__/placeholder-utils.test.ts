import { describe, expect, it } from 'vitest';
import type { TemplatePage } from '@invogen/shared';
import { applyPlaceholdersToPages } from '../placeholder-utils';

type RunProps = { text: string; fontWeight?: number };

function pageWithTextRuns(content: string, textRuns: RunProps[]): TemplatePage[] {
  return [
    {
      id: 'p1',
      name: 'Page 1',
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
      elements: [
        {
          id: 'el1',
          type: 'text',
          x: 0,
          y: 0,
          width: 300,
          height: 40,
          zIndex: 1,
          props: { content, textRuns },
        },
      ],
    },
  ];
}

function resultProps(pages: TemplatePage[]) {
  const props = pages[0].elements[0].props as {
    content: string;
    textRuns?: RunProps[];
  };
  return props;
}

describe('placeholder substitution keeps content and textRuns coherent', () => {
  it('replaces a token contained in one run', () => {
    const pages = pageWithTextRuns('Hello {{ClientName}}', [
      { text: 'Hello ' },
      { text: '{{ClientName}}', fontWeight: 700 },
    ]);
    const out = resultProps(applyPlaceholdersToPages(pages, { ClientName: 'Acme' }));
    expect(out.content).toBe('Hello Acme');
    expect(out.textRuns?.map((r) => r.text).join('')).toBe(out.content);
    expect(out.textRuns?.find((r) => r.fontWeight === 700)?.text).toBe('Acme');
  });

  it('replaces a token SPLIT across run boundaries without dropping formatting', () => {
    // This is the case that silently killed bold in the live preview: the
    // joined runs no longer matched content, so getTextRuns discarded them.
    const pages = pageWithTextRuns('Hello {{ClientName}} world', [
      { text: 'Hello {{Client' },
      { text: 'Name}} world', fontWeight: 700 },
    ]);
    const out = resultProps(applyPlaceholdersToPages(pages, { ClientName: 'Acme' }));
    expect(out.content).toBe('Hello Acme world');
    // Runs stay in sync with content — the guard in getTextRuns passes.
    expect(out.textRuns?.map((r) => r.text).join('')).toBe(out.content);
    // The bold run survives (carrying the text after the token).
    expect(out.textRuns?.some((r) => r.fontWeight === 700)).toBe(true);
  });

  it('leaves unresolved tokens in place, runs still coherent', () => {
    const pages = pageWithTextRuns('Hi {{Missing}}', [
      { text: 'Hi ' },
      { text: '{{Missing}}', fontWeight: 700 },
    ]);
    const out = resultProps(applyPlaceholdersToPages(pages, {}));
    expect(out.content).toBe('Hi {{Missing}}');
    expect(out.textRuns?.map((r) => r.text).join('')).toBe(out.content);
  });

  it('replaces angle placeholders across runs', () => {
    const pages = pageWithTextRuns('By <your name>', [
      { text: 'By <your ' },
      { text: 'name>', fontWeight: 700 },
    ]);
    const out = resultProps(applyPlaceholdersToPages(pages, { 'your name': 'Priya' }));
    expect(out.content).toBe('By Priya');
    expect(out.textRuns?.map((r) => r.text).join('')).toBe(out.content);
  });

  it('falls back to plain deep replacement when runs are already stale', () => {
    const pages = pageWithTextRuns('Current text {{ClientName}}', [
      { text: 'Totally different old runs' },
    ]);
    const out = resultProps(applyPlaceholdersToPages(pages, { ClientName: 'Acme' }));
    expect(out.content).toBe('Current text Acme');
  });
});
