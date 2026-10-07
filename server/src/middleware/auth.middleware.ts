import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../errors/AppError';
import { verifyAccessToken, AccessTokenPayload } from '../utils/security';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Authentication middleware that enforces a valid Bearer JWT access token.
 * Populates req.user with authenticated user identity.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError('Authentication required: Missing Authorization header');
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedError('Authentication required: Invalid Authorization format. Expected Bearer token');
  }

  const payload: AccessTokenPayload = verifyAccessToken(token);

  req.user = {
    id: payload.sub,
    email: payload.email,
  };

  next();
}
