import { OAuth2Client } from 'google-auth-library';
import { env } from './env';
import { AppError } from '../utils/AppError';

let client: OAuth2Client | null = null;

export function isGoogleAuthEnabled(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID);
}

export function getGoogleClient(): OAuth2Client {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError('Google sign-in is not configured', 503);
  }
  if (!client) {
    client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  }
  return client;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  picture?: string;
}

export async function verifyGoogleIdToken(credential: string): Promise<GoogleProfile> {
  const googleClient = getGoogleClient();
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new AppError('Invalid Google token', 401);
  }
  if (!payload.email_verified) {
    throw new AppError('Google email is not verified', 400);
  }

  const nameParts = (payload.name || '').trim().split(/\s+/).filter(Boolean);

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    firstName: payload.given_name || nameParts[0] || 'User',
    lastName: payload.family_name || nameParts.slice(1).join(' ') || '',
    emailVerified: true,
    picture: payload.picture,
  };
}
