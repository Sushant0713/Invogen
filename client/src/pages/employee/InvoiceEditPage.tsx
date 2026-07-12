import { Navigate } from 'react-router-dom';
import { PERMISSIONS } from '@invogen/shared';
import { InvoiceComposer } from '@/features/invoice-composer/InvoiceComposer';
import { useAppSelector } from '@/hooks/useAppDispatch';

export default function EmployeeInvoiceEditPage() {
  const permissions = useAppSelector((s) => s.auth.user?.permissions ?? []);
  const canEdit = permissions.includes(PERMISSIONS.INVOICE_EDIT);
  const canCreate = permissions.includes(PERMISSIONS.INVOICE_CREATE);
  const canDelete = permissions.includes(PERMISSIONS.INVOICE_DELETE);

  if (!canEdit) {
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
        canSaveInvoice: true,
        canShareInvoice: canCreate,
        canDuplicateInvoice: canCreate,
        canDeleteInvoice: canDelete,
      }}
    />
  );
}
