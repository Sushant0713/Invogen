import { Router } from 'express';
import multer from 'multer';
import {
  register,
  getBranding,
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
} from '../validators/auth.validator';

const router = Router();
const registerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.get('/branding', getBranding);
router.get('/maintenance', getMaintenance);
router.get('/google/config', getGoogleConfig);
router.post('/register/upload', registerUpload.single('file'), registerLogoUpload);
router.post('/register', validate(registerSchema), register);
router.post('/google/register', validate(googleRegisterSchema), googleRegister);
router.post('/google/login/:portal', validate(googleLoginSchema), googleLogin);
router.post('/login/:portal', validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password/:token', validate(resetPasswordSchema), resetPassword);

export default router;
