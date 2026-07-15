import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

const isDev = process.env.NODE_ENV !== 'production';

dotenv.config({ path: path.resolve(process.cwd(), '../.env'), override: isDev });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: isDev });
dotenv.config({ override: isDev });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  API_PUBLIC_URL: z.string().default('http://localhost:5000/api/v1'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/invogen'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32)
    .default('dev-access-secret-change-in-production-min32'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32)
    .default('dev-refresh-secret-change-in-production-min32'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_REMEMBER_EXPIRES_IN: z.string().default('30d'),
  RAZORPAY_KEY_ID: z
    .string()
    .optional()
    .default('')
    .transform((v) => v.trim()),
  RAZORPAY_KEY_SECRET: z
    .string()
    .optional()
    .default('')
    .transform((v) => v.trim()),
  RAZORPAY_WEBHOOK_SECRET: z
    .string()
    .optional()
    .default('')
    .transform((v) => v.trim()),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.string().default('1025'),
  SMTP_SECURE: z
    .string()
    .optional()
    .default('')
    .transform((v) => ['true', '1', 'yes'].includes(v.toLowerCase())),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().default('Invogen <noreply@invogen.app>'),
  SUPER_ADMIN_EMAIL: z.string().email().default('admin@invogen.app'),
  SUPER_ADMIN_PASSWORD: z.string().min(8).default('Admin@123456'),
  GOOGLE_CLIENT_ID: z
    .string()
    .optional()
    .default('')
    .transform((v) => v.trim()),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
