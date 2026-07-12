import api from '@/api/client';

type VerifyEmailResult = {
  email?: string;
};

const inFlight = new Map<string, Promise<VerifyEmailResult>>();

/** Deduplicate verify requests (React StrictMode runs effects twice). */
export function verifyEmailToken(token: string): Promise<VerifyEmailResult> {
  const existing = inFlight.get(token);
  if (existing) return existing;

  const promise = api
    .get(`/auth/verify-email/${token}`)
    .then((res) => {
      const email = res.data?.data?.user?.email;
      return { email: typeof email === 'string' ? email : undefined };
    })
    .finally(() => {
      inFlight.delete(token);
    });

  inFlight.set(token, promise);
  return promise;
}
