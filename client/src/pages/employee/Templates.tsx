import { useNavigate } from 'react-router-dom';
import { TemplateGallery } from '@/features/template-gallery';
import { recordTemplateUse } from '@/features/template-gallery/template-manager';

export default function EmployeeTemplates() {
  const navigate = useNavigate();

  return (
    <TemplateGallery
      apiBase="/employee/templates"
      queryKey="employee-templates"
      editPath="/employee/invoices/create"
      title="Template Gallery"
      subtitle="Browse invoice templates — select one when creating an invoice."
      onOpenTemplate={(templateId) => {
        recordTemplateUse(templateId);
        navigate(`/employee/invoices/create?templateId=${templateId}`);
      }}
      showEdit
    />
  );
}
