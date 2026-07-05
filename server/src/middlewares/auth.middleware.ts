import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '@invogen/shared';
import { verifyAccessToken } from '../utils/tokens';
import { AppError } from '../utils/AppError';
import { User } from '../models';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: UserRole;
    companyId: string | null;
    permissions: string[];
  };
  companyId?: string | null;
}

export const authenticate = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    const user = await User.findById(payload.userId).select('status role companyId permissions');
    if (!user || user.status !== 'active') {
      throw new AppError('User not found or suspended', 401);
    }

    // Prefer live user document over JWT claims (companyId can be stale in old tokens).
    const companyId = user.companyId?.toString() || payload.companyId || null;
    req.user = {
      userId: user._id.toString(),
      role: user.role,
      companyId,
      permissions: Array.isArray(user.permissions) ? user.permissions : payload.permissions || [],
    };
    req.companyId = companyId;
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    next(new AppError('Invalid or expired token', 401));
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('Access denied', 403));
    }
    next();
  };
};

export const requirePermission = (...permissions: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Authentication required', 401));
    if (req.user.role === UserRole.SUPER_ADMIN || req.user.role === UserRole.ADMIN) {
      return next();
    }
    const hasPermission = permissions.some((p) => req.user!.permissions.includes(p));
    if (!hasPermission) {
      return next(new AppError('Insufficient permissions', 403));
    }
    next();
  };
};

export const resolveTenant = (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError('Authentication required', 401));
  if (req.user.role === UserRole.SUPER_ADMIN) {
    req.companyId = (req.query.companyId as string) || null;
  } else {
    req.companyId = req.user.companyId;
  }
  next();
};
