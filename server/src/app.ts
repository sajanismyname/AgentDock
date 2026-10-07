import express, { Express } from 'express';
import { helmetMiddleware, corsMiddleware, rateLimiterMiddleware } from './middleware/security';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health';

/**
 * Express application factory
 */
export function createApp(): Express {
  const app = express();

  // Basic security and parsing middlewares
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(rateLimiterMiddleware);

  // Request body parsing with strict 2MB limit (per Design.md MVP limit)
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Health check endpoints
  app.use('/health', healthRouter);
  app.use('/api/health', healthRouter);

  // 404 for unknown endpoints
  app.use(notFoundHandler);

  // Centralized error handling
  app.use(errorHandler);

  return app;
}

export const app = createApp();
