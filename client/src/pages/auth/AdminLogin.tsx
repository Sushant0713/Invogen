import { Navigate, useSearchParams } from 'react-router-dom';

export default function AdminLogin() {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  next.set('portal', 'admin');
  return <Navigate to={`/login?${next.toString()}`} replace />;
}
