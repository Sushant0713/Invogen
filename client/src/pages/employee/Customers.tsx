import { Navigate } from 'react-router-dom';
import { PERMISSIONS } from '@invogen/shared';
import { useAppSelector } from '@/hooks/useAppDispatch';
import { CustomersCrud } from '@/pages/admin/CrudPages';

export default function EmployeeCustomers() {
  const permissions = useAppSelector((s) => s.auth.user?.permissions ?? []);
  if (!permissions.includes(PERMISSIONS.CUSTOMER_MANAGE)) {
    return <Navigate to="/403" replace />;
  }

  const canViewInvoices = permissions.includes(PERMISSIONS.INVOICE_VIEW);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your company customer list.</p>
      </div>
      <CustomersCrud
        endpoint="/employee/customers"
        queryKey="employee-customers"
        invoicesPathPrefix={canViewInvoices ? '/employee/invoices' : undefined}
      />
    </div>
  );
}
