import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler or middleware and forwards any thrown errors/rejected promises
 * to Express's next() error handling pipeline.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
