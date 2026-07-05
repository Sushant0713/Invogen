import { LoginForm } from '@/components/auth/LoginForm';

export default function AdminLogin() {
  return (
    <LoginForm
      portal="admin"
      title="Admin Login"
      subtitle="Sign in to your workspace"
    />
  );
}
