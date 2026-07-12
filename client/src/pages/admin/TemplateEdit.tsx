import { useSubscriptionStatus, adminPlanSyncQueryOptions } from '@/hooks/useAdminSubscription';
import { TemplateEditPage } from '@/features/templates/TemplateEditPage';

export default function AdminTemplateEdit() {
  const { data: subscriptionStatus } = useSubscriptionStatus();
  const planCanAddTemplate = subscriptionStatus
    ? subscriptionStatus.canAddTemplate !== false
    : true;

  return (
    <TemplateEditPage
      apiBase="/admin/templates"
      templatesListPath="/admin/templates"
      queryKey="admin-templates"
      canForkSystemTemplates={planCanAddTemplate}
      planSyncOptions={adminPlanSyncQueryOptions}
    />
  );
}
