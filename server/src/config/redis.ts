import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';

export interface RedisHealth {
  isHealthy: boolean;
  latencyMs?: number;
  error?: string;
}

let redisClient: Redis | null = null;

export function getRedisOptions(): RedisOptions {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    db: env.REDIS_DB,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      // Reconnect with capped backoff, max 2 seconds
      return Math.min(times * 100, 2000);
    },
  };
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(getRedisOptions());

    redisClient.on('error', (err) => {
      // Safe logging: log error message only, never configuration options or credentials
      if (env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.warn('[Redis] Connection warning:', err.message);
      }
    });
  }

  return redisClient;
}

/**
 * Perform a Redis health probe using PING
 */
export async function checkRedisHealth(): Promise<RedisHealth> {
  const client = getRedisClient();
  const start = Date.now();

  try {
    if (client.status === 'wait') {
      await client.connect();
    }
    const response = await client.ping();
    const isHealthy = response === 'PONG';

    return {
      isHealthy,
      latencyMs: Date.now() - start,
      ...(!isHealthy ? { error: `Unexpected PING response: ${response}` } : {}),
    };
  } catch (error) {
    return {
      isHealthy: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown Redis error',
    };
  }
}

/**
 * Disconnect Redis client cleanly
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    try {
      if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
        await redisClient.quit();
      } else {
        redisClient.disconnect();
      }
    } catch {
      redisClient.disconnect();
    } finally {
      redisClient = null;
    }
  }
}
