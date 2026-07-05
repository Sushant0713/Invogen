import { LoginForm } from '@/components/auth/LoginForm';

export default function EmployeeLogin() {
  return (
    <LoginForm
      portal="employee"
      title="Employee Login"
      subtitle="Sign in to your employee account"
    />
  );
}
