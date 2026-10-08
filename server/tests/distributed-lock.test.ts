import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DistributedLockService } from '../src/services/lock.service';

describe('Priority 5: Valkey Distributed Run Lock Tests', () => {
  const testUserId = 'test-user-lock-uuid-123';
  const runId1 = 'run-uuid-1111';
  const runId2 = 'run-uuid-2222';

  beforeEach(async () => {
    await DistributedLockService.releaseUserRunLock(testUserId, runId1);
    await DistributedLockService.releaseUserRunLock(testUserId, runId2);
    DistributedLockService.clearFallbackLocks();
  });

  afterEach(async () => {
    await DistributedLockService.releaseUserRunLock(testUserId, runId1);
    await DistributedLockService.releaseUserRunLock(testUserId, runId2);
    DistributedLockService.clearFallbackLocks();
  });

  it('should acquire lock for a user when no active run exists', async () => {
    const acquired = await DistributedLockService.acquireUserRunLock(testUserId, runId1, 60);
    expect(acquired).toBe(true);

    const isLocked = await DistributedLockService.isUserRunLocked(testUserId);
    expect(isLocked).toBe(true);
  });

  it('should reject concurrent lock acquisition for the same user (1 active run per user)', async () => {
    const firstAcquire = await DistributedLockService.acquireUserRunLock(testUserId, runId1, 60);
    expect(firstAcquire).toBe(true);

    // Second run attempt while first is active must be rejected atomically
    const secondAcquire = await DistributedLockService.acquireUserRunLock(testUserId, runId2, 60);
    expect(secondAcquire).toBe(false);
  });

  it('should safely release lock only when run ID matches (safe Lua check)', async () => {
    await DistributedLockService.acquireUserRunLock(testUserId, runId1, 60);

    // Attempting to release with wrong runId should fail and NOT release the lock
    const wrongRelease = await DistributedLockService.releaseUserRunLock(testUserId, runId2);
    expect(wrongRelease).toBe(false);

    // Lock must still be held
    const isLocked = await DistributedLockService.isUserRunLocked(testUserId);
    expect(isLocked).toBe(true);

    // Releasing with correct runId must succeed
    const correctRelease = await DistributedLockService.releaseUserRunLock(testUserId, runId1);
    expect(correctRelease).toBe(true);

    // Lock is now released
    const isLockedAfter = await DistributedLockService.isUserRunLocked(testUserId);
    expect(isLockedAfter).toBe(false);
  });

  it('should allow new run after previous run lock has been released', async () => {
    await DistributedLockService.acquireUserRunLock(testUserId, runId1, 60);
    await DistributedLockService.releaseUserRunLock(testUserId, runId1);

    const nextAcquire = await DistributedLockService.acquireUserRunLock(testUserId, runId2, 60);
    expect(nextAcquire).toBe(true);
  });

  it('should automatically expire lock after TTL to prevent permanent lockout', async () => {
    // Acquire with 1 second TTL
    await DistributedLockService.acquireUserRunLock(testUserId, runId1, 1);

    // Wait 1.1s for expiration
    await new Promise((r) => setTimeout(r, 1100));

    const isLocked = await DistributedLockService.isUserRunLocked(testUserId);
    expect(isLocked).toBe(false);

    // New run can acquire lock after expiration
    const acquiredAfterExpire = await DistributedLockService.acquireUserRunLock(testUserId, runId2, 60);
    expect(acquiredAfterExpire).toBe(true);
  });
});
