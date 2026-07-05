export type OutlineEditorActions = {
  indentFocused: () => void;
  outdentFocused: () => void;
  setLevel: (level: number) => void;
  addMainLine: () => void;
};

let activeOutlineEditor: OutlineEditorActions | null = null;
let currentOutlineLevel = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function registerOutlineEditor(
  api: (OutlineEditorActions & { getLevel: () => number }) | null
) {
  activeOutlineEditor = api;
  currentOutlineLevel = api?.getLevel() ?? 0;
  notify();
}

export function outlineEditorIndent() {
  activeOutlineEditor?.indentFocused();
}

export function outlineEditorOutdent() {
  activeOutlineEditor?.outdentFocused();
}

export function outlineEditorSetLevel(level: number) {
  activeOutlineEditor?.setLevel(level);
}

export function outlineEditorAddMainLine() {
  activeOutlineEditor?.addMainLine();
}

export function getOutlineCurrentLevel() {
  return currentOutlineLevel;
}

export function setOutlineCurrentLevel(level: number) {
  currentOutlineLevel = level;
  notify();
}

export function subscribeOutlineEditor(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isOutlineEditorActive() {
  return activeOutlineEditor !== null;
}
