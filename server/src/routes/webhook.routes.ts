import { Router, type Request, type Response, type NextFunction } from 'express';
import express from 'express';
import { cashfreeService } from '../services/cashfree.service';
import { env } from '../config/env';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

const router = Router();

router.post(
  '/cashfree',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['x-webhook-signature'] as string;
      const timestamp = req.headers['x-webhook-timestamp'] as string;
      const body = req.body.toString();

      if (signature && timestamp && env.CASHFREE_WEBHOOK_SECRET) {
        if (!cashfreeService.verifyWebhookSignature(body, signature, timestamp)) {
          throw new AppError('Invalid webhook signature', 400);
        }
      }

      const payload = JSON.parse(body);
      const event = payload.type || payload.event;
      await cashfreeService.handleWebhook(event, payload.data || payload);
      return sendSuccess(res, null, 'Webhook processed');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
