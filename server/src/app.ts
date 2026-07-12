import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { env } from './config/env';
import { errorHandler, notFound } from './middlewares/error.middleware';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import superAdminRoutes from './routes/super-admin.routes';
import adminRoutes from './routes/admin.routes';
import employeeRoutes from './routes/employee.routes';
import webhookRoutes from './routes/webhook.routes';
import uploadRoutes from './routes/upload.routes';
import publicRoutes from './routes/public.routes';
import { enforceMaintenanceMode } from './middlewares/maintenance.middleware';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (env.NODE_ENV === 'development' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      if (origin === env.CLIENT_URL) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
// Templates with multiple pages + image props can exceed a small JSON body limit.
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());
app.use(mongoSanitize());

app.use('/api/v1', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/super-admin', superAdminRoutes);
app.use('/api/v1/admin', enforceMaintenanceMode, adminRoutes);
app.use('/api/v1/employee', enforceMaintenanceMode, employeeRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/uploads', uploadRoutes);
app.use('/api/v1/public', publicRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
