import type { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';

export const healthCheck = (_req: Request, res: Response, _next: NextFunction) => {
  return sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'invogen-api',
  });
};
