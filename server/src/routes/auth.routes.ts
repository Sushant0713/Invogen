import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import {
  register,
  getBranding,
  getAgreements,
  registerLogoUpload,
  login,
  refresh,
  logout,
  getMe,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  getGoogleConfig,
  googleRegister,
  googleLogin,
  getMaintenance,
  registerEmployee,
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  googleRegisterSchema,
  googleLoginSchema,
  employeeRegisterSchema,
} from '../validators/auth.validator';

const router = Router();
const registerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const isDev = env.NODE_ENV === 'development';

/** Session endpoints (refresh, me) — higher cap than sensitive auth. */
const sessionAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 0 : 800,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { success: false, message: 'Too many requests, please try again later' },
});

/** Stricter cap for credential and account-recovery endpoints. */
const sensitiveAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 0 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { success: false, message: 'Too many login attempts, please try again later' },
});

/** Uploads during registration — separate from login attempts. */
const registerUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 0 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { success: false, message: 'Too many upload attempts, please try again later' },
});

// Public read endpoints — no rate limit (polled by SPA; shared IP in dev).
router.get('/branding', getBranding);
router.get('/agreements', getAgreements);
router.get('/maintenance', getMaintenance);
router.get('/google/config', getGoogleConfig);
router.get('/verify-email/:token', verifyEmail);

router.post(
  '/register/upload',
  registerUploadLimiter,
  registerUpload.single('file'),
  registerLogoUpload
);
router.post('/register', sensitiveAuthLimiter, validate(registerSchema), register);
router.post(
  '/register/employee',
  sensitiveAuthLimiter,
  validate(employeeRegisterSchema),
  registerEmployee
);
router.post('/google/register', sensitiveAuthLimiter, validate(googleRegisterSchema), googleRegister);
router.post('/google/login/:portal', sensitiveAuthLimiter, validate(googleLoginSchema), googleLogin);
router.post('/login/:portal', sensitiveAuthLimiter, validate(loginSchema), login);
router.post('/refresh', sessionAuthLimiter, refresh);
router.post('/logout', sessionAuthLimiter, authenticate, logout);
router.get('/me', sessionAuthLimiter, authenticate, getMe);
router.post('/resend-verification', sensitiveAuthLimiter, resendVerification);
router.post('/forgot-password', sensitiveAuthLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password/:token', sensitiveAuthLimiter, validate(resetPasswordSchema), resetPassword);

export default router;
