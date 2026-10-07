import { AppDataSource } from '../config/data-source';
import { User, UserResponseDto } from '../entities/User';
import { ConflictError, UnauthorizedError, BadRequestError, NotFoundError } from '../errors/AppError';
import {
  hashPassword,
  comparePassword,
  hashToken,
  generateRandomToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  RefreshTokenPayload,
} from '../utils/security';
import { env } from '../config/env';

export interface AuthTokensResult {
  user: UserResponseDto;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private static getUserRepository() {
    return AppDataSource.getRepository(User);
  }

  /**
   * Register a new user account.
   */
  static async register(email: string, password: string): Promise<AuthTokensResult> {
    const userRepository = this.getUserRepository();

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await userRepository.findOne({ where: { email: normalizedEmail } });

    if (existing) {
      throw new ConflictError('An account with this email address already exists');
    }

    const hashedPassword = await hashPassword(password);

    const user = userRepository.create({
      email: normalizedEmail,
      passwordHash: hashedPassword,
      tokenVersion: 0,
      refreshTokenHash: null,
    });

    await userRepository.save(user);

    // Generate tokens
    const accessToken = signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = signRefreshToken({ sub: user.id, tokenVersion: user.tokenVersion });

    // Store hash of refresh token
    user.refreshTokenHash = hashToken(refreshToken);
    await userRepository.save(user);

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Authenticate user with email and password.
   */
  static async login(email: string, password: string): Promise<AuthTokensResult> {
    const userRepository = this.getUserRepository();
    const normalizedEmail = email.trim().toLowerCase();

    // Explicitly select hidden passwordHash column
    const user = await userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: normalizedEmail })
      .getOne();

    if (!user) {
      // Use uniform error message to prevent user enumeration
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate new tokens
    const accessToken = signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = signRefreshToken({ sub: user.id, tokenVersion: user.tokenVersion });

    // Save active refresh token hash
    user.refreshTokenHash = hashToken(refreshToken);
    await userRepository.save(user);

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Rotate and issue new access & refresh tokens using an active refresh token.
   */
  static async refreshTokens(rawRefreshToken: string): Promise<RefreshResult> {
    if (!rawRefreshToken) {
      throw new UnauthorizedError('Refresh token required');
    }

    const payload: RefreshTokenPayload = verifyRefreshToken(rawRefreshToken);
    const userRepository = this.getUserRepository();

    const user = await userRepository
      .createQueryBuilder('user')
      .addSelect('user.refreshTokenHash')
      .where('user.id = :id', { id: payload.sub })
      .getOne();

    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedError('Refresh token session has been invalidated');
    }

    const incomingHash = hashToken(rawRefreshToken);
    if (!user.refreshTokenHash || user.refreshTokenHash !== incomingHash) {
      throw new UnauthorizedError('Refresh token revoked or invalid');
    }

    // Rotate refresh token
    const newAccessToken = signAccessToken({ sub: user.id, email: user.email });
    const newRefreshToken = signRefreshToken({ sub: user.id, tokenVersion: user.tokenVersion });

    user.refreshTokenHash = hashToken(newRefreshToken);
    await userRepository.save(user);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Log out user: revokes stored refresh token in DB.
   */
  static async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }

    try {
      const payload: RefreshTokenPayload = verifyRefreshToken(rawRefreshToken);
      const userRepository = this.getUserRepository();
      await userRepository.update({ id: payload.sub }, { refreshTokenHash: null });
    } catch {
      // Silent error: on invalid token logout still completes safely
    }
  }

  /**
   * Password reset request foundation: generates a single-use token and records expiration.
   */
  static async requestPasswordReset(email: string): Promise<{ resetToken?: string }> {
    const userRepository = this.getUserRepository();
    const normalizedEmail = email.trim().toLowerCase();

    const user = await userRepository.findOne({ where: { email: normalizedEmail } });
    if (!user) {
      // Return successfully to prevent email enumeration
      return {};
    }

    const rawToken = generateRandomToken(32);
    user.passwordResetTokenHash = hashToken(rawToken);
    user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity

    await userRepository.save(user);

    // In development/test mode, return token to facilitate testing
    return env.NODE_ENV !== 'production' ? { resetToken: rawToken } : {};
  }

  /**
   * Complete password reset using token.
   */
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    const userRepository = this.getUserRepository();
    const tokenHash = hashToken(token);

    const user = await userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordResetTokenHash')
      .where('user.password_reset_token_hash = :tokenHash', { tokenHash })
      .andWhere('user.password_reset_expires_at > :now', { now: new Date() })
      .getOne();

    if (!user) {
      throw new BadRequestError('Invalid or expired password reset token');
    }

    user.passwordHash = await hashPassword(newPassword);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    user.refreshTokenHash = null;
    user.tokenVersion += 1; // Invalidate all prior refresh tokens

    await userRepository.save(user);
  }

  /**
   * Fetch user profile.
   */
  static async getUserProfile(userId: string): Promise<UserResponseDto> {
    const userRepository = this.getUserRepository();
    const user = await userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user.toJSON();
  }
}
