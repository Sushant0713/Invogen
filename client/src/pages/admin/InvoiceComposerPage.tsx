import { InvoiceComposer } from '@/features/invoice-composer/InvoiceComposer';

export default function AdminInvoiceComposerPage() {
  return (
    <InvoiceComposer
      config={{
        apiBase: '/admin',
        templatesApi: '/admin/templates',
        customersApi: '/admin/customers',
        companyApi: '/admin/company',
        invoicesApi: '/admin/invoices',
        invoicesListPath: '/admin/invoices',
        templatePickPath: '/admin/invoices/new',
        composerPath: '/admin/invoices/new/:templateId',
      }}
    />
  );
}
