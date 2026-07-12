import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AuthPortal } from '@invogen/shared';
import api from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { loginPath as buildLoginPath } from '@/lib/workspace-portal';

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

function resolveLoginPath(portal: AuthPortal | null): string {
  if (portal === 'super-admin') return '/super-admin/login';
  if (portal === 'employee') return buildLoginPath('employee');
  return buildLoginPath('admin');
}

function parsePortal(value: string | null): AuthPortal | null {
  if (value === 'admin' || value === 'employee' || value === 'super-admin') {
    return value;
  }
  return null;
}

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const portal = parsePortal(params.get('portal'));
  const loginPathTarget = resolveLoginPath(portal);
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    if (!token) return;
    setLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password: data.password });
      toast.success('Password reset successful. You can sign in now.');
      navigate(loginPathTarget);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="glass w-full max-w-md p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Invalid reset link</h2>
          <p className="mt-3 text-sm text-gray-600">
            This password reset link is missing or invalid. Request a new one from the sign-in page.
          </p>
          <Link
            to={`/forgot-password${portal ? `?portal=${portal}` : ''}`}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-lg shadow-primary/25 transition hover:bg-primary-600"
          >
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-white to-orange-50 p-8">
      <div className="glass w-full max-w-md p-8">
        <h2 className="text-2xl font-bold text-gray-900">Reset password</h2>
        <p className="mt-1 text-sm text-gray-500">Choose a new password for your account.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <Input
            label="New password"
            fieldKind="password-new"
            autoComplete="new-password"
            {...register('password')}
            error={errors.password?.message}
          />
          <Input
            label="Confirm password"
            fieldKind="password-new"
            autoComplete="new-password"
            {...register('confirmPassword')}
            error={errors.confirmPassword?.message}
          />
          <Button type="submit" className="w-full" loading={loading}>
            Reset password
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          <Link to={loginPathTarget} className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
