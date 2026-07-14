import { useNavigate, Navigate } from 'react-router-dom';
import { PERMISSIONS } from '@invogen/shared';
import { TemplateGallery } from '@/features/template-gallery';
import { TemplatesManagement } from '@/features/templates/TemplatesManagement';
import { recordTemplateUse } from '@/features/template-gallery/template-manager';
import { useAppSelector } from '@/hooks/useAppDispatch';
import { useEmployeePlanAccess, employeePlanSyncQueryOptions } from '@/hooks/useEmployeePlanAccess';

export default function EmployeeTemplates() {
  const navigate = useNavigate();
  const permissions = useAppSelector((s) => s.auth.user?.permissions ?? []);
  const canEditTemplates = permissions.includes(PERMISSIONS.TEMPLATE_EDIT);
  const canCreateTemplates = permissions.includes(PERMISSIONS.TEMPLATE_CREATE);
  const canCreateInvoice = permissions.includes(PERMISSIONS.INVOICE_CREATE);
  const { data: planAccess } = useEmployeePlanAccess();

  if (!permissions.includes(PERMISSIONS.TEMPLATE_VIEW) && !canEditTemplates) {
    return <Navigate to="/403" replace />;
  }

  const planCanAddTemplate = planAccess ? planAccess.canAddTemplate !== false : true;
  const allowCreateTemplates = planCanAddTemplate && canCreateTemplates;

  if (canEditTemplates) {
    return (
      <TemplatesManagement
        apiBase="/employee/templates"
        queryKey="employee-templates"
        editPathPrefix="/employee/templates"
        canEditTemplates={canEditTemplates}
        planCanAddTemplate={planCanAddTemplate}
        canCreateTemplates={allowCreateTemplates}
        allowedTemplateIds={planAccess?.allowedTemplateIds}
        planSyncOptions={employeePlanSyncQueryOptions}
        createBlockedMessage="Creating custom templates is not available on your company plan"
        enablePreviewActions={canCreateInvoice || canEditTemplates}
        templateViewPath={(templateId) => `/employee/templates/${templateId}/preview`}
        composerPath={(templateId) => `/employee/invoices/new/${templateId}`}
      />
    );
  }

  return (
    <TemplateGallery
      apiBase="/employee/templates"
      queryKey="employee-templates"
      editPath="/employee/invoices/create"
      title="Template Gallery"
      subtitle="Browse invoice templates — select one when creating an invoice."
      onOpenTemplate={(template) => {
        if (!canCreateInvoice && !canEditTemplates) return;
        recordTemplateUse(template._id);
        navigate(`/employee/templates/${template._id}/preview`);
      }}
      onViewTemplate={
        canCreateInvoice || canEditTemplates
          ? (template) => {
              recordTemplateUse(template._id);
              navigate(`/employee/templates/${template._id}/preview`);
            }
          : undefined
      }
      showEdit={false}
    />
  );
}
