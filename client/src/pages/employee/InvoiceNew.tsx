import { InvoiceTemplatePicker } from '@/features/invoice-composer/InvoiceTemplatePicker';
import { useAppSelector } from '@/hooks/useAppDispatch';
import { PERMISSIONS } from '@invogen/shared';
import { Navigate } from 'react-router-dom';

export default function EmployeeInvoiceNew() {
  const permissions = useAppSelector((s) => s.auth.user?.permissions ?? []);
  const canCreateInvoice = permissions.includes(PERMISSIONS.INVOICE_CREATE);
  const canEditInvoice = permissions.includes(PERMISSIONS.INVOICE_EDIT);
  if (!canCreateInvoice && !canEditInvoice) return <Navigate to="/403" replace />;
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
