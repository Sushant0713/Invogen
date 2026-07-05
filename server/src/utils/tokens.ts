import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import type { JwtPayload } from '@invogen/shared';

const accessTokenExpiresIn =
  env.NODE_ENV === 'development' ? '24h' : env.JWT_ACCESS_EXPIRES_IN;

export const generateAccessToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: accessTokenExpiresIn,
  } as jwt.SignOptions);
};

export const generateRefreshToken = (userId: string, remember = false): string => {
  const expiresIn = remember
    ? env.JWT_REFRESH_REMEMBER_EXPIRES_IN
    : env.JWT_REFRESH_EXPIRES_IN;
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn } as jwt.SignOptions);
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
};

export const verifyRefreshToken = (token: string): { userId: string } => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string };
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const generateRandomToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};
