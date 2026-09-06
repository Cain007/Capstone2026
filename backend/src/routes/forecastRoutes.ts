import { Router } from 'express';
import {
  generateProductForecast,
  getLatestProductForecastEvaluation,
  getProductForecastInsights,
  getLatestProductForecast,
} from '../controllers/forecastController.js';
import { requireRole } from '../middleware/authMiddleware.js';

export const forecastRouter = Router();

forecastRouter.use(requireRole('Admin'));
forecastRouter.post('/products/:productId/generate', generateProductForecast);
forecastRouter.get('/products/:productId/evaluation/latest', getLatestProductForecastEvaluation);
forecastRouter.get('/products/:productId/insights', getProductForecastInsights);
forecastRouter.get('/products/:productId/latest', getLatestProductForecast);
