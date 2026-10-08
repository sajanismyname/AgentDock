import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import { helmetMiddleware, corsMiddleware, rateLimiterMiddleware } from './middleware/security';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth.routes';
import { agentRouter } from './routes/agent.routes';
import { runRouter } from './routes/run.routes';
import { testRouter } from './routes/test.routes';
import { protectedExampleRouter } from './routes/protected.routes';

/**
 * Express application factory
 */
export function createApp(): Express {
  const app = express();

  // Basic security headers, CORS, and rate limiting
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(rateLimiterMiddleware);

  // Cookie parser for reading secure HTTP-only refresh tokens
  app.use(cookieParser());

  // Request body parsing with strict 2MB limit (per Design.md MVP limit)
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Health check endpoints
  app.use('/health', healthRouter);
  app.use('/api/health', healthRouter);

  // Authentication endpoints
  app.use('/api/auth', authRouter);

  // Agent, Rules, Tests, and TestRun endpoints
  app.use('/api/agents', agentRouter);
  app.use('/api/runs', runRouter);
  app.use('/api/tests', testRouter);

  // Protected route example
  app.use('/api/protected', protectedExampleRouter);

  // 404 for unknown endpoints
  app.use(notFoundHandler);

  // Centralized error handling
  app.use(errorHandler);

  return app;
}

export const app = createApp();
