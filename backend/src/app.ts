import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { BackendEnvironment } from './config/env.js';
import { requireAuth } from './middleware/authMiddleware.js';
import { CorsOriginError, errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/authRoutes.js';
import { auditRouter } from './routes/auditRoutes.js';
import { categoryRouter } from './routes/categoryRoutes.js';
import { dashboardRouter } from './routes/dashboardRoutes.js';
import { forecastRouter } from './routes/forecastRoutes.js';
import { inventoryRouter } from './routes/inventoryRoutes.js';
import { productRouter } from './routes/productRoutes.js';
import { purchaseOrderRouter } from './routes/purchaseOrderRoutes.js';
import { reportRouter } from './routes/reportRoutes.js';
import { salesRouter } from './routes/salesRoutes.js';
import { securityRouter } from './routes/securityRoutes.js';
import { supplierRouter } from './routes/supplierRoutes.js';
import { userRouter } from './routes/userRoutes.js';

export function createApp(environment: BackendEnvironment) {
  const app = express();

  app.set('trust proxy', environment.trustProxy);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origin === environment.frontendOrigin) {
          callback(null, true);
          return;
        }
        callback(new CorsOriginError());
      },
    }),
  );
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/categories', requireAuth, categoryRouter);
  app.use('/api/suppliers', requireAuth, supplierRouter);
  app.use('/api/products', requireAuth, productRouter);
  app.use('/api/users', userRouter);
  app.use('/api/inventory', requireAuth, inventoryRouter);
  app.use('/api/sales', requireAuth, salesRouter);
  app.use('/api/forecasts', requireAuth, forecastRouter);
  app.use('/api/purchase-orders', requireAuth, purchaseOrderRouter);
  app.use('/api/audit-events', requireAuth, auditRouter);
  app.use('/api/security', requireAuth, securityRouter);
  app.use('/api/dashboard', requireAuth, dashboardRouter);
  app.use('/api/reports', requireAuth, reportRouter);

  app.use((_request, response) => {
    response.status(404).json({ message: 'Route not found' });
  });
  app.use(errorHandler);

  return app;
}
