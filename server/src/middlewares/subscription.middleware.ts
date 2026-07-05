import type { Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { subscriptionService } from '../services/subscription.service';
import type { AuthRequest } from './auth.middleware';

const SUBSCRIPTION_EXEMPT = new Set([
  '/plans',
  '/subscription',
  '/subscription/quote',
  '/subscription/payment-config',
  '/subscription/status',
  '/subscription/validate-discount',
  '/subscription/checkout',
  '/subscription/verify',
  '/subscription/select',
]);

export const requireActiveSubscription = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!req.companyId) return next(new AppError('Company not found', 400));
    if (SUBSCRIPTION_EXEMPT.has(req.path)) return next();

    const active = await subscriptionService.isCompanySubscriptionActive(req.companyId);
    if (!active) {
      return next(new AppError('Active subscription required. Please choose a plan.', 402));
    }
    next();
  } catch (error) {
    next(error);
  }
};
