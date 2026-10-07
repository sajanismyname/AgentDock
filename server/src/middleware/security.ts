import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { RequestHandler } from 'express';
import { env } from '../config/env';

/**
 * Helmet middleware configuration for HTTP security headers.
 */
export const helmetMiddleware: RequestHandler = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", env.CORS_ORIGIN],
    },
  },
  crossOriginEmbedderPolicy: false,
});

/**
 * CORS middleware configured for allowed client origins.
 */
export const corsMiddleware: RequestHandler = cors({
  origin: env.NODE_ENV === 'production' ? env.CORS_ORIGIN : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
});

/**
 * General API rate limiter to protect infrastructure from abuse.
 */
export const rateLimiterMiddleware: RequestHandler = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
  },
  skip: () => env.NODE_ENV === 'test', // Skip rate limiting during automated tests
});
