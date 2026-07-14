import { useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { TemplateDocument } from '@invogen/shared';
import api from '@/api/client';
import { InvoiceBuilder } from '@/features/builder/InvoiceBuilder';
import { useHydrateTemplateBuilder } from '@/features/builder/use-hydrate-template-builder';
import { Loader } from '@/components/ui/Loader';
import { isSuperAdminTemplateCategory } from '@/pages/super-admin/template-categories';

export default function SuperAdminTemplateEdit() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const freshTemplate = (location.state as { freshTemplate?: TemplateDocument } | null)?.freshTemplate;

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-template', id],
    queryFn: async () => (await api.get(`/super-admin/templates/${id}`)).data.data,
    enabled: !!id && !freshTemplate,
    refetchOnWindowFocus: false,
  });

  const resolved = freshTemplate?._id === id ? freshTemplate : data;
  const { isReady } = useHydrateTemplateBuilder(resolved, id);

  if ((!freshTemplate && isLoading) || !id || !resolved || !isReady) return <Loader fullScreen />;

  const backTo = isSuperAdminTemplateCategory(resolved.category ?? '')
    ? '/super-admin/templates/super-admin'
    : '/super-admin/templates';

  return (
    <InvoiceBuilder
      templateId={id}
      apiBase="/super-admin/templates"
      backTo={backTo}
      templatesListPath="/super-admin/templates"
      allowDuplicate
    />
  );
}
