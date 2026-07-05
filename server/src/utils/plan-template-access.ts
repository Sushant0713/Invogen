import mongoose from 'mongoose';
import { SubscriptionStatus } from '@invogen/shared';
import { InvoiceTemplate, Plan, Subscription } from '../models';
import { AppError } from './AppError';

export type PlanTemplateAccess = {
  templateAccessConfigured: boolean;
  templateIds: string[];
  canAddTemplate: boolean;
};

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

export async function getCompanyPlanAccess(
  companyId: string
): Promise<PlanTemplateAccess | null> {
  const companyObjectId = toObjectId(String(companyId));
  if (!companyObjectId) return null;

  let subscription = await Subscription.findOne({
    companyId: companyObjectId,
    status: {
      $in: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.TRIAL,
        SubscriptionStatus.PAST_DUE,
      ],
    },
  })
    .sort({ createdAt: -1 })
    .select('planId')
    .lean();

  if (!subscription) {
    subscription = await Subscription.findOne({ companyId: companyObjectId })
      .sort({ createdAt: -1 })
      .select('planId')
      .lean();
  }

  if (!subscription?.planId) return null;

  const plan = await Plan.findById(subscription.planId)
    .select('templateIds canAddTemplate templateAccessConfigured')
    .lean();

  if (!plan) return null;

  const configured =
    plan.templateAccessConfigured === true
    || typeof plan.canAddTemplate === 'boolean';

  const templateIds = Array.isArray(plan.templateIds)
    ? plan.templateIds.map((id) => String(id))
    : [];

  return {
    templateAccessConfigured: configured,
    templateIds,
    canAddTemplate: configured ? plan.canAddTemplate === true : true,
  };
}

/**
 * System template IDs allowed for a company based on its plan.
 * `null` means unrestricted (legacy plans that never configured template access).
 */
export async function getAllowedSystemTemplateIds(
  companyId: string
): Promise<string[] | null> {
  const access = await getCompanyPlanAccess(companyId);
  if (!access || !access.templateAccessConfigured) return null;
  return access.templateIds;
}

export function systemTemplateAccessCondition(
  allowedIds: string[] | null
): Record<string, unknown> {
  if (allowedIds === null) return { isSystem: true };
  if (allowedIds.length === 0) {
    return { isSystem: true, _id: { $in: [] } };
  }
  return {
    isSystem: true,
    _id: {
      $in: allowedIds
        .map((id) => toObjectId(id))
        .filter((id): id is mongoose.Types.ObjectId => id != null),
    },
  };
}

export async function assertSystemTemplateAccess(
  companyId: string,
  templateId: string
): Promise<void> {
  const allowedIds = await getAllowedSystemTemplateIds(companyId);
  if (allowedIds === null) return;
  if (!allowedIds.includes(String(templateId))) {
    throw new AppError('Template is not available on your plan', 403);
  }
}

function normalizeTemplateId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const id = value.trim();
    return mongoose.Types.ObjectId.isValid(id) ? id : null;
  }
  // ObjectId / BSON id — never recurse; `_id` on ObjectId points at itself.
  if (
    value instanceof mongoose.Types.ObjectId
    || (typeof value === 'object'
      && value !== null
      && (value as { _bsontype?: string })._bsontype === 'ObjectId')
  ) {
    const id = String(value);
    return mongoose.Types.ObjectId.isValid(id) ? id : null;
  }
  if (typeof value === 'object') {
    const record = value as { _id?: unknown; id?: unknown };
    // Populated docs: prefer string/ObjectId fields without re-entering ObjectId.
    if (record._id != null && record._id !== value) {
      return normalizeTemplateId(record._id);
    }
    if (record.id != null && record.id !== value) {
      return normalizeTemplateId(record.id);
    }
  }
  return null;
}

export async function resolvePlanTemplateIds(
  templateIds: unknown
): Promise<mongoose.Types.ObjectId[]> {
  if (!Array.isArray(templateIds)) return [];

  const unique = [
    ...new Set(
      templateIds
        .map((value) => normalizeTemplateId(value))
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (unique.length === 0) return [];

  const objectIds = unique
    .map((id) => toObjectId(id))
    .filter((id): id is mongoose.Types.ObjectId => id != null);

  const templates = await InvoiceTemplate.find({
    _id: { $in: objectIds },
    isSystem: true,
  }).select('_id');

  return templates.map((t) => t._id as mongoose.Types.ObjectId);
}

/** Serialize plan templateIds for API clients (stable string ids). */
export function serializePlanTemplateIds(raw: unknown): Array<{ _id: string; name: string; category: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const id = normalizeTemplateId(item);
      if (!id) return null;
      const name =
        item && typeof item === 'object' && 'name' in item
          ? String((item as { name?: unknown }).name || '')
          : '';
      const category =
        item && typeof item === 'object' && 'category' in item
          ? String((item as { category?: unknown }).category || '')
          : '';
      return { _id: id, name, category };
    })
    .filter((item): item is { _id: string; name: string; category: string } => item != null);
}

export async function companyCanAddTemplate(companyId: string): Promise<boolean> {
  const access = await getCompanyPlanAccess(companyId);
  if (!access) return true;
  return access.canAddTemplate;
}

export async function assertCanAddTemplate(companyId: string): Promise<void> {
  const allowed = await companyCanAddTemplate(companyId);
  if (!allowed) {
    throw new AppError('Adding templates is not available on your plan', 403);
  }
}

export async function buildCompanyTemplateListFilter(
  companyId: string,
  query: Record<string, unknown>,
  buildTemplateListFilter: (
    base: Record<string, unknown>[],
    query: Record<string, unknown>
  ) => Record<string, unknown>
): Promise<Record<string, unknown>> {
  const allowedSystemIds = await getAllowedSystemTemplateIds(companyId);
  const companyObjectId = toObjectId(String(companyId));

  const companyMatch = companyObjectId
    ? { companyId: companyObjectId, isSystem: { $ne: true } }
    : { companyId: String(companyId), isSystem: { $ne: true } };

  return buildTemplateListFilter(
    [
      { isActive: true },
      {
        $or: [systemTemplateAccessCondition(allowedSystemIds), companyMatch],
      },
    ],
    query
  );
}
