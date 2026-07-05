import type { TemplatePage } from '@invogen/shared';

export interface BuilderDraft {
  templateId: string;
  templateName: string;
  pages: TemplatePage[];
  isDirty: boolean;
  savedAt: number;
}

const draftKey = (templateId: string) => `invogen:builder-draft:${templateId}`;

export function saveBuilderDraft(draft: Omit<BuilderDraft, 'savedAt'>): void {
  if (!draft.templateId) return;
  try {
    sessionStorage.setItem(
      draftKey(draft.templateId),
      JSON.stringify({ ...draft, savedAt: Date.now() } satisfies BuilderDraft)
    );
  } catch {
    /* quota or private mode */
  }
}

export function loadBuilderDraft(templateId: string): BuilderDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(templateId));
    if (!raw) return null;
    return JSON.parse(raw) as BuilderDraft;
  } catch {
    return null;
  }
}

export function clearBuilderDraft(templateId: string): void {
  try {
    sessionStorage.removeItem(draftKey(templateId));
  } catch {
    /* ignore */
  }
}
