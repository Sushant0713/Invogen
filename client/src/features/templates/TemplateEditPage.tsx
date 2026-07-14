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
  const editableTemplate =
    resolvedTemplate && !resolvedTemplate.isSystem ? resolvedTemplate : undefined;
  const { isReady } = useHydrateTemplateBuilder(editableTemplate, id);

  const { data: allTemplates = [] } = useQuery({
    queryKey: [queryKey, 'all'],
    queryFn: async () =>
      (await api.get(apiBase, { params: { limit: 200 } })).data.data as TemplateSummary[],
    enabled: Boolean(resolvedTemplate?.isSystem && canForkSystemTemplates),
    ...planSyncOptions,
  });

  const companyTemplateNames = useMemo(
    () =>
      new Set(
        allTemplates.filter((template) => !template.isSystem).map((template) => template.name)
      ),
    [allTemplates]
  );

  useEffect(() => {
    if (!resolvedTemplate?.isSystem || freshTemplate || forkStartedRef.current) return;

    if (!canForkSystemTemplates) {
      toast.error(
        'You do not have permission to create a custom copy of this system template'
      );
      navigate(templatesListPath, { replace: true });
      return;
    }

    forkStartedRef.current = true;

    void (async () => {
      try {
        const res = await api.post(apiBase, {
          name: suggestTemplateName(resolvedTemplate.name, companyTemplateNames),
          category: resolvedTemplate.category,
          sourceTemplateId: resolvedTemplate._id,
          description: resolvedTemplate.description || undefined,
        });
        const created = res.data.data as TemplateDocument;
        queryClient.invalidateQueries({ queryKey: [queryKey] });
        queryClient.invalidateQueries({ queryKey: [queryKey, 'all'] });
        queryClient.invalidateQueries({ queryKey: [queryKey, 'system'] });
        if (created.pages?.length) {
          primeTemplateCache(created);
        }
        if (created._id) {
          navigate(`${templatesListPath}/${created._id}/edit`, {
            replace: true,
            state: { freshTemplate: created },
          });
        }
      } catch (error) {
        const message =
          error
          && typeof error === 'object'
          && 'response' in error
          && (error as { response?: { data?: { message?: string } } }).response?.data?.message;
        toast.error(message || 'Could not open this system template for editing');
        navigate(templatesListPath, { replace: true });
      }
    })();
  }, [
    resolvedTemplate,
    freshTemplate,
    companyTemplateNames,
    navigate,
    queryClient,
    apiBase,
    templatesListPath,
    queryKey,
    canForkSystemTemplates,
  ]);

  useEffect(() => {
    return () => {
      forkStartedRef.current = false;
    };
  }, [id]);

  if ((!freshTemplate && isLoading) || !id || resolvedTemplate?.isSystem || !isReady) {
    return <Loader fullScreen />;
  }

  return (
    <InvoiceBuilder
      templateId={id}
      apiBase={apiBase}
      backTo={templatesListPath}
      templatesListPath={templatesListPath}
      allowRename
      allowDuplicate={allowDuplicate}
    />
  );
}
