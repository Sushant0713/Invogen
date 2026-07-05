const TEMPLATE_LIST_FIELDS =
  'name category description isSystem companyId version createdAt updatedAt';

export function buildTemplateListFilter(
  baseConditions: Record<string, unknown>[],
  query: Record<string, unknown>
): Record<string, unknown> {
  const conditions = [...baseConditions];

  if (query.category && typeof query.category === 'string') {
    conditions.push({ category: query.category });
  }

  if (query.ids && typeof query.ids === 'string') {
    const ids = query.ids.split(',').map((id) => id.trim()).filter(Boolean);
    if (ids.length > 0) {
      conditions.push({ _id: { $in: ids } });
    }
  }

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const regex = { $regex: search, $options: 'i' };
    conditions.push({
      $or: [{ name: regex }, { category: regex }, { description: regex }],
    });
  }

  return conditions.length === 1 ? conditions[0] : { $and: conditions };
}

export const templateListProjection = TEMPLATE_LIST_FIELDS;
