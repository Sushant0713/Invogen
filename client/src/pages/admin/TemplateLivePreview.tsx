import { TemplateInvoiceLivePreviewPage } from '@/features/templates/TemplateInvoiceLivePreviewPage';

export default function AdminTemplateLivePreview() {
  return (
    <TemplateInvoiceLivePreviewPage
      apiBase="/admin/templates"
      templatesListPath="/admin/templates"
      composerPath={(templateId) => `/admin/invoices/new/${templateId}`}
    />
  );
}
