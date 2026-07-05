import { InvoiceTemplatePicker } from '@/features/invoice-composer/InvoiceTemplatePicker';

export default function EmployeeInvoiceNew() {
  return (
    <InvoiceTemplatePicker
      config={{
        templatesApi: '/employee/templates',
        queryKey: 'employee-templates-gallery',
        composerPath: '/employee/invoices/new/:templateId',
      }}
    />
  );
}
