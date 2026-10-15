import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { AppDataSource } from '../src/config/data-source';
import { User } from '../src/entities/User';
import { Agent } from '../src/entities/Agent';
import { SafeHttpClient } from '../src/utils/safeHttpClient';
import { SecretRedactor } from '../src/utils/secretRedactor';
import { EncryptionService } from '../src/services/encryption.service';

describe('CHECKPOINT 5 — Security & Authorization Tests', () => {
  const app = createApp();
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let userAAgentId: string;

  beforeAll(async () => {
    await connectDatabase();

    // Create User A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({ email: `sec_userA_${Date.now()}@example.com`, password: 'Password123!' });
    userAToken = resA.body.data.accessToken;
    userAId = resA.body.data.user.id;

    // Create User B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({ email: `sec_userB_${Date.now()}@example.com`, password: 'Password123!' });
    userBToken = resB.body.data.accessToken;
    userBId = resB.body.data.user.id;

    // Create Agent for User A
    const agentRes = await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        name: 'User A Secret Agent',
        endpoint: 'https://example.com/api',
        credential: 'super-confidential-api-key-99',
      });
    userAAgentId = agentRes.body.data.agent.id;
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      const userRepo = AppDataSource.getRepository(User);
      if (userAId) await userRepo.delete({ id: userAId });
      if (userBId) await userRepo.delete({ id: userBId });
      await disconnectDatabase();
    }
  });

  describe('1. Cross-User Authorization (IDOR Defense)', () => {
    it('User B cannot read User A agent', async () => {
      const res = await request(app)
        .get(`/api/agents/${userAAgentId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('User B cannot update User A agent', async () => {
      const res = await request(app)
        .patch(`/api/agents/${userAAgentId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ name: 'Hacked Agent' });

      expect(res.status).toBe(404);
    });

    it('User B cannot add rules to User A agent', async () => {
      const res = await request(app)
        .post(`/api/agents/${userAAgentId}/rules`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          type: 'forbidden_action',
          description: 'Unauthorized rule insertion',
        });

      expect(res.status).toBe(404);
    });

    it('User B cannot trigger test runs on User A agent', async () => {
      const res = await request(app)
        .post(`/api/agents/${userAAgentId}/runs`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ suite: 'all' });

      expect(res.status).toBe(404);
    });

    it('User B cannot delete User A agent', async () => {
      const res = await request(app)
        .delete(`/api/agents/${userAAgentId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('2. SSRF (Server-Side Request Forgery) Defense', () => {
    it('identifies private and loopback IP addresses correctly', () => {
      expect(SafeHttpClient.isPrivateIp('127.0.0.1')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('10.0.0.1')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('172.16.0.1')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('192.168.1.1')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('169.254.169.254')).toBe(true); // Cloud metadata IP
      expect(SafeHttpClient.isPrivateIp('::1')).toBe(true);

      // Public IPs
      expect(SafeHttpClient.isPrivateIp('8.8.8.8')).toBe(false);
      expect(SafeHttpClient.isPrivateIp('93.184.216.34')).toBe(false);
    });

    it('blocks loopback and cloud metadata endpoints on validation', async () => {
      await expect(
        SafeHttpClient.validateUrl('http://169.254.169.254/latest/meta-data/', false)
      ).rejects.toThrow();

      await expect(
        SafeHttpClient.validateUrl('http://metadata.google.internal/computeMetadata/v1/', false)
      ).rejects.toThrow();
    });

    it('blocks non-HTTP protocols (e.g. file://, ftp://, gopher://)', async () => {
      await expect(SafeHttpClient.validateUrl('file:///etc/passwd')).rejects.toThrow(
        'Only HTTP and HTTPS endpoints are permitted'
      );
      await expect(SafeHttpClient.validateUrl('ftp://ftp.example.com')).rejects.toThrow(
        'Only HTTP and HTTPS endpoints are permitted'
      );
    });
  });

  describe('3. Credential Encryption & Redaction', () => {
    it('encrypts and decrypts credentials with AES-256-GCM', () => {
      const secret = 'super-secret-production-token-2026';
      const encrypted = EncryptionService.encrypt(secret);

      expect(encrypted).not.toBe(secret);
      expect(encrypted.split(':').length).toBe(3); // iv:authTag:ciphertext

      const decrypted = EncryptionService.decrypt(encrypted);
      expect(decrypted).toBe(secret);
    });

    it('redacts sensitive API keys and Bearer tokens', () => {
      const textWithKeys =
        'Agent response using sk-12345678901234567890123456 and Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz';
      const redacted = SecretRedactor.redact(textWithKeys);

      expect(redacted).not.toContain('sk-12345678901234567890123456');
      expect(redacted).toContain('[REDACTED]');
    });

    it('never exposes password hashes or raw refresh tokens on User entity', async () => {
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: userAId } });

      expect(user).toBeDefined();
      const json = user!.toJSON();
      expect(json).toBeDefined();
      expect((json as unknown as { passwordHash?: string }).passwordHash).toBeUndefined();
      expect((json as unknown as { refreshTokenHash?: string }).refreshTokenHash).toBeUndefined();
      expect((json as unknown as { passwordResetTokenHash?: string }).passwordResetTokenHash).toBeUndefined();
    });
  });
});
