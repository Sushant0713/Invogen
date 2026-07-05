import nodemailer from 'nodemailer';
import { env } from './env';

const smtpPort = Number(env.SMTP_PORT);
const smtpSecure = env.SMTP_SECURE || smtpPort === 465;

export function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_USER?.trim() && env.SMTP_HOST && env.SMTP_HOST !== 'localhost');
}

export const mailTransporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: smtpPort,
  secure: smtpSecure,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  ...(smtpSecure
    ? {}
    : {
        requireTLS: smtpPort === 587,
        tls: { minVersion: 'TLSv1.2' as const },
      }),
});

export const sendEmail = async (options: {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}): Promise<void> => {
  if (!isSmtpConfigured()) {
    if (env.NODE_ENV === 'development') {
      console.warn('[mail] SMTP not configured — skipping send in development');
      console.warn(`  To: ${options.to}`);
      console.warn(`  Subject: ${options.subject}`);
      const linkMatch = options.html.match(/href="([^"]+)"/);
      if (linkMatch) console.warn(`  Link: ${linkMatch[1]}`);
      return;
    }
    throw new Error('SMTP is not configured');
  }

  try {
    const info = await mailTransporter.sendMail({
      from: env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments?.map((file) => ({
        filename: file.filename,
        content: file.content,
        contentType: file.contentType || 'application/octet-stream',
      })),
    });
    console.log(`[mail] Sent to ${options.to}: ${options.subject} (${info.messageId || 'ok'})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[mail] SMTP send failed:', message);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    throw error;
  }
};
