import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { AppDataSource } from '../src/config/data-source';
import { User } from '../src/entities/User';
import { REFRESH_COOKIE_NAME } from '../src/controllers/auth.controller';

describe('Authentication Integration Tests', () => {
  const app = createApp();
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let accessToken: string;
  let refreshCookie: string;

  beforeAll(async () => {
    try {
      await connectDatabase();
    } catch (err) {
      console.error('Error connecting to database in beforeAll:', err);
      throw err;
    }
  });

  afterAll(async () => {
    // Clean up test users
    if (AppDataSource.isInitialized) {
      const userRepository = AppDataSource.getRepository(User);
      await userRepository.delete({ email: testEmail });
      await userRepository
        .createQueryBuilder()
        .delete()
        .where('email LIKE :pattern', { pattern: 'test_%@example.com' })
        .execute();
      await disconnectDatabase();
    }
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully and set HTTP-only refresh cookie', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.body.data.user.id).toBeDefined();
      // Ensure sensitive fields are NEVER exposed
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.refreshTokenHash).toBeUndefined();
      expect(res.body.data.accessToken).toBeDefined();

      // Ensure HTTP-only refresh token cookie is set
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.includes(`${REFRESH_COOKIE_NAME}=`) && c.includes('HttpOnly'))).toBe(true);

      accessToken = res.body.data.accessToken;
      refreshCookie = cookies.find((c) => c.includes(`${REFRESH_COOKIE_NAME}=`))!;
    });

    it('should reject registration with duplicate email with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should reject registration with invalid email or weak password with 422', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'invalid-email', password: 'short' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials and return access token + refresh cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.body.data.user.passwordHash).toBeUndefined();

      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.includes(`${REFRESH_COOKIE_NAME}=`) && c.includes('HttpOnly'))).toBe(true);

      accessToken = res.body.data.accessToken;
      refreshCookie = cookies.find((c) => c.includes(`${REFRESH_COOKIE_NAME}=`))!;
    });

    it('should reject login with wrong password with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'WrongPassword999!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('should reject login with non-existent email with uniform 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'AnyPassword123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid email or password');
    });
  });

  describe('Protected Routes & requireAuth Middleware', () => {
    it('should grant access to /api/auth/me with valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('should grant access to /api/protected/example with valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/protected/example')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.authenticatedUser.email).toBe(testEmail);
    });

    it('should deny access when Authorization header is missing with 401', async () => {
      const res = await request(app).get('/api/protected/example');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should deny access with invalid or malformed Bearer token with 401', async () => {
      const res = await request(app)
        .get('/api/protected/example')
        .set('Authorization', 'Bearer invalid.token.payload');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should rotate tokens and return new access token with valid refresh cookie', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();

      const newCookies = res.headers['set-cookie'] as unknown as string[];
      expect(newCookies.some((c) => c.includes(`${REFRESH_COOKIE_NAME}=`))).toBe(true);

      // Update stored tokens
      accessToken = res.body.data.accessToken;
      refreshCookie = newCookies.find((c) => c.includes(`${REFRESH_COOKIE_NAME}=`))!;
    });

    it('should reject refresh without refresh token with 401', async () => {
      const res = await request(app).post('/api/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should log out, clear refresh cookie, and revoke the refresh token in database', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [refreshCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Refresh with the old cookie must now fail because token was revoked in DB
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [refreshCookie]);

      expect(refreshRes.status).toBe(401);
      expect(refreshRes.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Password Reset Foundation Flow', () => {
    it('should request reset, reset password, and authenticate with new password', async () => {
      // 1. Request password reset
      const forgotRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testEmail });

      expect(forgotRes.status).toBe(200);
      expect(forgotRes.body.success).toBe(true);
      // In dev/test mode, the controller returns the generated reset token for testing
      const resetToken = forgotRes.body.resetToken;
      expect(resetToken).toBeDefined();

      // 2. Complete password reset with new password
      const newPassword = 'NewSecretPassword456!';
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetToken, newPassword });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // 3. Old password should now fail
      const oldLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });

      expect(oldLoginRes.status).toBe(401);

      // 4. New password should succeed
      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: newPassword });

      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.success).toBe(true);
      expect(newLoginRes.body.data.accessToken).toBeDefined();
    });
  });
});
