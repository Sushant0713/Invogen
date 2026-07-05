import type { Request, Response, NextFunction } from 'express';
import type { AuthPortal } from '@invogen/shared';
import mongoose from 'mongoose';
import { param } from '../utils/controller';
import { authService } from '../services/auth.service';
import { mediaService } from '../services/media.service';
import { sendSuccess } from '../utils/response';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { isGoogleAuthEnabled } from '../config/google';
import { maintenanceService } from '../services/maintenance.service';

const setRefreshCookie = (res: Response, token: string, remember?: boolean) => {
  const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.register(req.body);
    return sendSuccess(res, { user }, 'Registration successful. Please verify your email.', 201);
  } catch (error) {
    next(error);
  }
};

export const getBranding = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const branding = await authService.getBranding();
    return sendSuccess(res, branding);
  } catch (error) {
    next(error);
  }
};

export const registerLogoUpload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) throw new AppError('No file uploaded', 400);

    const media = await mediaService.saveFile({
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
      size: file.size,
      uploadedBy: new mongoose.Types.ObjectId().toString(),
      companyId: null,
    });

    const id = media._id.toString();
    return sendSuccess(res, {
      id,
      url: `/api/v1/uploads/${id}`,
      filename: media.filename,
      mimetype: media.mimetype,
      size: media.size,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const portal = req.params.portal as AuthPortal;
    const { accessToken, refreshToken, user, subscriptionActive } = await authService.login(portal, req.body, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    setRefreshCookie(res, refreshToken, req.body.remember);
    return sendSuccess(res, { user, accessToken, refreshToken, subscriptionActive });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if (!token) throw new AppError('No refresh token', 401);
    const result = await authService.refresh(token);
    setRefreshCookie(res, result.refreshToken);
    return sendSuccess(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user) await authService.logout(req.user.userId);
    res.clearCookie('refreshToken', { path: '/' });
    return sendSuccess(res, null, 'Logged out');
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await authService.getMe(req.user!.userId);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.verifyEmail(param(req.params.token));
    return sendSuccess(res, { user }, 'Email verified successfully');
  } catch (error) {
    next(error);
  }
};

export const resendVerification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.resendVerification(req.body.email);
    return sendSuccess(res, null, 'Verification email sent');
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.forgotPassword(req.body.email);
    return sendSuccess(res, null, 'If the email exists, a reset link has been sent');
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.resetPassword(param(req.params.token), req.body.password);
    return sendSuccess(res, null, 'Password reset successful');
  } catch (error) {
    next(error);
  }
};

export const getGoogleConfig = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return sendSuccess(res, {
      enabled: isGoogleAuthEnabled(),
      clientId: env.GOOGLE_CLIENT_ID || '',
    });
  } catch (error) {
    next(error);
  }
};

export const getMaintenance = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await maintenanceService.getStatus();
    return sendSuccess(res, status);
  } catch (error) {
    next(error);
  }
};

export const googleRegister = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accessToken, refreshToken, user, subscriptionActive } =
      await authService.registerWithGoogle(req.body);
    setRefreshCookie(res, refreshToken);
    return sendSuccess(
      res,
      { user, accessToken, refreshToken, subscriptionActive },
      'Registration successful',
      201
    );
  } catch (error) {
    next(error);
  }
};

export const googleLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const portal = req.params.portal as AuthPortal;
    const { accessToken, refreshToken, user, subscriptionActive } = await authService.loginWithGoogle(
      portal,
      req.body,
      {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      }
    );
    setRefreshCookie(res, refreshToken, req.body.remember);
    return sendSuccess(res, { user, accessToken, refreshToken, subscriptionActive });
  } catch (error) {
    next(error);
  }
};
