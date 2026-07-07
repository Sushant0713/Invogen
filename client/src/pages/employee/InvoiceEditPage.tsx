import { InvoiceComposer } from '@/features/invoice-composer/InvoiceComposer';

export default function EmployeeInvoiceEditPage() {
  return (
    <InvoiceComposer
      config={{
        apiBase: '/employee',
        templatesApi: '/employee/templates',
        invoicesApi: '/employee/invoices',
        invoicesListQueryKey: ['employee-invoices'],
        sharesQueryKey: ['employee-invoice-shares'],
        invoicesListPath: '/employee/invoices',
        templatePickPath: '/employee/invoices/new',
        composerPath: '/employee/invoices/new/:templateId',
        invoiceEditPath: '/employee/invoices/:invoiceId/edit',
      }}
    />
  );
}
