import { Navigate } from 'react-router-dom';
import { PERMISSIONS } from '@invogen/shared';
import { TemplateInvoiceLivePreviewPage } from '@/features/templates/TemplateInvoiceLivePreviewPage';
import { useAppSelector } from '@/hooks/useAppDispatch';

export default function EmployeeTemplateLivePreview() {
  const permissions = useAppSelector((s) => s.auth.user?.permissions ?? []);
  const canEditTemplates = permissions.includes(PERMISSIONS.TEMPLATE_EDIT);
  const canCreateInvoice = permissions.includes(PERMISSIONS.INVOICE_CREATE);

  if (!canEditTemplates && !canCreateInvoice) {
    return <Navigate to="/403" replace />;
  }

  return (
    <TemplateInvoiceLivePreviewPage
      apiBase="/employee/templates"
      templatesListPath="/employee/templates"
      composerPath={(templateId) => `/employee/invoices/new/${templateId}`}
    />
  );
}
