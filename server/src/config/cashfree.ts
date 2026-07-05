import dotenv from 'dotenv';
import path from 'path';
import { env } from './env';

const rootEnvPath = path.resolve(process.cwd(), '../.env');
const localEnvPath = path.resolve(process.cwd(), '.env');

export type CashfreeEnvironment = 'sandbox' | 'production';

export function readCashfreeCredentials(): {
  appId: string;
  secretKey: string;
  environment: CashfreeEnvironment;
} {
  if (env.NODE_ENV === 'development') {
    dotenv.config({ path: rootEnvPath, override: true });
    dotenv.config({ path: localEnvPath, override: true });
  }

  const appId = (process.env.CASHFREE_APP_ID || env.CASHFREE_APP_ID || '').trim();
  const secretKey = (process.env.CASHFREE_SECRET_KEY || env.CASHFREE_SECRET_KEY || '').trim();
  const cfEnv = (process.env.CASHFREE_ENV || env.CASHFREE_ENV || 'sandbox').trim();
  const environment: CashfreeEnvironment = cfEnv === 'production' ? 'production' : 'sandbox';
  return { appId, secretKey, environment };
}

export function getCashfreeBaseUrl(environment: CashfreeEnvironment) {
  return environment === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
}

export function buildCashfreeOrderId(prefix: string) {
  const id = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return id.slice(0, 45);
}
