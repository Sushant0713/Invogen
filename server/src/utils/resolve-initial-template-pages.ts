import mongoose from 'mongoose';
import type { TemplatePage } from '@invogen/shared';
import { InvoiceTemplate } from '../models';
import { createBlankTemplate } from '../seeds/data/templates';
import { AppError } from './AppError';
import { cloneTemplatePagesExact, countTemplateElements } from './clone-template-pages';
import {
  assertSystemTemplateAccess,
  getAllowedSystemTemplateIds,
} from './plan-template-access';

function toObjectIds(ids: string[]): mongoose.Types.ObjectId[] {
  return ids
    .map((id) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null))
    .filter((id): id is mongoose.Types.ObjectId => id != null);
}

function hasPages(pages: unknown): pages is TemplatePage[] {
  return Array.isArray(pages) && pages.length > 0;
}

function pagesToPlain(pages: unknown): TemplatePage[] {
  return JSON.parse(JSON.stringify(pages)) as TemplatePage[];
}

async function loadSystemTemplateForClone(
  companyId: string,
  templateId: string
): Promise<{ pages: TemplatePage[]; elementCount: number }> {
  await assertSystemTemplateAccess(companyId, templateId);

  if (!mongoose.Types.ObjectId.isValid(templateId)) {
    throw new AppError('Invalid system template id', 400);
  }

  const systemTemplate = await InvoiceTemplate.findById(templateId);
  if (!systemTemplate) {
    throw new AppError('System template not found', 404);
  }
  if (!systemTemplate.isSystem) {
    throw new AppError(
      'This template is no longer a system template. Ask super admin to restore it.',
      400
    );
  }
  if (!systemTemplate.isActive) {
    throw new AppError('System template is inactive', 400);
  }
  if (!hasPages(systemTemplate.pages)) {
    throw new AppError('System template has no pages', 400);
  }

  const plainPages = pagesToPlain(systemTemplate.pages);
  const elementCount = countTemplateElements(plainPages);
  return { pages: plainPages, elementCount };
}

/**
 * Pages for a newly created company template.
 * When sourceTemplateId is set, always clone that system template (or fail).
 */
export async function resolveInitialTemplatePages(
  companyId: string,
  category: string,
  providedPages?: unknown,
  sourceTemplateId?: string
): Promise<TemplatePage[]> {
  if (hasPages(providedPages)) {
    return pagesToPlain(providedPages);
  }

  const normalizedSourceId =
    typeof sourceTemplateId === 'string' ? sourceTemplateId.trim() : '';
  if (normalizedSourceId) {
    const { pages, elementCount } = await loadSystemTemplateForClone(companyId, normalizedSourceId);
    const cloned = cloneTemplatePagesExact(pages);
    const clonedCount = countTemplateElements(cloned);
    if (elementCount > 0 && clonedCount !== elementCount) {
      throw new AppError('Failed to copy all template content from the system template', 500);
    }
    return cloned;
  }

  const allowedIds = await getAllowedSystemTemplateIds(companyId);
  const filter: Record<string, unknown> = {
    category,
    isSystem: true,
    isActive: true,
  };

  if (allowedIds !== null) {
    if (allowedIds.length === 0) {
      return createBlankTemplate(category);
    }
    const objectIds = toObjectIds(allowedIds);
    if (objectIds.length === 0) {
      return createBlankTemplate(category);
    }
    filter._id = { $in: objectIds };
  }

  const systemTemplate = await InvoiceTemplate.findOne(filter);
  if (!hasPages(systemTemplate?.pages)) {
    return createBlankTemplate(category);
  }

  return cloneTemplatePagesExact(pagesToPlain(systemTemplate.pages));
}
