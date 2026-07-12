import { Navigate, useSearchParams } from 'react-router-dom';

export default function EmployeeLogin() {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  next.set('portal', 'employee');
  return <Navigate to={`/login?${next.toString()}`} replace />;
}
