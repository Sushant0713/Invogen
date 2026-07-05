import type { NavigateFunction } from 'react-router-dom';
import type { TemplatePage } from '@invogen/shared';
import { applyPlaceholdersToPages, type PlaceholderContext } from './placeholder-utils';
import { recordTemplateUse } from './template-manager';

export interface OpenTemplateOptions {
  templateId: string;
  editPath: string;
  navigate: NavigateFunction;
}

/** Open the full editable template JSON in the builder (Word-style). */
export function openTemplateInEditor({
  templateId,
  editPath,
  navigate,
}: OpenTemplateOptions): void {
  recordTemplateUse(templateId);
  navigate(editPath.replace(':id', templateId));
}

/** Create a document instance from template JSON with placeholder substitution. */
export function createDocumentFromTemplate(
  pages: TemplatePage[],
  context: PlaceholderContext
): TemplatePage[] {
  return applyPlaceholdersToPages(pages, context);
}
