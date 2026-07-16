import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TemplateDocument, TemplateSummary } from '@invogen/shared';
import api from '@/api/client';
import { InvoiceBuilder } from '@/features/builder/InvoiceBuilder';
import { useHydrateTemplateBuilder } from '@/features/builder/use-hydrate-template-builder';
import { suggestTemplateName } from '@/features/template-gallery/CustomizeTemplateDialog';
import { primeTemplateCache } from '@/features/template-gallery/template-loader';
import { Loader } from '@/components/ui/Loader';
import { toast } from 'sonner';

type TemplateEditLocationState = {
  freshTemplate?: TemplateDocument;
};

export interface TemplateEditPageProps {
  apiBase: string;
  templatesListPath: string;
  queryKey: string;
  canForkSystemTemplates: boolean;
  /** Duplicate requires add-template authority (and plan access). */
  allowDuplicate?: boolean;
  planSyncOptions?: {
    staleTime?: number;
    refetchOnWindowFocus?: boolean;
    refetchOnReconnect?: boolean;
    refetchInterval?: number;
    refetchIntervalInBackground?: boolean;
  };
}

export function TemplateEditPage({
  apiBase,
  templatesListPath,
  queryKey,
  canForkSystemTemplates,
  allowDuplicate = false,
  planSyncOptions,
}: TemplateEditPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const forkStartedRef = useRef(false);

  const freshTemplate = (location.state as TemplateEditLocationState | null)?.freshTemplate;

  const { data, isLoading } = useQuery({
    queryKey: ['template', apiBase, id],
    queryFn: async () => (await api.get(`${apiBase}/${id}`)).data.data as TemplateDocument,
    enabled: !!id && !freshTemplate,
    refetchOnWindowFocus: false,
  });

  const resolvedTemplate = freshTemplate ?? data;
  const { isReady } = useHydrateTemplateBuilder(resolvedTemplate, id);

  const { data: allTemplates = [] } = useQuery({
    queryKey: [queryKey, 'all'],
    queryFn: async () =>
      (await api.get(apiBase, { params: { limit: 200 } })).data.data as TemplateSummary[],
    enabled: !!resolvedTemplate,
    ...planSyncOptions,
  });

  const companyTemplateNames = useMemo(
    () =>
      new Set(
        allTemplates.filter((template) => !template.isSystem).map((template) => template.name)
      ),
    [allTemplates]
  );

  // No automatic client-side forking on mount; we let them customize and save-as inside the builder instead.

  if ((!freshTemplate && isLoading) || !id || !resolvedTemplate || !isReady) {
    return <Loader fullScreen />;
  }

  return (
    <InvoiceBuilder
      templateId={id}
      apiBase={apiBase}
      backTo={templatesListPath}
      templatesListPath={templatesListPath}
      allowRename={!resolvedTemplate?.isSystem}
      allowDuplicate={allowDuplicate}
      isSystem={resolvedTemplate?.isSystem}
      category={resolvedTemplate?.category}
    />
  );
}
