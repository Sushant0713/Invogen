import { Setting } from '../models';
import { sendEmail } from '../config/mail';
import { env } from '../config/env';
import { AppError } from './AppError';
import { getPlatformNotificationSettings } from '../services/notification.service';

type NotificationSettings = { welcomeEmail?: boolean };
type SecuritySettings = { requireEmailVerification?: boolean };

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const settings = await getPlatformNotificationSettings();
  return { welcomeEmail: settings.welcomeEmail };
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  const row = await Setting.findOne({ key: 'security_settings', scope: 'system' });
  return (row?.value || {}) as SecuritySettings;
}

export function isEmailVerificationRequired(settings: SecuritySettings): boolean {
  return settings.requireEmailVerification !== false;
}

/** Block session/API access for local accounts that have not verified email yet. */
export async function assertEmailVerifiedForSession(user: VerifiableUser): Promise<void> {
  if (user.authProvider === 'google') return;
  if (user.isEmailVerified) return;

  const securitySettings = await getSecuritySettings();
  if (!isEmailVerificationRequired(securitySettings)) return;

  throw new AppError(
    'Please verify your email before signing in. Check your inbox for the verification link.',
    403
  );
}

type VerifiableUser = {
  isEmailVerified?: boolean;
  authProvider?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlAttr(value: string): string {
  return escapeHtml(value);
}

function buildClientAuthUrl(path: string): string {
  const base = env.CLIENT_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function authEmailLayout(params: {
  title: string;
  greeting: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}): string {
  const safeCtaUrl = params.ctaUrl ? escapeHtmlAttr(params.ctaUrl) : '';
  const visibleCtaUrl = params.ctaUrl ? escapeHtml(params.ctaUrl) : '';
  const cta =
    params.ctaLabel && params.ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
          <tr>
            <td align="center" bgcolor="#ff7700" style="border-radius:8px;background:#ff7700;">
              <a href="${safeCtaUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">
                ${escapeHtml(params.ctaLabel)}
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#374151;word-break:break-all;">
          If the button does not work, copy and paste this link into your browser:<br />
          <span style="color:#ea580c;">${visibleCtaUrl}</span>
        </p>`
      : '';

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#ff7700,#ea580c);padding:24px 28px;color:#fff;">
              <div style="font-size:22px;font-weight:700;">Invogen</div>
              <div style="margin-top:6px;font-size:14px;opacity:0.9;">${escapeHtml(params.title)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;color:#111827;line-height:1.6;">
              <p style="margin:0 0 12px;font-size:16px;font-weight:600;">${escapeHtml(params.greeting)}</p>
              <p style="margin:0;color:#374151;">${escapeHtml(params.body)}</p>
              ${cta}
              ${
                params.footer
                  ? `<p style="margin:24px 0 0;font-size:13px;color:#6b7280;">${escapeHtml(params.footer)}</p>`
                  : ''
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(params: {
  to: string;
  firstName: string;
  token: string;
}): Promise<void> {
  const verifyUrl = buildClientAuthUrl(`/verify-email?token=${encodeURIComponent(params.token)}`);
  await sendEmail({
    to: params.to,
    subject: 'Verify your Invogen account',
    html: authEmailLayout({
      title: 'Verify your email',
      greeting: `Hi ${params.firstName},`,
      body:
        'Thanks for signing up for Invogen. Please confirm your email address to activate your account and start creating invoices.',
      ctaLabel: 'Verify email address',
      ctaUrl: verifyUrl,
      footer: 'This link expires in 24 hours. If you did not create an account, you can ignore this email.',
    }),
  });
}

export async function sendWelcomeEmail(params: {
  to: string;
  firstName: string;
}): Promise<void> {
  const loginUrl = buildClientAuthUrl('/admin/login');
  await sendEmail({
    to: params.to,
    subject: 'Welcome to Invogen',
    html: authEmailLayout({
      title: 'Welcome aboard',
      greeting: `Welcome, ${params.firstName}!`,
      body:
        'Your Invogen workspace is ready. Sign in to design invoice templates, manage clients, and send professional invoices.',
      ctaLabel: 'Go to login',
      ctaUrl: loginUrl,
      footer: 'We are glad to have you on board.',
    }),
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  firstName: string;
  resetUrl: string;
}): Promise<void> {
  const text = [
    `Hi ${params.firstName},`,
    '',
    'We received a request to reset your Invogen password.',
    'Open this link to choose a new password:',
    params.resetUrl,
    '',
    'This link expires in 1 hour.',
    'If you did not request a reset, you can ignore this email.',
  ].join('\n');

  await sendEmail({
    to: params.to,
    subject: 'Reset your Invogen password',
    text,
    html: authEmailLayout({
      title: 'Password reset',
      greeting: `Hi ${params.firstName},`,
      body:
        'We received a request to reset your Invogen password. Click the button below to choose a new password.',
      ctaLabel: 'Reset password',
      ctaUrl: params.resetUrl,
      footer: 'This link expires in 1 hour. If you did not request a reset, you can ignore this email.',
    }),
  });
}
