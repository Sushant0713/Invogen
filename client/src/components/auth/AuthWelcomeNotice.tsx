import { Mail, PartyPopper, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';

type AuthWelcomeNoticeVariant = 'registered' | 'verified';

interface AuthWelcomeNoticeProps {
  variant: AuthWelcomeNoticeVariant;
  email?: string;
  resending?: boolean;
  onResend?: () => void;
  compact?: boolean;
}

export function AuthWelcomeNotice({
  variant,
  email,
  resending = false,
  onResend,
  compact = false,
}: AuthWelcomeNoticeProps) {
  const isRegistered = variant === 'registered';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 shadow-sm ${
        isRegistered
          ? 'border-primary/20 bg-white/95 text-gray-900'
          : 'border-green-200 bg-green-50 text-green-950'
      } ${compact ? '' : 'backdrop-blur-sm'}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            isRegistered ? 'bg-primary/10 text-primary' : 'bg-green-100 text-green-700'
          }`}
        >
          {isRegistered ? <Mail className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">
              {isRegistered ? 'Welcome to Invogen' : 'Email verified'}
            </h3>
            {isRegistered && <PartyPopper className="h-4 w-4 text-primary" aria-hidden />}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            {isRegistered ? (
              <>
                Your account has been created. We sent a verification email
                {email ? (
                  <>
                    {' '}
                    to <span className="font-medium text-gray-900">{email}</span>
                  </>
                ) : null}
                . Please verify your email before signing in.
              </>
            ) : (
              'Your email is confirmed. You can sign in to your workspace now.'
            )}
          </p>
          {isRegistered && onResend && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              loading={resending}
              onClick={onResend}
            >
              Resend verification email
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
