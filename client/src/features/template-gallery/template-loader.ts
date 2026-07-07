import type { TemplateDocument } from '@invogen/shared';
import type { QueryClient } from '@tanstack/react-query';
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

/** After save — update in-memory + React Query caches so gallery/preview show latest JSON. */
export function publishSavedTemplateDocument(
  queryClient: QueryClient,
  apiBase: string,
  doc: TemplateDocument
): void {
  primeTemplateCache(doc);

  queryClient.setQueryData(['template-document', apiBase, doc._id], doc);
  queryClient.setQueryData(['template', doc._id], doc);
  queryClient.setQueryData(['super-admin-template', doc._id], doc);
  queryClient.setQueryData(['invoice-composer-template', apiBase, doc._id], doc);

  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      const id = doc._id;
      if (key[0] === 'template-document' && key[2] === id) return true;
      if (key[0] === 'invoice-composer-template' && key[2] === id) return true;
      if (key[0] === 'template' && key[1] === id) return true;
      if (key[0] === 'super-admin-template' && key[1] === id) return true;
      return false;
    },
  });
}
