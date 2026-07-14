import { useSubscriptionStatus, adminPlanSyncQueryOptions } from '@/hooks/useAdminSubscription';
import { TemplatesManagement } from '@/features/templates/TemplatesManagement';

export default function AdminTemplates() {
  const { data: subscriptionStatus } = useSubscriptionStatus();
  const planCanAddTemplate = subscriptionStatus
    ? subscriptionStatus.canAddTemplate !== false
    : true;

  return (
    <TemplatesManagement
      apiBase="/admin/templates"
      queryKey="admin-templates"
      editPathPrefix="/admin/templates"
      planCanAddTemplate={planCanAddTemplate}
      canCreateTemplates={planCanAddTemplate}
      allowedTemplateIds={subscriptionStatus?.allowedTemplateIds}
      planSyncOptions={adminPlanSyncQueryOptions}
      enablePreviewActions
      templateViewPath={(templateId) => `/admin/templates/${templateId}/preview`}
      composerPath={(templateId) => `/admin/invoices/new/${templateId}`}
    />
  );
}
