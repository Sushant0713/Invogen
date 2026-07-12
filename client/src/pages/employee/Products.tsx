import { Navigate } from 'react-router-dom';
import { PERMISSIONS } from '@invogen/shared';
import { useAppSelector } from '@/hooks/useAppDispatch';
import { ProductsCrud } from '@/pages/admin/CrudPages';

export default function EmployeeProducts() {
  const permissions = useAppSelector((s) => s.auth.user?.permissions ?? []);
  if (!permissions.includes(PERMISSIONS.PRODUCT_MANAGE)) {
    return <Navigate to="/403" replace />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your company product catalog.</p>
      </div>
      <ProductsCrud endpoint="/employee/products" queryKey="employee-products" />
    </div>
  );
}
