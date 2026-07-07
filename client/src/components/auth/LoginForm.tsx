import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import type { AuthPortal } from '@invogen/shared';
import api from '@/api/client';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setCredentials } from '@/store/slices/authSlice';
import { getDashboardPath } from '@/config/navigation';
import { getReturnPath } from '@/lib/auth-session';
import { rehydrateUserLocalPreferences } from '@/lib/user-preferences';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { useMaintenanceStatus } from '@/hooks/useMaintenanceStatus';
import { toast } from 'sonner';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

interface LoginFormProps {
  portal: AuthPortal;
  title: string;
  subtitle: string;
}

export function LoginForm({ portal, title, subtitle }: LoginFormProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { data: maintenance } = useMaintenanceStatus();
  const maintenanceBlocked =
    maintenance?.enabled && (portal === 'admin' || portal === 'employee');

  useEffect(() => {
    if (searchParams.get('expired') === '1') {
      toast.error('Your session expired. Please sign in again.');
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login/' + portal, data);
      const { user, accessToken, refreshToken, subscriptionActive } = res.data.data;
      dispatch(setCredentials({ user, accessToken, refreshToken }));
      rehydrateUserLocalPreferences();
      toast.success('Welcome back!');
      const returnPath =
        getReturnPath(searchParams.toString(), '') ||
        (location.state as { from?: { pathname?: string } })?.from?.pathname ||
        '';

      if (portal === 'admin' && subscriptionActive === false) {
        navigate(returnPath.startsWith('/admin') ? returnPath : '/admin/subscription/plans');
      } else {
        navigate(returnPath || getDashboardPath(user.role));
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    if (portal !== 'admin') return;
    setGoogleLoading(true);
    try {
      const res = await api.post('/auth/google/login/' + portal, { credential });
      const { user, accessToken, refreshToken, subscriptionActive } = res.data.data;
      dispatch(setCredentials({ user, accessToken, refreshToken }));
      rehydrateUserLocalPreferences();
      toast.success('Welcome back!');
      const returnPath =
        getReturnPath(searchParams.toString(), '') ||
        (location.state as { from?: { pathname?: string } })?.from?.pathname ||
        '';

      if (subscriptionActive === false) {
        navigate(returnPath.startsWith('/admin') ? returnPath : '/admin/subscription/plans');
      } else {
        navigate(returnPath || getDashboardPath(user.role));
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary-700 items-center justify-center p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-white max-w-md"
        >
          <h1 className="text-4xl font-bold mb-4">Invogen</h1>
          <p className="text-primary-100 text-lg">
            Premium invoice builder for modern businesses. Create, customize, and send professional invoices.
          </p>
        </motion.div>
      </div>
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <div className="glass p-8">
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            {maintenanceBlocked && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {maintenance?.message}
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
              <Input
                label="Email"
                fieldKind="email"
                {...register('email')}
                error={errors.email?.message}
              />
              <Input
                label="Password"
                fieldKind="password"
                {...register('password')}
                error={errors.password?.message}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...register('remember')} className="rounded" />
                  Remember me
                </label>
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Button
                type="submit"
                className="w-full"
                loading={loading}
                disabled={googleLoading || maintenanceBlocked}
              >
                Sign In
              </Button>
            </form>
            {portal === 'admin' && (
              <>
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-400">or</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
                <GoogleSignInButton
                  mode="signin"
                  onCredential={handleGoogleCredential}
                  disabled={loading || googleLoading || maintenanceBlocked}
                />
              </>
            )}
            {portal === 'admin' && (
              <p className="mt-4 text-center text-sm text-gray-500">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary font-medium hover:underline">
                  Register
                </Link>
              </p>
            )}
            <p className="mt-4 text-center text-sm text-gray-400">
              <Link to="/" className="hover:text-primary">Back to home</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
