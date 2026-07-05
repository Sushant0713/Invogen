import type { DocumentProject, DocumentSaveFile, TemplatePage } from '@invogen/shared';
import { documentPageToTemplatePage } from '../core/object-adapter';

export function projectToTemplatePages(project: DocumentProject): TemplatePage[] {
  return project.pages.map(documentPageToTemplatePage);
}

export function serializeDocument(project: DocumentProject): DocumentSaveFile {
  return {
    version: 1,
    name: project.name,
    category: project.category,
    pages: project.pages.map((page) => ({
      id: page.id,
      name: page.name,
      margins: page.margins,
      pageSize: page.pageSize,
      objects: page.objects,
    })),
  };
}
