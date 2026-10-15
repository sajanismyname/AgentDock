import { connectDatabase, disconnectDatabase } from './config/database';
import { getRedisClient, disconnectRedis } from './config/redis';
import { WorkerService } from './services/worker.service';

async function startStandaloneWorker(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[Worker] Starting AgentDock test execution worker...');

  try {
    await connectDatabase();
    // eslint-disable-next-line no-console
    console.log('[Worker] Connected to PostgreSQL successfully.');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Worker] Failed to connect to database:', error);
    process.exit(1);
  }

  try {
    const redis = getRedisClient();
    if (redis.status === 'wait') {
      await redis.connect();
    }
    // eslint-disable-next-line no-console
    console.log('[Worker] Connected to Redis/Valkey successfully.');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[Worker] Redis connection warning:', error);
  }

  // Start worker polling loop
  WorkerService.startWorkerLoop(500);
  // eslint-disable-next-line no-console
  console.log('[Worker] Worker polling loop active. Waiting for jobs...');

  const handleShutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[Worker] Received ${signal}. Shutting down worker...`);
    WorkerService.stopWorkerLoop();

    try {
      await disconnectDatabase();
      await disconnectRedis();
    } catch {
      // Ignore disconnect errors
    }

    // eslint-disable-next-line no-console
    console.log('[Worker] Worker shutdown complete.');
    process.exit(0);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

if (process.env.NODE_ENV !== 'test') {
  startStandaloneWorker().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[Worker] Fatal error:', err);
    process.exit(1);
  });
}
