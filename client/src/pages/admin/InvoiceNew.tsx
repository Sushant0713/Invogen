import { InvoiceTemplatePicker } from '@/features/invoice-composer/InvoiceTemplatePicker';

export default function AdminInvoiceNew() {
  return (
    <InvoiceTemplatePicker
      config={{
        templatesApi: '/admin/templates',
        queryKey: 'admin-templates-gallery',
        composerPath: '/admin/invoices/new/:templateId',
      }}
    />
  );
}
