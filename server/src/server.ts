import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { razorpayService } from './services/razorpay.service';
import { backfillMissingCompanyInvoiceCodes } from './utils/company-invoice-code';
import { startSubscriptionExpiryReminderJob } from './jobs/subscription-expiry-reminders';

const start = async () => {
  await connectDB();
  void backfillMissingCompanyInvoiceCodes().then((count) => {
    if (count > 0) {
      console.log(`[invoice-codes] Assigned codes to ${count} companies`);
    }
  });
  startSubscriptionExpiryReminderJob();
  const server = app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
    if (env.NODE_ENV === 'development' && razorpayService.isConfigured()) {
      razorpayService.getConnectionStatus().then((status) => {
        if (!status.connected) {
          console.warn('[razorpay] API check failed:', status.message);
        } else {
          console.log('[razorpay] Connected (' + status.environment + ')');
        }
      });
    }
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${env.PORT} is already in use. Stop the other process or change PORT in .env`);
      process.exit(1);
    }
    throw err;
  });
};

start();
