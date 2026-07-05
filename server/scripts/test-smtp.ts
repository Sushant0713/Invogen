import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const host = process.env.SMTP_HOST || 'localhost';
const port = Number(process.env.SMTP_PORT || 1025);
const secure =
  process.env.SMTP_SECURE === 'true' ||
  process.env.SMTP_SECURE === '1' ||
  port === 465;

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

(async () => {
  try {
    await transporter.verify();
    console.log('SMTP verify OK', { host, port, secure, user: process.env.SMTP_USER });
  } catch (err) {
    console.error('SMTP verify FAILED:', err);
    process.exit(1);
  }
})();
