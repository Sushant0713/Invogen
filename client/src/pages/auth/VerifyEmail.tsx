import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Mail, XCircle } from 'lucide-react';
import api from '@/api/client';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { clearSession } from '@/lib/auth-session';
import { verifyEmailToken } from '@/lib/verify-email-api';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { logout as logoutAction } from '@/store/slices/authSlice';
import { loginPath } from '@/lib/workspace-portal';

type VerifyStatus = 'loading' | 'success' | 'error';

function VerificationLoadingEffect() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-white to-orange-50 p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass w-full max-w-md p-10 text-center"
      >
        <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-primary/15"
            animate={{ rotate: 360 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute inset-2 rounded-full border-4 border-primary border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Mail className="h-7 w-7" />
          </motion.div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900">Verifying your email</h2>
        <p className="mt-2 text-sm text-gray-600">
          Please wait while we confirm your account.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2">
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              className="h-2.5 w-2.5 rounded-full bg-primary"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: index * 0.18,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default function VerifyEmail() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<VerifyStatus>('loading');
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    clearSession();
    dispatch(logoutAction());
  }, [dispatch]);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    let cancelled = false;
    let redirectTimer: number | undefined;

    verifyEmailToken(token)
      .then(({ email: verifiedEmail }) => {
        if (cancelled) return;
        if (verifiedEmail) setEmail(verifiedEmail);
        setStatus('success');
        redirectTimer = window.setTimeout(() => {
          const next = new URLSearchParams({ verified: '1' });
          if (verifiedEmail) next.set('email', verifiedEmail);
          navigate(loginPath('admin', Object.fromEntries(next.entries())), { replace: true });
        }, 2200);
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [token, navigate]);

  const handleResend = async () => {
    if (!email.trim()) return;
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email: email.trim() });
      toast.success('Verification email sent. Please check your inbox.');
    } finally {
      setResending(false);
    }
  };

  if (status === 'loading') return <VerificationLoadingEffect />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-white to-orange-50 p-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass w-full max-w-md p-8 text-center"
      >
        {status === 'success' ? (
          <>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600"
            >
              <CheckCircle2 className="h-9 w-9" />
            </motion.div>
            <h2 className="text-2xl font-bold text-green-700">Email verified</h2>
            <p className="mt-2 text-gray-600">Redirecting you to sign in…</p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
              <XCircle className="h-9 w-9" />
            </div>
            <h2 className="text-2xl font-bold text-red-600">Verification failed</h2>
            <p className="mt-2 text-gray-600">
              The link may be invalid or expired. Request a new verification email from the login page.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link to={loginPath('admin', { registered: '1' })}>
                <Button className="w-full">Back to login</Button>
              </Link>
              {email ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  loading={resending}
                  onClick={() => void handleResend()}
                >
                  Resend verification email
                </Button>
              ) : null}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
