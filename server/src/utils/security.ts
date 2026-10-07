import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '../errors/AppError';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenVersion: number;
}

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Hash a plain text password using bcrypt with strong salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Compare plain text password against stored bcrypt hash.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Cryptographically hash arbitrary tokens (refresh tokens, reset tokens) using SHA-256
 * so that raw tokens are NEVER stored in the database.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate cryptographically secure random token (hex-encoded).
 */
export function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Sign a short-lived access JWT.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Sign a secure refresh JWT.
 */
export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verify and decode access token. Throws UnauthorizedError on invalid/expired token.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch (error) {
    throw new UnauthorizedError(
      error instanceof jwt.TokenExpiredError ? 'Access token has expired' : 'Invalid access token'
    );
  }
}

/**
 * Verify and decode refresh token. Throws UnauthorizedError on invalid/expired token.
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch (error) {
    throw new UnauthorizedError(
      error instanceof jwt.TokenExpiredError ? 'Refresh token has expired' : 'Invalid refresh token'
    );
  }
}
