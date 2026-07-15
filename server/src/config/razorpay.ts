import dotenv from 'dotenv';
import path from 'path';
import { env } from './env';

const rootEnvPath = path.resolve(process.cwd(), '../.env');
const localEnvPath = path.resolve(process.cwd(), '.env');

export type RazorpayEnvironment = 'test' | 'live';

export function readRazorpayCredentials(): {
  keyId: string;
  keySecret: string;
  environment: RazorpayEnvironment;
} {
  if (env.NODE_ENV === 'development') {
    dotenv.config({ path: rootEnvPath, override: true });
    dotenv.config({ path: localEnvPath, override: true });
  }

  const keyId = (process.env.RAZORPAY_KEY_ID || env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || env.RAZORPAY_KEY_SECRET || '').trim();
  const environment: RazorpayEnvironment = keyId.startsWith('rzp_live_') ? 'live' : 'test';
  return { keyId, keySecret, environment };
}

export function buildRazorpayReceipt(prefix: string) {
  const id = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return id.slice(0, 40);
}
