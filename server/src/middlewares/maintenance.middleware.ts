import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '@invogen/shared';
import { verifyAccessToken } from '../utils/tokens';
import { AppError } from '../utils/AppError';
import { maintenanceService } from '../services/maintenance.service';

export const enforceMaintenanceMode = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const status = await maintenanceService.getStatus();
    if (!status.enabled) return next();

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = verifyAccessToken(authHeader.split(' ')[1]);
        if (payload.role === UserRole.SUPER_ADMIN) return next();
      } catch {
        // fall through to maintenance block
      }
    }

    throw new AppError(status.message, 503);
  } catch (error) {
    next(error);
  }
};
