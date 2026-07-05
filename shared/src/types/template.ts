import type { TemplatePage } from './invoice';

/** Lightweight template record for gallery lists (no page JSON). */
export interface TemplateSummary {
  _id: string;
  name: string;
  category: string;
  description?: string;
  isSystem: boolean;
  companyId?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Full template with editable document JSON. */
export interface TemplateDocument {
  _id: string;
  name: string;
  category: string;
  description?: string;
  pages: TemplatePage[];
  isSystem: boolean;
  companyId?: string;
  version?: number;
}

export interface TemplateListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TemplateListResponse {
  data: TemplateSummary[];
  meta: TemplateListMeta;
}
