import { useNavigate } from 'react-router-dom';
import { TemplateGallery } from '@/features/template-gallery/TemplateGallery';
import { FilePlus2 } from 'lucide-react';

export interface InvoiceTemplatePickerConfig {
  templatesApi: string;
  queryKey: string;
  composerPath: string;
  title?: string;
  subtitle?: string;
}

export function InvoiceTemplatePicker({ config }: { config: InvoiceTemplatePickerConfig }) {
  const navigate = useNavigate();

  return (
    <TemplateGallery
      apiBase={config.templatesApi}
      queryKey={config.queryKey}
      editPath={config.composerPath}
      title={config.title ?? 'New Invoice'}
      subtitle={
        config.subtitle ??
        'Choose an invoice template — each layout opens in a split editor with a live preview.'
      }
      showEdit={false}
      onOpenTemplate={(template) =>
        navigate(config.composerPath.replace(':templateId', template._id))
      }
      renderCardAction={(template) => (
        <button
          type="button"
          title={`New invoice from ${template.name}`}
          onClick={() => navigate(config.composerPath.replace(':templateId', template._id))}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-600"
        >
          <FilePlus2 className="h-3.5 w-3.5" />
          New Invoice
        </button>
      )}
    />
  );
}
