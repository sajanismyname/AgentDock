import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { env } from '../config/env';
import { UnauthorizedError } from '../errors/AppError';

export const REFRESH_COOKIE_NAME = 'refreshToken';

export function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: (env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  };
}

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    const result = await AuthService.register(email, password);

    // Set secure HTTP-only cookie for refresh token
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  }

  static async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);

    // Set secure HTTP-only cookie for refresh token
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  }

  static async refresh(req: Request, res: Response): Promise<void> {
    // Read from HTTP-only cookie first, fall back to request body
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

    if (!token) {
      throw new UnauthorizedError('Refresh token required');
    }

    const result = await AuthService.refreshTokens(token);

    // Rotate refresh cookie
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

    res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
      },
    });
  }

  static async logout(req: Request, res: Response): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

    if (token) {
      await AuthService.logout(token);
    }

    // Clear HTTP-only cookie
    res.clearCookie(REFRESH_COOKIE_NAME, {
      ...getRefreshCookieOptions(),
      maxAge: 0,
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }

  static async forgotPassword(req: Request, res: Response): Promise<void> {
    const { email } = req.body;
    const result = await AuthService.requestPasswordReset(email);

    res.status(200).json({
      success: true,
      message: 'If an account exists with this email address, password reset instructions have been generated.',
      ...(result.resetToken ? { resetToken: result.resetToken } : {}),
    });
  }

  static async resetPassword(req: Request, res: Response): Promise<void> {
    const { token, newPassword } = req.body;
    await AuthService.resetPassword(token, newPassword);

    // Clear any existing refresh cookie
    res.clearCookie(REFRESH_COOKIE_NAME, {
      ...getRefreshCookieOptions(),
      maxAge: 0,
    });

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    });
  }

  static async getMe(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError('Unauthorized');
    }

    const user = await AuthService.getUserProfile(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  }

  static async deleteAccount(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError('Unauthorized');
    }

    await AuthService.deleteAccount(req.user.id);

    // Clear HTTP-only cookie
    res.clearCookie(REFRESH_COOKIE_NAME, {
      ...getRefreshCookieOptions(),
      maxAge: 0,
    });

    res.status(200).json({
      success: true,
      message: 'Account and associated data deleted successfully',
    });
  }
}
