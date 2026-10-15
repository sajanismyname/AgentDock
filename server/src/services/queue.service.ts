import { getRedisClient } from '../config/redis';
import { SuiteType } from '../entities/TestRun';

export interface RunJobPayload {
  runId: string;
  userId: string;
  agentId: string;
  suiteType: SuiteType;
  enqueuedAt: string;
}

export class RunQueueService {
  private static readonly QUEUE_KEY = 'agentdock:queue:test_runs';
  private static readonly fallbackQueue: RunJobPayload[] = [];

  /**
   * Enqueues a test run job to the Redis/Valkey queue.
   */
  static async enqueueRunJob(payload: RunJobPayload): Promise<void> {
    const jobString = JSON.stringify(payload);

    try {
      const redis = getRedisClient();
      if (redis.status === 'ready' || redis.status === 'connect') {
        await redis.rpush(this.QUEUE_KEY, jobString);
        return;
      }
    } catch {
      // Fall through to in-memory fallback queue
    }

    this.fallbackQueue.push(payload);
  }

  /**
   * Dequeues the next test run job from Redis or the fallback queue.
   */
  static async dequeueRunJob(): Promise<RunJobPayload | null> {
    try {
      const redis = getRedisClient();
      if (redis.status === 'ready' || redis.status === 'connect') {
        const item = await redis.lpop(this.QUEUE_KEY);
        if (item) {
          return JSON.parse(item) as RunJobPayload;
        }
        return null;
      }
    } catch {
      // Fall through to in-memory fallback queue
    }

    const item = this.fallbackQueue.shift();
    return item || null;
  }

  /**
   * Gets the current queue length.
   */
  static async getQueueLength(): Promise<number> {
    try {
      const redis = getRedisClient();
      if (redis.status === 'ready' || redis.status === 'connect') {
        return await redis.llen(this.QUEUE_KEY);
      }
    } catch {
      // Fall through to in-memory fallback queue
    }

    return this.fallbackQueue.length;
  }

  /**
   * Clears the queue (useful for test setup / teardown).
   */
  static async clearQueue(): Promise<void> {
    try {
      const redis = getRedisClient();
      if (redis.status === 'ready' || redis.status === 'connect') {
        await redis.del(this.QUEUE_KEY);
      }
    } catch {
      // Ignore
    }
    this.fallbackQueue.length = 0;
  }
}
