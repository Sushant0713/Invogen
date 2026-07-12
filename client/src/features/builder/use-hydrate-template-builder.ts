import { useLayoutEffect, useRef } from 'react';
import type { TemplatePage } from '@invogen/shared';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import { loadTemplate, markDirty, resetBuilder } from '@/store/slices/builderSlice';
import {
  loadBuilderDraft,
  shouldRestoreBuilderDraft,
} from '@/features/builder/builder-draft';

export interface TemplateBuilderSource {
  _id: string;
  name: string;
  pages?: TemplatePage[];
}

/**
 * Loads template JSON into the builder Redux slice before the canvas paints.
 * Returns isReady once builder.templateId matches the route id.
 */
export function useHydrateTemplateBuilder(
  template: TemplateBuilderSource | undefined,
  routeTemplateId: string | undefined
) {
  const dispatch = useAppDispatch();
  const loadedIdRef = useRef<string | null>(null);
  const loadedTemplateId = useAppSelector((s) => s.builder.templateId);

  useLayoutEffect(() => {
    if (!template?._id) return;
    if (loadedIdRef.current === template._id) return;

    loadedIdRef.current = template._id;
    const draft = loadBuilderDraft(template._id);
    if (shouldRestoreBuilderDraft(draft, template.pages)) {
      dispatch(
        loadTemplate({
          id: template._id,
          name: draft.templateName || template.name,
          pages: draft.pages,
        })
      );
      dispatch(markDirty());
      return;
    }

    dispatch(
      loadTemplate({
        id: template._id,
        name: template.name,
        pages: template.pages ?? [],
      })
    );
  }, [template, dispatch]);

  useLayoutEffect(() => {
    return () => {
      loadedIdRef.current = null;
      dispatch(resetBuilder());
    };
  }, [routeTemplateId, dispatch]);

  const isReady = Boolean(
    template?._id && routeTemplateId && loadedTemplateId === routeTemplateId
  );

  return { isReady };
}
