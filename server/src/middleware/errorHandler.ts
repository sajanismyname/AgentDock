import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { env } from '../config/env';

/**
 * 404 Handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
  });
}

/**
 * Centralized error handling middleware.
 * Formats errors consistently and ensures no secrets or sensitive request payloads are leaked.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  // If response headers are already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle known AppError instances
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const formattedIssues = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: formattedIssues,
      },
    });
    return;
  }

  // Safe logging for unexpected errors (do NOT log req.body or headers to prevent leaking credentials)
  if (env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error(`[UnhandledError] ${req.method} ${req.originalUrl}:`, err.message);
    if (env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error(err.stack);
    }
  }

  // Generic 500 fallback
  const isDev = env.NODE_ENV === 'development';
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isDev ? err.message : 'An unexpected error occurred. Please try again later.',
      ...(isDev && err.stack ? { stack: err.stack } : {}),
    },
  });
}
