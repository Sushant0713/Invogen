import { InvoiceComposer } from '@/features/invoice-composer/InvoiceComposer';

export default function EmployeeInvoiceComposerPage() {
  return (
    <InvoiceComposer
      config={{
        apiBase: '/employee',
        templatesApi: '/employee/templates',
        invoicesApi: '/employee/invoices',
        invoicesListPath: '/employee/invoices',
        templatePickPath: '/employee/invoices/new',
        composerPath: '/employee/invoices/new/:templateId',
      }}
    />
  );
}
