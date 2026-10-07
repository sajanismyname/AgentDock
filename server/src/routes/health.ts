import { Router, Request, Response } from 'express';
import { checkDatabaseHealth } from '../config/database';
import { checkRedisHealth } from '../config/redis';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);

  const isHealthy = dbHealth.isHealthy && redisHealth.isHealthy;
  const status = isHealthy ? 'healthy' : 'degraded';
  const httpCode = isHealthy ? 200 : 503;

  res.status(httpCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      api: {
        status: 'up',
      },
      database: {
        status: dbHealth.isHealthy ? 'up' : 'down',
        ...(dbHealth.latencyMs !== undefined ? { latencyMs: dbHealth.latencyMs } : {}),
        ...(dbHealth.error ? { error: dbHealth.error } : {}),
      },
      redis: {
        status: redisHealth.isHealthy ? 'up' : 'down',
        ...(redisHealth.latencyMs !== undefined ? { latencyMs: redisHealth.latencyMs } : {}),
        ...(redisHealth.error ? { error: redisHealth.error } : {}),
      },
    },
  });
});

export const healthRouter = router;
