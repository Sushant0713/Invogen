import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { cashfreeService } from './services/cashfree.service';

const start = async () => {
  await connectDB();
  const server = app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
    if (env.NODE_ENV === 'development' && cashfreeService.isConfigured()) {
      cashfreeService.getConnectionStatus().then((status) => {
        if (!status.connected) {
          console.warn('[cashfree] API check failed:', status.message);
        } else {
          console.log('[cashfree] Connected (' + status.environment + ')');
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
