import { LoginForm } from '@/components/auth/LoginForm';

export default function SuperAdminLogin() {
  return (
    <LoginForm
      portal="super-admin"
      title="Super Admin Login"
      subtitle="Platform administration access"
    />
  );
}
