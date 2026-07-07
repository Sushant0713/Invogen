import { InvoiceComposer } from '@/features/invoice-composer/InvoiceComposer';

export default function AdminInvoiceEditPage() {
  return (
    <InvoiceComposer
      config={{
        apiBase: '/admin',
        templatesApi: '/admin/templates',
        customersApi: '/admin/customers',
        invoicesApi: '/admin/invoices',
        invoicesListQueryKey: ['admin-invoices'],
        sharesQueryKey: ['admin-invoice-shares'],
        companyApi: '/admin/company',
        invoicesListPath: '/admin/invoices',
        templatePickPath: '/admin/invoices/new',
        composerPath: '/admin/invoices/new/:templateId',
        invoiceEditPath: '/admin/invoices/:invoiceId/edit',
      }}
    />
  );
}
