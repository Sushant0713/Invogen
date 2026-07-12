import { Navigate } from 'react-router-dom';
import { PERMISSIONS } from '@invogen/shared';
import { InvoiceComposer } from '@/features/invoice-composer/InvoiceComposer';
import { useAppSelector } from '@/hooks/useAppDispatch';

export default function EmployeeInvoiceComposerPage() {
  const permissions = useAppSelector((s) => s.auth.user?.permissions ?? []);
  const canCreateInvoice = permissions.includes(PERMISSIONS.INVOICE_CREATE);
  const canEditInvoice = permissions.includes(PERMISSIONS.INVOICE_EDIT);
  const canEditTemplates = permissions.includes(PERMISSIONS.TEMPLATE_EDIT);
  const canDelete = permissions.includes(PERMISSIONS.INVOICE_DELETE);
  const canSaveInvoice = canCreateInvoice || canEditInvoice;

  if (!canSaveInvoice && !canEditTemplates) {
    return <Navigate to="/403" replace />;
  }

  return (
    <InvoiceComposer
      config={{
        apiBase: '/employee',
        templatesApi: '/employee/templates',
        customersApi: '/employee/customers/catalog',
        invoicesApi: '/employee/invoices',
        invoicesListQueryKey: ['employee-invoices'],
        sharesQueryKey: ['employee-invoice-shares'],
        companyApi: '/employee/company',
        invoicesListPath: '/employee/invoices',
        templatePickPath: '/employee/invoices/new',
        composerPath: '/employee/invoices/new/:templateId',
        invoiceEditPath: '/employee/invoices/:invoiceId/edit',
        canSaveInvoice,
        canShareInvoice: canCreateInvoice,
        canDuplicateInvoice: canCreateInvoice,
        canDeleteInvoice: canDelete,
      }}
    />
  );
}
