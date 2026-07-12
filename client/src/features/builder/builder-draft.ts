import type { TemplatePage } from '@invogen/shared';

export interface BuilderDraft {
  templateId: string;
  templateName: string;
  pages: TemplatePage[];
  isDirty: boolean;
  savedAt: number;
}

const draftKey = (templateId: string) => `invogen:builder-draft:${templateId}`;

export function countBuilderElements(pages: TemplatePage[]): number {
  return pages.reduce((total, page) => total + (page.elements?.length ?? 0), 0);
}

/** Avoid restoring a stale empty draft over saved template content from the API. */
export function shouldRestoreBuilderDraft(
  draft: BuilderDraft | null,
  apiPages: TemplatePage[] | undefined
): draft is BuilderDraft {
  if (!draft?.isDirty || !draft.pages?.length) return false;
  const draftElements = countBuilderElements(draft.pages);
  const apiElements = countBuilderElements(apiPages ?? []);
  if (draftElements === 0 && apiElements > 0) return false;
  return true;
}

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
