import type { TemplateDocument } from '@invogen/shared';
import api from '@/api/client';

const templateCache = new Map<string, TemplateDocument>();
const inflight = new Map<string, Promise<TemplateDocument>>();

export async function fetchTemplateDocument(
  apiBase: string,
  id: string
): Promise<TemplateDocument> {
  const cached = templateCache.get(id);
  if (cached) return cached;

  const pending = inflight.get(id);
  if (pending) return pending;

  const request = api
    .get(`${apiBase}/${id}`)
    .then((res) => {
      const doc = res.data.data as TemplateDocument;
      templateCache.set(id, doc);
      inflight.delete(id);
      return doc;
    })
    .catch((err) => {
      inflight.delete(id);
      throw err;
    });

  inflight.set(id, request);
  return request;
}

export function getCachedTemplate(id: string): TemplateDocument | undefined {
  return templateCache.get(id);
}

export function primeTemplateCache(doc: TemplateDocument): void {
  templateCache.set(doc._id, doc);
}

export function invalidateTemplateCache(id?: string): void {
  if (id) {
    templateCache.delete(id);
    inflight.delete(id);
    return;
  }
  templateCache.clear();
  inflight.clear();
}
