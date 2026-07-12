import { Navigate } from 'react-router-dom';
import { registerPath } from '@/lib/workspace-portal';

export default function EmployeeRegisterRedirect() {
  return <Navigate to={registerPath('employee')} replace />;
}
