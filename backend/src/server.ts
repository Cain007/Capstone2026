import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { prisma } from './lib/prisma.js';
import { authRouter } from './routes/authRoutes.js';
import { categoryRouter } from './routes/categoryRoutes.js';
import { supplierRouter } from './routes/supplierRoutes.js';
import { productRouter } from './routes/productRoutes.js';
import { requireAuth } from './middleware/authMiddleware.js';

const app = express();
const port = Number(process.env.PORT) || 5000;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({ origin: frontendUrl }));
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/categories', requireAuth, categoryRouter);
app.use('/api/suppliers', requireAuth, supplierRouter);
app.use('/api/products', requireAuth, productRouter);

app.use((_request, response) => {
  response.status(404).json({ message: 'Route not found' });
});

const server = app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
