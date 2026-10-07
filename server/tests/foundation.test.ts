import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { createApp } from '../src/app';
import { BadRequestError, NotFoundError } from '../src/errors/AppError';
import { errorHandler } from '../src/middleware/errorHandler';
import { validateRequest } from '../src/middleware/validate';
import * as databaseModule from '../src/config/database';
import * as redisModule from '../src/config/redis';

describe('Backend Foundation Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Health Endpoint', () => {
    it('should return 200 and healthy status when database and redis are healthy', async () => {
      vi.spyOn(databaseModule, 'checkDatabaseHealth').mockResolvedValue({
        isHealthy: true,
        latencyMs: 3,
      });
      vi.spyOn(redisModule, 'checkRedisHealth').mockResolvedValue({
        isHealthy: true,
        latencyMs: 1,
      });

      const app = createApp();
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.services.api.status).toBe('up');
      expect(res.body.services.database.status).toBe('up');
      expect(res.body.services.redis.status).toBe('up');
    });

    it('should return 503 and degraded status when database is down', async () => {
      vi.spyOn(databaseModule, 'checkDatabaseHealth').mockResolvedValue({
        isHealthy: false,
        error: 'Connection refused',
      });
      vi.spyOn(redisModule, 'checkRedisHealth').mockResolvedValue({
        isHealthy: true,
        latencyMs: 1,
      });

      const app = createApp();
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('degraded');
      expect(res.body.services.database.status).toBe('down');
      expect(res.body.services.database.error).toBe('Connection refused');
    });
  });

  describe('Security Headers', () => {
    it('should set Helmet security headers on app routes', async () => {
      const app = createApp();
      const res = await request(app).get('/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });

  describe('Centralized Error Handling', () => {
    it('should return 404 for undefined routes in standard format', async () => {
      const app = createApp();
      const res = await request(app).get('/undefined-route');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should catch operational AppError and return expected status and code', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.get('/test-error', () => {
        throw new BadRequestError('Invalid query parameter', { field: 'filter' });
      });
      testApp.use(errorHandler);

      const res = await request(testApp).get('/test-error');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toBe('Invalid query parameter');
      expect(res.body.error.details).toEqual({ field: 'filter' });
    });
  });

  describe('Request Validation Middleware', () => {
    it('should accept valid requests matching Zod schema', async () => {
      const app = express();
      app.use(express.json());

      const schema = {
        body: z.object({
          name: z.string().min(3),
        }),
      };

      app.post('/validate-test', validateRequest(schema), (req, res) => {
        res.json({ success: true, data: req.body });
      });
      app.use(errorHandler);

      const res = await request(app)
        .post('/validate-test')
        .send({ name: 'Valid Agent' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Valid Agent');
    });

    it('should reject invalid requests with 422 and detailed issue list', async () => {
      const testApp = express();
      testApp.use(express.json());

      const schema = {
        body: z.object({
          email: z.string().email(),
          count: z.number().int().positive(),
        }),
      };

      testApp.post('/validate-fail', validateRequest(schema), (req, res) => {
        res.json({ ok: true });
      });
      testApp.use(errorHandler);

      const res = await request(testApp)
        .post('/validate-fail')
        .send({ email: 'not-an-email', count: -5 });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);
    });
  });
});
