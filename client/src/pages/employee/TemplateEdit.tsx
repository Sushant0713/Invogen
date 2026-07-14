import { Navigate } from 'react-router-dom';
import { PERMISSIONS } from '@invogen/shared';
import { TemplateEditPage } from '@/features/templates/TemplateEditPage';
import { useAppSelector } from '@/hooks/useAppDispatch';
import { useEmployeePlanAccess, employeePlanSyncQueryOptions } from '@/hooks/useEmployeePlanAccess';

export default function EmployeeTemplateEdit() {
  const permissions = useAppSelector((s) => s.auth.user?.permissions ?? []);
  const { data: planAccess } = useEmployeePlanAccess();

  if (!permissions.includes(PERMISSIONS.TEMPLATE_EDIT)) {
    return <Navigate to="/403" replace />;
  }

  const planCanAddTemplate = planAccess ? planAccess.canAddTemplate !== false : true;
  const canCreateTemplates =
    planCanAddTemplate && permissions.includes(PERMISSIONS.TEMPLATE_CREATE);
  const canForkSystemTemplates =
    planCanAddTemplate && permissions.includes(PERMISSIONS.TEMPLATE_EDIT);

  return (
    <TemplateEditPage
      apiBase="/employee/templates"
      templatesListPath="/employee/templates"
      queryKey="employee-templates"
      canForkSystemTemplates={canForkSystemTemplates}
      allowDuplicate={canCreateTemplates}
      planSyncOptions={employeePlanSyncQueryOptions}
    />
  );
}
