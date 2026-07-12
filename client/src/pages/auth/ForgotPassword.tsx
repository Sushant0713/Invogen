import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AuthPortal, ApiResponse } from '@invogen/shared';
import api from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

const schema = z.object({ email: z.string().email() });

const PORTAL_LABELS: Record<AuthPortal, string> = {
  admin: 'Admin',
  employee: 'Employee',
  'super-admin': 'Super Admin',
};

import { loginPath } from '@/lib/workspace-portal';

function parsePortal(value: string | null): AuthPortal | null {
  if (value === 'admin' || value === 'employee' || value === 'super-admin') {
    return value;
  }
  return null;
}

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const portal = parsePortal(searchParams.get('portal'));
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [previewResetUrl, setPreviewResetUrl] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string }>({ resolver: zodResolver(schema) });

  const portalLabel = portal ? PORTAL_LABELS[portal] : 'Invogen';
  const loginPathTarget =
    portal === 'super-admin'
      ? '/super-admin/login'
      : portal === 'employee'
        ? loginPath('employee')
        : loginPath('admin');

  const onSubmit = async (form: { email: string }) => {
    setLoading(true);
    try {
      const { data: body } = await api.post<ApiResponse<{ resetUrl: string } | null>>(
        '/auth/forgot-password',
        {
          email: form.email,
          ...(portal ? { portal } : {}),
        }
      );
      setSent(true);
      setPreviewResetUrl(body.data?.resetUrl ?? null);
      toast.success('If your email is registered, a reset link has been sent.');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-white to-orange-50 p-8">
      <div className="glass w-full max-w-md p-8">
        <h2 className="text-2xl font-bold text-gray-900">Forgot password</h2>
        <p className="mt-1 text-sm text-gray-500">
          {portal
            ? `Enter your ${portalLabel.toLowerCase()} account email and we will send a reset link.`
            : 'Enter your email and we will send a reset link if an account exists.'}
        </p>

        {sent ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm leading-relaxed text-gray-600">
              Check your inbox for a password reset link. It expires in 1 hour.
            </p>
            {import.meta.env.DEV && previewResetUrl ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Local development link
                </p>
                <p className="mt-2 text-xs text-amber-900">
                  Email clients often hide <code className="rounded bg-amber-100 px-1">localhost</code> links.
                  Use this link on this machine instead:
                </p>
                <a
                  href={previewResetUrl}
                  className="mt-2 block break-all text-sm font-medium text-primary underline"
                >
                  {previewResetUrl}
                </a>
              </div>
            ) : import.meta.env.DEV ? (
              <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                No matching account for this email
                {portal ? ` on the ${portalLabel} portal` : ''}. Check the address and portal, or look
                in the server terminal for a reset link after a successful match.
              </p>
            ) : null}
            <Link
              to={loginPathTarget}
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-lg shadow-primary/25 transition hover:bg-primary-600"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <Input
              label="Email"
              fieldKind="email"
              autoComplete="email"
              {...register('email')}
              error={errors.email?.message}
            />
            <Button type="submit" className="w-full" loading={loading}>
              Send reset link
            </Button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-gray-500">
          <Link to={loginPathTarget} className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
