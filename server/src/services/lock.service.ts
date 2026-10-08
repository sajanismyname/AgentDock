import { getRedisClient } from '../config/redis';

export class DistributedLockService {
  private static readonly DEFAULT_TTL_SECONDS = 600; // 10 minutes maximum lock duration

  // In-memory fallback map for isolated test environments where Redis is unavailable
  private static readonly fallbackLocks = new Map<string, { runId: string; expiresAt: number }>();

  private static getUserLockKey(userId: string): string {
    return `lock:user-run:${userId}`;
  }

  /**
   * Atomically acquires an exclusive run lock for a user using Redis SET NX EX.
   * Returns true if acquired successfully, false if another run is already active.
   */
  static async acquireUserRunLock(
    userId: string,
    runId: string,
    ttlSeconds: number = this.DEFAULT_TTL_SECONDS
  ): Promise<boolean> {
    const key = this.getUserLockKey(userId);

    try {
      const redis = getRedisClient();
      if (redis.status === 'ready' || redis.status === 'connect') {
        const result = await redis.set(key, runId, 'EX', ttlSeconds, 'NX');
        return result === 'OK';
      }
    } catch {
      // Fall through to in-memory fallback
    }

    // In-memory fallback
    const now = Date.now();
    const existing = this.fallbackLocks.get(key);
    if (existing && existing.expiresAt > now) {
      return false;
    }

    this.fallbackLocks.set(key, {
      runId,
      expiresAt: now + ttlSeconds * 1000,
    });
    return true;
  }

  /**
   * Safely releases a user run lock using an atomic Lua script.
   * Ensures a run only releases its own lock and never accidentally deletes another run's lock.
   */
  static async releaseUserRunLock(userId: string, runId: string): Promise<boolean> {
    const key = this.getUserLockKey(userId);

    try {
      const redis = getRedisClient();
      if (redis.status === 'ready' || redis.status === 'connect') {
        const luaScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        const result = await redis.eval(luaScript, 1, key, runId);
        return result === 1;
      }
    } catch {
      // Fall through to in-memory fallback
    }

    // In-memory fallback
    const existing = this.fallbackLocks.get(key);
    if (existing && existing.runId === runId) {
      this.fallbackLocks.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Checks if a user currently holds an active run lock.
   */
  static async isUserRunLocked(userId: string): Promise<boolean> {
    const key = this.getUserLockKey(userId);

    try {
      const redis = getRedisClient();
      if (redis.status === 'ready' || redis.status === 'connect') {
        const value = await redis.get(key);
        return value !== null;
      }
    } catch {
      // Fall through to in-memory fallback
    }

    const existing = this.fallbackLocks.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      return true;
    }
    this.fallbackLocks.delete(key);
    return false;
  }

  /**
   * Clear all fallback locks (for test teardowns).
   */
  static clearFallbackLocks(): void {
    this.fallbackLocks.clear();
  }
}
