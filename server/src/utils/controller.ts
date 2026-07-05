import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { sendSuccess } from '../utils/response';

export const param = (value: string | string[]): string =>
  Array.isArray(value) ? value[0] : value;

export const wrap =
  (fn: (req: AuthRequest) => Promise<unknown>) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await fn(req);
      if (result !== undefined && result !== null) {
        if (typeof result === 'object' && 'data' in result && 'meta' in result) {
          const { data, meta } = result as { data: unknown; meta: unknown };
          return sendSuccess(res, data, 'Success', 200, meta as Parameters<typeof sendSuccess>[4]);
        }
        return sendSuccess(res, result);
      }
      return sendSuccess(res, null);
    } catch (e) {
      next(e);
    }
  };
