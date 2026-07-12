import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { InvoiceBuilder } from '@/features/builder/InvoiceBuilder';
import { useHydrateTemplateBuilder } from '@/features/builder/use-hydrate-template-builder';
import { Loader } from '@/components/ui/Loader';
import { isSuperAdminTemplateCategory } from '@/pages/super-admin/template-categories';

export default function SuperAdminTemplateEdit() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-template', id],
    queryFn: async () => (await api.get(`/super-admin/templates/${id}`)).data.data,
    enabled: !!id,
    refetchOnWindowFocus: false,
  });

  const { isReady } = useHydrateTemplateBuilder(data, id);

  if (isLoading || !id || !data || !isReady) return <Loader fullScreen />;

  const backTo = isSuperAdminTemplateCategory(data.category ?? '')
    ? '/super-admin/templates/super-admin'
    : '/super-admin/templates';

  return (
    <InvoiceBuilder
      templateId={id}
      apiBase="/super-admin/templates"
      backTo={backTo}
    />
  );
}
