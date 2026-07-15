import { Router, type Request, type Response, type NextFunction } from 'express';
import express from 'express';
import { razorpayService } from '../services/razorpay.service';
import { env } from '../config/env';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

const router = Router();

router.post(
  '/razorpay',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      const body = req.body.toString();

      if (signature && env.RAZORPAY_WEBHOOK_SECRET) {
        if (!razorpayService.verifyWebhookSignature(body, signature)) {
          throw new AppError('Invalid webhook signature', 400);
        }
      }

      const payload = JSON.parse(body);
      const event = payload.event as string;
      await razorpayService.handleWebhook(event, payload.payload || payload);
      return sendSuccess(res, null, 'Webhook processed');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
