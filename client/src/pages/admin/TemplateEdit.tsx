import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { loadTemplate, markDirty, resetBuilder } from '@/store/slices/builderSlice';
import { loadBuilderDraft } from '@/features/builder/builder-draft';
import { InvoiceBuilder } from '@/features/builder/InvoiceBuilder';
import { Loader } from '@/components/ui/Loader';

export default function AdminTemplateEdit() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const loadedIdRef = useRef<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['template', id],
    queryFn: async () => (await api.get(`/admin/templates/${id}`)).data.data,
    enabled: !!id,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!data?._id) return;

    if (loadedIdRef.current !== data._id) {
      loadedIdRef.current = data._id;
      const draft = loadBuilderDraft(data._id);
      if (draft?.isDirty && draft.pages?.length) {
        dispatch(
          loadTemplate({
            id: data._id,
            name: draft.templateName || data.name,
            pages: draft.pages,
          })
        );
        dispatch(markDirty());
      } else {
        dispatch(loadTemplate({ id: data._id, name: data.name, pages: data.pages }));
      }
    }

    return () => {
      loadedIdRef.current = null;
      dispatch(resetBuilder());
    };
  }, [data, dispatch]);

  if (isLoading || !id) return <Loader fullScreen />;

  return <InvoiceBuilder templateId={id} />;
}
