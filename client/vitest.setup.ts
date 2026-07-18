/**
 * Deterministic canvas mock for layout tests.
 *
 * jsdom has no real canvas — text-measure would silently fall back to its
 * char-width heuristic. This mock gives measureText an exact monospace model
 * (each char = fontSize * 0.5 px), so wrapped line counts in tests are hand-
 * computable and stable across environments.
 */
const CHAR_WIDTH_RATIO = 0.5;

class MockCanvasContext {
  font = '';
  letterSpacing = '0px';

  measureText(text: string): { width: number } {
    const sizeMatch = /(\d+(?:\.\d+)?)px/.exec(this.font);
    const fontSize = sizeMatch ? parseFloat(sizeMatch[1]) : 16;
    const spacingMatch = /(-?\d+(?:\.\d+)?)px/.exec(this.letterSpacing);
    const spacing = spacingMatch ? parseFloat(spacingMatch[1]) : 0;
    return { width: text.length * (fontSize * CHAR_WIDTH_RATIO + spacing) };
  }
}

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => new MockCanvasContext(),
  writable: true,
});

export const MOCK_CHAR_WIDTH_RATIO = CHAR_WIDTH_RATIO;
