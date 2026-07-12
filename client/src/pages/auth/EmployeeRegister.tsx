import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { loginPath } from '@/lib/workspace-portal';
import { toast } from 'sonner';

const schema = z
  .object({
    joinCode: z.string().min(6, 'Company join code is required'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export function EmployeeRegisterForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/register/employee', data);
      const requiresApproval = res.data.data?.requiresApproval === true;
      toast.success(
        requiresApproval
          ? 'Registration submitted. An admin will review your request.'
          : 'Registration successful. You can sign in now.',
      );
      navigate(loginPath('employee'));
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Join your company</h2>
      <p className="mt-1 text-sm text-gray-500">
        Enter your company join code and account details. Your admin will approve access.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <Input
          label="Company join code"
          placeholder="Ask your admin for the code"
          {...register('joinCode')}
          error={errors.joinCode?.message}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            {...register('firstName')}
            error={errors.firstName?.message}
          />
          <Input
            label="Last name"
            {...register('lastName')}
            error={errors.lastName?.message}
          />
        </div>
        <Input
          label="Work email"
          fieldKind="email"
          {...register('email')}
          error={errors.email?.message}
        />
        <Input
          label="Password"
          fieldKind="password-new"
          {...register('password')}
          error={errors.password?.message}
        />
        <Input
          label="Confirm password"
          fieldKind="password-confirm"
          {...register('confirmPassword')}
          error={errors.confirmPassword?.message}
        />
        <Button type="submit" className="w-full" loading={loading}>
          Create employee account
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to={loginPath('employee')} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function EmployeeRegisterPage() {
  return <EmployeeRegisterForm />;
}
